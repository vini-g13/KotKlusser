from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import asyncpg
import stripe
import os
import json
import logging
import asyncio
import random
import string
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
import secrets
from datetime import datetime, timezone, timedelta
import jwt
from jwt import PyJWKClient
from supabase import create_client, Client as SupabaseClient
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


def require_env(name: str) -> str:
    """Fail fast at startup instead of silently falling back to a hardcoded/insecure default."""
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable: {name}. "
            f"Set it in Railway (or your local backend/.env) before starting the app."
        )
    return value


# ============ SUPABASE / POSTGRES CONFIG ============
# Cleanup sprint 5 (2026-07, kotklusser-cleanup-plan.md sectie 6.1): vervangt
# MongoDB (Motor) + de custom JWT-laag door Supabase Postgres + Supabase Auth.

SUPABASE_URL = require_env('SUPABASE_URL')
SUPABASE_ANON_KEY = require_env('SUPABASE_ANON_KEY')
SUPABASE_SERVICE_ROLE_KEY = require_env('SUPABASE_SERVICE_ROLE_KEY')
DATABASE_URL = require_env('DATABASE_URL')

# supabase-py client, enkel gebruikt voor Auth-admin-operaties (user aanmaken/
# verwijderen via de Admin API) — niet voor gewone tabelquery's, die lopen via
# asyncpg rechtstreeks tegen Postgres (sneller, geen PostgREST-tussenlaag nodig
# voor een backend die toch al vertrouwd wordt).
supabase_admin: SupabaseClient = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# JWT-verificatie van Supabase-Auth-tokens via JWKS (asymmetrische signing keys —
# de huidige aanbevolen aanpak, geen gedeeld HS256-secret meer nodig). Zie
# https://supabase.com/docs/guides/auth/signing-keys. PyJWKClient cachet de
# public keys zelf (lifespan hieronder gelijk aan Supabase's eigen edge-cache
# van 10 minuten).
_jwks_client = PyJWKClient(
    f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json",
    cache_keys=True,
    lifespan=600,
)

db_pool: Optional[asyncpg.Pool] = None


async def _init_connection(conn: asyncpg.Connection):
    # asyncpg decodeert jsonb niet automatisch naar dict/list — zonder deze
    # codec krijg je de ruwe JSON-string terug (bv. voor profiles.tile_config).
    await conn.set_type_codec(
        'jsonb',
        encoder=json.dumps,
        decoder=json.loads,
        schema='pg_catalog',
        format='text',
    )


async def get_pool() -> asyncpg.Pool:
    global db_pool
    if db_pool is None:
        # statement_cache_size=0 is VERPLICHT tegen Supabase's transaction pooler
        # (poort 6543) — die ondersteunt geen server-side prepared statements,
        # en asyncpg gebruikt die standaard. Zonder deze regel krijg je
        # intermitterende "prepared statement does not exist"-fouten onder load.
        db_pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=1,
            max_size=10,
            statement_cache_size=0,
            init=_init_connection,
        )
    return db_pool


async def fetchrow(query: str, *args) -> Optional[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        record = await conn.fetchrow(query, *args)
        return dict(record) if record else None


async def fetch(query: str, *args) -> List[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        records = await conn.fetch(query, *args)
        return [dict(r) for r in records]


async def fetchval(query: str, *args):
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchval(query, *args)


async def execute(query: str, *args) -> str:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)


# JWT Config
# Geen eigen JWT_SECRET/refresh-token-config meer nodig — Supabase Auth
# ondertekent tokens zelf (JWKS-verificatie hierboven) en beheert sessies/
# refresh-tokens/max-gelijktijdige-sessies via zijn eigen sessiemodel
# (instelbaar in het Supabase-dashboard onder Authentication > Sessions,
# niet meer in deze code). Dit vervangt de volledige custom create_token /
# create_refresh_token / verify_refresh_token / store_refresh_token /
# refresh_tokens-collectie van vóór de migratie.

# Resend Config
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
# NOTE: de onboarding@resend.dev-fallback hierboven is een bekend deliverability-
# probleem — zie kotklusser-cleanup-plan.md sectie 6.3. Los daarvan getrackt.

# App URL for join links
APP_URL = os.environ.get('APP_URL', 'https://kot-quick.preview.emergentagent.com')
FRONTEND_URL = os.environ.get('FRONTEND_URL', APP_URL)

# CORS
CORS_ORIGINS = require_env('CORS_ORIGINS').split(',')

# Stripe Config — bewust NIET require_env, zie server.py-geschiedenis /
# kotklusser-cleanup-plan.md: subscriptions horen mogelijk op platformniveau
# thuis i.p.v. bij deze standalone module. Optioneel, met een nette 503 op de
# betaalroutes zelf als het niet ingesteld is.
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')
STRIPE_PRICE_IDS = {
    'growth_monthly': os.environ.get('STRIPE_PRICE_GROWTH_MONTHLY'),
    'growth_yearly':  os.environ.get('STRIPE_PRICE_GROWTH_YEARLY'),
    'pro_monthly':    os.environ.get('STRIPE_PRICE_PRO_MONTHLY'),
    'pro_yearly':     os.environ.get('STRIPE_PRICE_PRO_YEARLY'),
}

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Crash logging (Sentry) — optioneel: stdout-only logging verdwijnt met Railway's
# log-rotatie, zie kotklusser-cleanup-plan.md sectie 4. Geen require_env: een
# ontbrekende SENTRY_DSN is geen security/correctheidsprobleem zoals een
# ontbrekende DB-credential, dus de app moet gewoon zonder Sentry blijven draaien.
SENTRY_DSN = os.environ.get('SENTRY_DSN', '')
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.0,
        environment=os.environ.get('RAILWAY_ENVIRONMENT_NAME', 'development'),
    )
    logger.info("Sentry crash logging actief.")
else:
    logger.warning("SENTRY_DSN niet ingesteld — crash logging naar Sentry is uitgeschakeld.")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY
else:
    logger.warning(
        "STRIPE_SECRET_KEY niet ingesteld — /api/payments/* routes geven een "
        "nette 503 terug tot dit (eventueel platformbreed) geconfigureerd is."
    )

# Create the main app
app = FastAPI(title="KotKlusser API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Rate limiting — zie kotklusser-cleanup-plan.md sectie 2.6.
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ============ MODELS ============

class UserCreate(BaseModel):
    # email/password zijn hier bewust optioneel: /profile/complete-registration
    # (de enige route die dit model nog gebruikt na de Supabase-migratie) haalt
    # het e-mailadres uit de JWT (get_current_user) en het wachtwoord is al
    # verwerkt door supabase.auth.signUp() aan de clientkant. Deze velden
    # bleven in het model staan zodat de frontend hetzelfde formulier-object
    # kan doorsturen zonder het expliciet te moeten strippen.
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    name: str
    role: str = "student"  # student, landlord of contractor
    phone: Optional[str] = None
    join_code: Optional[str] = None
    room_number: Optional[str] = None
    floor: Optional[str] = None
    plan: Optional[str] = None
    billing: Optional[str] = None
    invite_token: Optional[str] = None
    specialty: Optional[str] = None
    region: Optional[str] = None

class CheckoutSessionRequest(BaseModel):
    plan: str
    billing: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    phone: Optional[str] = None
    property_id: Optional[str] = None
    property_name: Optional[str] = None
    room_number: Optional[str] = None
    floor: Optional[str] = None
    has_property: bool = False
    created_at: str
    tile_config: Optional[List[dict]] = None

class TileConfigUpdate(BaseModel):
    tile_config: List[dict]

class PropertyCreate(BaseModel):
    name: str
    address: str
    floor_count: int = 5

class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    floor_count: Optional[int] = None

class PropertyResponse(BaseModel):
    id: str
    name: str
    address: str
    landlord_id: str
    join_code: str
    join_link: str
    floor_count: int = 5
    floors: List[dict] = []
    tenant_count: int = 0
    created_at: str

class TenantResponse(BaseModel):
    id: str
    name: str
    email: str
    room_number: Optional[str] = None
    floor: Optional[str] = None
    ticket_count: int = 0
    created_at: str

class JoinPropertyRequest(BaseModel):
    join_code: str
    room_number: str
    floor: str

class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None

class LandlordEmailChangeRequest(BaseModel):
    new_email: EmailStr

class EmailChangeRequest(BaseModel):
    new_email: EmailStr

class EmailChangeApproval(BaseModel):
    approved: bool
    reason: Optional[str] = None

class ProfileResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: str
    company_name: Optional[str] = None
    property_id: Optional[str] = None
    property_name: Optional[str] = None
    room_number: Optional[str] = None
    floor: Optional[str] = None
    created_at: str
    pending_email_change: Optional[dict] = None

class ContactFormSubmission(BaseModel):
    name: str
    company: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    message: str

class DemoSignupSubmission(BaseModel):
    name: str
    email: EmailStr

class TicketCreate(BaseModel):
    title: str
    description: str
    category: str
    location: str
    urgency: str = "normal"

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    scheduled_date: Optional[str] = None
    notes: Optional[str] = None

class MessageCreate(BaseModel):
    content: str

class TicketResponse(BaseModel):
    id: str
    ticket_number: str
    title: str
    description: str
    category: str
    location: str
    urgency: str
    status: str
    created_by: str
    created_by_name: str
    property_id: Optional[str] = None
    property_name: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    assigned_to_specialty: Optional[str] = None
    photos: List[str] = []
    estimated_repair_date: Optional[str] = None
    scheduled_date: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str

class MessageResponse(BaseModel):
    id: str
    ticket_id: str
    sender_id: str
    sender_name: str
    sender_role: str
    content: str
    created_at: str

class ContractorInviteRequest(BaseModel):
    email: EmailStr
    name: str
    specialty: str = ""

class AssignContractorRequest(BaseModel):
    contractor_id: str

class ContractorStatusUpdate(BaseModel):
    status: str  # 'in_progress' of 'resolved'

# ============ HELPER FUNCTIONS ============
# hash_password/verify_password/create_token/create_refresh_token/
# verify_refresh_token/store_refresh_token bestaan niet meer — Supabase Auth
# doet wachtwoord-hashing en token-uitgifte nu zelf (zie SUPABASE / POSTGRES
# CONFIG hierboven).

PROFILE_FIELDS = (
    "id, role, name, phone, company_name, property_id, room_number, floor, "
    "plan, billing, subscription_status, stripe_customer_id, stripe_subscription_id, "
    "specialty, region, tile_config, created_at"
)


def _profile_row_to_dict(row: dict, email: str) -> dict:
    """Zet een profiles-rij + het e-mailadres uit de JWT om naar de user-dict-vorm
    die de rest van de route-handlers verwachten (zelfde sleutels als vóór de
    migratie, zodat de business-logica in de routes zelf grotendeels ongewijzigd
    kan blijven)."""
    user = dict(row)
    user['id'] = str(user['id'])
    if user.get('property_id'):
        user['property_id'] = str(user['property_id'])
    user['email'] = email
    user['created_at'] = user['created_at'].isoformat() if user.get('created_at') else None
    return user


async def _create_profile_row(user_id: str, email: str, data: UserCreate) -> dict:
    """Maakt de profiles-rij aan. Losstaand van complete_registration hieronder
    zodat get_current_user (zie fallback verderop) dit ook kan aanroepen zonder
    het bestaande gedrag van de /profile/complete-registration-route (die
    expliciet 400 geeft bij een dubbele aanroep) te wijzigen."""
    invite = None
    if data.role == 'contractor' and data.invite_token:
        invite = await fetchrow(
            "select * from contractor_invites where token = $1 and email = $2 and used = false",
            data.invite_token, email,
        )
        if not invite:
            raise HTTPException(status_code=400, detail='Ongeldige of verlopen uitnodigingslink')

    prop = None
    if data.role == 'student' and data.join_code:
        prop = await fetchrow("select * from properties where join_code = $1", data.join_code.upper())
        if not prop:
            raise HTTPException(status_code=400, detail='Ongeldige join code')
        if not data.room_number or not data.floor:
            raise HTTPException(status_code=400, detail='Kamernummer en verdieping zijn verplicht')

    selected_plan = data.plan or 'starter'
    await execute(
        """
        insert into profiles (id, role, name, phone, property_id, room_number, floor,
                               plan, billing, subscription_status, specialty, region)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        """,
        uuid.UUID(user_id), data.role, data.name, data.phone,
        prop['id'] if prop else None,
        data.room_number if prop else None,
        data.floor if prop else None,
        selected_plan, data.billing or 'monthly',
        'active' if selected_plan == 'starter' else 'pending',
        data.specialty if data.role == 'contractor' else None,
        data.region if data.role == 'contractor' else None,
    )

    if data.role == 'contractor' and invite:
        await execute(
            "insert into contractor_landlord_links (contractor_id, landlord_id) values ($1, $2) "
            "on conflict do nothing",
            uuid.UUID(user_id), invite['landlord_id'],
        )
        await execute("update contractor_invites set used = true where token = $1", data.invite_token)

    profile = await fetchrow(f"select {PROFILE_FIELDS} from profiles where id = $1", uuid.UUID(user_id))
    return _profile_row_to_dict(profile, email)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        signing_key = await asyncio.to_thread(_jwks_client.get_signing_key_from_jwt, token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256", "HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token verlopen')
    except Exception:
        raise HTTPException(status_code=401, detail='Ongeldig token')

    user_id = payload.get('sub')
    email = payload.get('email')
    if not user_id:
        raise HTTPException(status_code=401, detail='Ongeldig token')

    try:
        profile = await fetchrow(
            f"select {PROFILE_FIELDS} from profiles where id = $1",
            uuid.UUID(user_id),
        )
    except ValueError:
        raise HTTPException(status_code=401, detail='Ongeldig token')

    if not profile:
        # Kan gebeuren als "Confirm email" aanstaat in Supabase: signUp() geeft
        # dan meteen geen sessie terug, dus complete-registration kon nog niet
        # aangeroepen worden vanuit de frontend (zie register() in App.js). De
        # frontend geeft de ingevulde registratiegegevens daarom ook mee als
        # Supabase user_metadata bij signUp() (sleutel "kotklusser_registration")
        # -- die metadata zit in elk geldig access token, ongeacht op welk
        # (sub)domein de sessie tot stand kwam. Probeer het profiel hier alsnog
        # aan te maken voor we opgeven.
        metadata = payload.get('user_metadata') or {}
        pending = metadata.get('kotklusser_registration')
        if isinstance(pending, dict) and pending.get('name'):
            try:
                registration_data = UserCreate(**pending)
                return await _create_profile_row(user_id, email, registration_data)
            except Exception as e:
                # Kan een echte validatiefout zijn (bv. een join code die
                # intussen niet meer bestaat) of iets onverwachts. In beide
                # gevallen hoort elke andere API-call voor deze gebruiker
                # gewoon de normale 401 hieronder te krijgen i.p.v. deze
                # interne fout te lekken naar willekeurige endpoints.
                logger.error(f"Kon profiel niet automatisch aanmaken uit user_metadata voor {user_id}: {e}")
        raise HTTPException(status_code=401, detail='Gebruikersprofiel niet gevonden')

    return _profile_row_to_dict(profile, email)


def generate_join_code() -> str:
    """Generate a 6-character alphanumeric join code"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

def generate_approval_token() -> str:
    """Generate a secure token for email change approval"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=64))

def split_name(full_name: str) -> tuple:
    """Split a full name into first and last name"""
    parts = full_name.strip().split(' ', 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ''
    return first_name, last_name

def combine_name(first_name: str, last_name: str) -> str:
    """Combine first and last name into full name"""
    if last_name:
        return f"{first_name} {last_name}"
    return first_name

def generate_floors(floor_count: int) -> List[dict]:
    """Generate floor options from 0 (ground floor) to floor_count"""
    floors = []
    for i in range(floor_count + 1):
        if i == 0:
            floors.append({"value": "0", "label": "Gelijkvloers"})
        else:
            floors.append({"value": str(i), "label": f"Verdieping {i}"})
    return floors

def generate_ticket_number() -> str:
    return f"KM-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

def estimate_repair_date(category: str, urgency: str) -> str:
    base_days = {
        'sanitair': 3,
        'elektriciteit': 2,
        'verwarming': 4,
        'internet': 1,
        'keuken': 3,
        'anders': 5
    }
    urgency_modifier = {
        'urgent': 0.5,
        'high': 0.75,
        'normal': 1,
        'low': 1.5
    }
    days = base_days.get(category, 5) * urgency_modifier.get(urgency, 1)
    estimated_date = datetime.now(timezone.utc) + timedelta(days=int(days))
    return estimated_date.isoformat()

async def send_followup_emails():
    """Find all demo signups where follow_up_sent is False and follow_up_scheduled_at is in the past, then send follow-up emails."""
    now = datetime.now(timezone.utc)
    pending = await fetch(
        "select id, name, email from contact_submissions "
        "where type = 'demo_signup' and follow_up_sent = false and follow_up_scheduled_at <= $1",
        now,
    )

    for signup in pending:
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="background-color: #6366F1; padding: 24px; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Kot<span style="color: #c7d2fe;">Klusser</span></h1>
            </div>
            <div style="background-color: #f9fafb; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
                <p>Beste {signup['name']},</p>
                <p>Enkele dagen geleden toonde je interesse in KotKlusser, het platform waarmee verhuurders en studenten onderhoudsproblemen snel en gestructureerd kunnen oplossen.</p>
                <p>We wilden even checken of je nog vragen hebt, of gewoon eens een kijkje wil nemen in het platform. Laat het ons weten via de website.</p>
                <p style="text-align: center; margin: 32px 0;">
                    <a href="https://kotklusser.be" style="background-color: #6366F1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                        Ontdek KotKlusser verder
                    </a>
                </p>
                <p>Heb je vragen of wil je een persoonlijke demo? Antwoord gewoon op deze mail, we helpen je graag verder.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                <p style="margin: 0;">Met vriendelijke groeten</p>
                <p style="margin: 4px 0;"><strong>Team KotKlusser</strong></p>
                <a href="https://kotklusser.be" style="color: #6366F1;">kotklusser.be</a>
            </div>
        </div>
        """

        # Geen emoji meer in subject/content (spamscore-triggers) en een
        # plain-text-alternatief — zie kotklusser-cleanup-plan.md sectie 6.3.
        await send_email_notification(
            signup['email'],
            "Nog even over KotKlusser",
            html_content,
            text_content=(
                f"Beste {signup['name']},\n\n"
                "Enkele dagen geleden toonde je interesse in KotKlusser. "
                "Heb je nog vragen of wil je een demo? Antwoord gewoon op deze mail.\n\n"
                "Met vriendelijke groeten,\nTeam KotKlusser\nkotklusser.be"
            ),
        )

        await execute(
            "update contact_submissions set follow_up_sent = true, follow_up_sent_at = $2 where id = $1",
            signup['id'], now,
        )
        logger.info(f"Follow-up email sent to {signup['email']}")


async def send_email_notification(to_email: str, subject: str, html_content: str, text_content: Optional[str] = None):
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured, skipping email")
        return

    try:
        import resend
        resend.api_key = RESEND_API_KEY
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }
        if text_content:
            params["text"] = text_content
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")

# ============ AUTH ROUTES ============
# BELANGRIJKE WIJZIGING (sprint 5): /auth/register, /auth/login, /auth/refresh
# en /auth/logout bestaan hier niet meer. De frontend praat voortaan
# rechtstreeks met Supabase Auth via supabase-js (signUp/signInWithPassword/
# signOut/sessieherstel) — dat is exact waar Supabase Auth voor bedoeld is, en
# vervangt de volledige custom JWT/refresh-token-laag van vóór de migratie.
#
# Wat de backend WEL blijft doen: na een geslaagde supabase.auth.signUp() in de
# browser bestaat er een auth.users-rij, maar nog geen profiles-rij (rol,
# pand-koppeling, invite-validatie, enz. — dat vereist servervalidatie tegen
# andere gebruikers/panden, dus dat kan niet clientside). Daarvoor roept de
# frontend meteen na signUp deze route aan:

@api_router.post("/profile/complete-registration", response_model=UserResponse)
async def complete_registration(data: UserCreate, user: dict = Depends(get_current_user)):
    """Maakt de profiles-rij aan voor de zonet via Supabase Auth aangemaakte
    gebruiker. Verwacht te worden aangeroepen met de net-verkregen Supabase-
    sessietoken, onmiddellijk na een geslaagde supabase.auth.signUp() in de
    frontend."""
    existing = await fetchrow("select id from profiles where id = $1", uuid.UUID(user['id']))
    if existing:
        raise HTTPException(status_code=400, detail='Profiel bestaat al voor deze gebruiker')

    invite = None
    if data.role == 'contractor' and data.invite_token:
        invite = await fetchrow(
            "select * from contractor_invites where token = $1 and email = $2 and used = false",
            data.invite_token, user['email'],
        )
        if not invite:
            raise HTTPException(status_code=400, detail='Ongeldige of verlopen uitnodigingslink')

    prop = None
    if data.role == 'student' and data.join_code:
        prop = await fetchrow("select * from properties where join_code = $1", data.join_code.upper())
        if not prop:
            raise HTTPException(status_code=400, detail='Ongeldige join code')
        if not data.room_number or not data.floor:
            raise HTTPException(status_code=400, detail='Kamernummer en verdieping zijn verplicht')

    selected_plan = data.plan or 'starter'
    await execute(
        """
        insert into profiles (id, role, name, phone, property_id, room_number, floor,
                               plan, billing, subscription_status, specialty, region)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        """,
        uuid.UUID(user['id']), data.role, data.name, data.phone,
        prop['id'] if prop else None,
        data.room_number if prop else None,
        data.floor if prop else None,
        selected_plan, data.billing or 'monthly',
        'active' if selected_plan == 'starter' else 'pending',
        data.specialty if data.role == 'contractor' else None,
        data.region if data.role == 'contractor' else None,
    )

    if data.role == 'contractor' and invite:
        await execute(
            "insert into contractor_landlord_links (contractor_id, landlord_id) values ($1, $2) "
            "on conflict do nothing",
            uuid.UUID(user['id']), invite['landlord_id'],
        )
        await execute("update contractor_invites set used = true where token = $1", data.invite_token)

    return await get_me(user=await get_current_user_by_id(user['id'], user['email']))


async def get_current_user_by_id(user_id: str, email: str) -> dict:
    """Herbruikt door complete_registration om meteen na het aanmaken van het
    profiel de volledige, verse user-dict op te bouwen zonder een extra
    round-trip via de JWT-verificatie."""
    profile = await fetchrow(f"select {PROFILE_FIELDS} from profiles where id = $1", uuid.UUID(user_id))
    if not profile:
        raise HTTPException(status_code=404, detail='Profiel niet gevonden')
    return _profile_row_to_dict(profile, email)


@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    property_name = None
    if user.get('property_id'):
        prop = await fetchrow("select name from properties where id = $1", uuid.UUID(user['property_id']))
        if prop:
            property_name = prop['name']

    has_property = False
    if user['role'] == 'landlord':
        count = await fetchval("select count(*) from properties where landlord_id = $1", uuid.UUID(user['id']))
        has_property = count > 0

    return UserResponse(
        id=user['id'],
        email=user['email'],
        name=user['name'],
        role=user['role'],
        phone=user.get('phone'),
        property_id=user.get('property_id'),
        property_name=property_name,
        room_number=user.get('room_number'),
        floor=user.get('floor'),
        has_property=has_property,
        created_at=user['created_at'],
        tile_config=user.get('tile_config')
    )

# ============ PROFILE MANAGEMENT ROUTES ============

@api_router.get("/profile", response_model=ProfileResponse)
async def get_profile(user: dict = Depends(get_current_user)):
    """Get current user's profile with split first/last name"""
    property_name = None
    if user.get('property_id'):
        prop = await fetchrow("select name from properties where id = $1", uuid.UUID(user['property_id']))
        if prop:
            property_name = prop['name']

    first_name, last_name = split_name(user.get('name', ''))

    pending_request = await fetchrow(
        "select new_email, created_at, status from email_change_requests "
        "where student_id = $1 and status = 'pending'",
        uuid.UUID(user['id']),
    )
    if not pending_request and user['role'] == 'landlord':
        pending_request = await fetchrow(
            "select new_email, created_at, status from landlord_email_changes "
            "where landlord_id = $1 and status = 'pending'",
            uuid.UUID(user['id']),
        )

    pending_email_change = None
    if pending_request:
        pending_email_change = {
            'new_email': pending_request['new_email'],
            'created_at': pending_request['created_at'].isoformat(),
            'status': pending_request['status'],
        }

    return ProfileResponse(
        id=user['id'],
        email=user['email'],
        first_name=first_name,
        last_name=last_name,
        phone=user.get('phone'),
        role=user['role'],
        company_name=user.get('company_name'),
        property_id=user.get('property_id'),
        property_name=property_name,
        room_number=user.get('room_number'),
        floor=user.get('floor'),
        created_at=user['created_at'],
        pending_email_change=pending_email_change
    )

@api_router.patch("/profile", response_model=ProfileResponse)
async def update_profile(update: ProfileUpdate, user: dict = Depends(get_current_user)):
    """Update user profile (name, phone, company_name). Email cannot be changed directly."""
    current_first, current_last = split_name(user.get('name', ''))
    new_first = update.first_name if update.first_name is not None else current_first
    new_last = update.last_name if update.last_name is not None else current_last

    sets, args = [], []
    if update.first_name is not None or update.last_name is not None:
        args.append(combine_name(new_first, new_last))
        sets.append(f"name = ${len(args)}")
    if update.phone is not None:
        args.append(update.phone)
        sets.append(f"phone = ${len(args)}")
    if update.company_name is not None and user['role'] == 'landlord':
        args.append(update.company_name)
        sets.append(f"company_name = ${len(args)}")

    if sets:
        args.append(uuid.UUID(user['id']))
        await execute(f"update profiles set {', '.join(sets)} where id = ${len(args)}", *args)

    updated_user = await get_current_user_by_id(user['id'], user['email'])

    property_name = None
    if updated_user.get('property_id'):
        prop = await fetchrow("select name from properties where id = $1", uuid.UUID(updated_user['property_id']))
        if prop:
            property_name = prop['name']

    first_name, last_name = split_name(updated_user.get('name', ''))

    pending_request = await fetchrow(
        "select new_email, created_at, status from email_change_requests "
        "where student_id = $1 and status = 'pending'",
        uuid.UUID(user['id']),
    )
    if not pending_request and user['role'] == 'landlord':
        pending_request = await fetchrow(
            "select new_email, created_at, status from landlord_email_changes "
            "where landlord_id = $1 and status = 'pending'",
            uuid.UUID(user['id']),
        )

    pending_email_change = None
    if pending_request:
        pending_email_change = {
            'new_email': pending_request['new_email'],
            'created_at': pending_request['created_at'].isoformat(),
            'status': pending_request['status'],
        }

    return ProfileResponse(
        id=updated_user['id'],
        email=updated_user['email'],
        first_name=first_name,
        last_name=last_name,
        phone=updated_user.get('phone'),
        role=updated_user['role'],
        company_name=updated_user.get('company_name'),
        property_id=updated_user.get('property_id'),
        property_name=property_name,
        room_number=updated_user.get('room_number'),
        floor=updated_user.get('floor'),
        created_at=updated_user['created_at'],
        pending_email_change=pending_email_change
    )

# ============ LANDLORD EMAIL CHANGE (SELF-CONFIRMATION) ============
# LET OP: het daadwerkelijke e-mailadres verhuist van auth.users (Supabase
# Auth), niet van profiles — profiles heeft geen email-kolom. Deze routes
# gebruiken daarom supabase_admin.auth.admin.update_user_by_id() naast de
# gewone Postgres-update van de aanvraag zelf.

@api_router.post("/profile/landlord-request-email-change")
async def landlord_request_email_change(
    request: LandlordEmailChangeRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Dit endpoint is alleen voor verhuurders')

    pending = await fetchrow(
        "select id from landlord_email_changes where landlord_id = $1 and status = 'pending'",
        uuid.UUID(user['id']),
    )
    if pending:
        raise HTTPException(status_code=400, detail='U heeft al een openstaand wijzigingsverzoek')

    request_id = uuid.uuid4()
    confirmation_token = generate_approval_token()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=24)

    await execute(
        """
        insert into landlord_email_changes
            (id, landlord_id, old_email, new_email, confirmation_token, status, created_at, expires_at)
        values ($1, $2, $3, $4, $5, 'pending', $6, $7)
        """,
        request_id, uuid.UUID(user['id']), user['email'], request.new_email,
        confirmation_token, now, expires_at,
    )

    confirmation_link = f"{APP_URL}/bevestig-email/{confirmation_token}"
    background_tasks.add_task(
        send_email_notification,
        request.new_email,
        "Bevestig uw nieuwe emailadres - KotKlusser",
        f"""
        <h2>Bevestig uw nieuwe emailadres</h2>
        <p>Beste {user['name']},</p>
        <p>U heeft aangevraagd om uw emailadres te wijzigen naar dit adres.</p>
        <p><strong>Huidig emailadres:</strong> {user['email']}</p>
        <p><strong>Nieuw emailadres:</strong> {request.new_email}</p>
        <p>Klik op de onderstaande link om de wijziging te bevestigen:</p>
        <p><a href="{confirmation_link}" style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Emailadres bevestigen</a></p>
        <p>Of kopieer deze link: {confirmation_link}</p>
        <p><strong>Let op:</strong> Deze link is 24 uur geldig.</p>
        <p>Als u deze aanvraag niet heeft gedaan, kunt u deze email negeren.</p>
        <p>Met vriendelijke groet,<br>KotKlusser Team</p>
        """
    )

    return {
        'message': 'Bevestigingslink is verstuurd naar het nieuwe emailadres',
        'request_id': str(request_id),
        'new_email': request.new_email
    }

@api_router.get("/profile/landlord-email-change-requests")
async def get_landlord_email_change_requests(user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Dit endpoint is alleen voor verhuurders')
    rows = await fetch(
        "select id, old_email, new_email, status, created_at, confirmed_at "
        "from landlord_email_changes where landlord_id = $1 order by created_at desc limit 100",
        uuid.UUID(user['id']),
    )
    return [
        {**r, 'id': str(r['id']), 'created_at': r['created_at'].isoformat(),
         'confirmed_at': r['confirmed_at'].isoformat() if r['confirmed_at'] else None}
        for r in rows
    ]

@api_router.delete("/profile/landlord-email-change-request")
async def cancel_landlord_email_change_request(user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Dit endpoint is alleen voor verhuurders')
    result = await execute(
        "delete from landlord_email_changes where landlord_id = $1 and status = 'pending'",
        uuid.UUID(user['id']),
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail='Geen openstaand verzoek gevonden')
    return {'message': 'Verzoek geannuleerd'}

@api_router.post("/confirm-email/{token}")
async def confirm_landlord_email_change(token: str, background_tasks: BackgroundTasks):
    """Confirm landlord email change via token (public endpoint)"""
    req = await fetchrow(
        "select * from landlord_email_changes where confirmation_token = $1 and status = 'pending'",
        token,
    )
    if not req:
        raise HTTPException(status_code=404, detail='Ongeldige of verlopen bevestigingslink')

    if req['expires_at'] < datetime.now(timezone.utc):
        await execute("update landlord_email_changes set status = 'expired' where confirmation_token = $1", token)
        raise HTTPException(status_code=400, detail='Bevestigingslink is verlopen')

    now = datetime.now(timezone.utc)

    # Werkelijke e-mail leeft in auth.users, niet in profiles — admin-update nodig.
    try:
        supabase_admin.auth.admin.update_user_by_id(str(req['landlord_id']), {"email": req['new_email']})
    except Exception as e:
        logger.error(f"Kon auth-email niet updaten voor {req['landlord_id']}: {e}")
        raise HTTPException(status_code=400, detail='Het nieuwe emailadres is inmiddels in gebruik of ongeldig')

    await execute(
        "update landlord_email_changes set status = 'confirmed', confirmed_at = $2 where confirmation_token = $1",
        token, now,
    )

    background_tasks.add_task(
        send_email_notification,
        req['old_email'],
        "Emailadres gewijzigd - KotKlusser",
        f"""
        <h2>Uw emailadres is gewijzigd</h2>
        <p>Beste {req.get('landlord_name', '')},</p>
        <p>Uw emailadres is succesvol gewijzigd.</p>
        <p><strong>Oud emailadres:</strong> {req['old_email']}</p>
        <p><strong>Nieuw emailadres:</strong> {req['new_email']}</p>
        <p>Vanaf nu kunt u inloggen met uw nieuwe emailadres.</p>
        <p>Als u deze wijziging niet heeft aangevraagd, neem dan onmiddellijk contact met ons op.</p>
        <p>Met vriendelijke groet,<br>KotKlusser Team</p>
        """
    )

    return {'message': 'Emailadres succesvol gewijzigd', 'new_email': req['new_email']}

@api_router.post("/profile/request-email-change")
async def request_email_change(
    request: EmailChangeRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    """Request an email address change. Requires landlord approval."""
    if user['role'] != 'student':
        raise HTTPException(status_code=403, detail='Alleen studenten kunnen een emailwijziging aanvragen')

    pending = await fetchrow(
        "select id from email_change_requests where student_id = $1 and status = 'pending'",
        uuid.UUID(user['id']),
    )
    if pending:
        raise HTTPException(status_code=400, detail='U heeft al een openstaand wijzigingsverzoek')

    if not user.get('property_id'):
        raise HTTPException(status_code=400, detail='U moet eerst gekoppeld zijn aan een pand')

    prop = await fetchrow("select * from properties where id = $1", uuid.UUID(user['property_id']))
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')

    landlord = await fetchrow(f"select {PROFILE_FIELDS} from profiles where id = $1", prop['landlord_id'])
    if not landlord:
        raise HTTPException(status_code=404, detail='Verhuurder niet gevonden')
    landlord_auth = supabase_admin.auth.admin.get_user_by_id(str(prop['landlord_id']))
    landlord_email = landlord_auth.user.email

    request_id = uuid.uuid4()
    approval_token = generate_approval_token()
    now = datetime.now(timezone.utc)

    await execute(
        """
        insert into email_change_requests
            (id, student_id, new_email, property_id, landlord_id, approval_token, status, created_at)
        values ($1, $2, $3, $4, $5, $6, 'pending', $7)
        """,
        request_id, uuid.UUID(user['id']), request.new_email, prop['id'], prop['landlord_id'],
        approval_token, now,
    )

    approval_link = f"{APP_URL}/email-wijziging/{approval_token}"
    background_tasks.add_task(
        send_email_notification,
        landlord_email,
        f"Emailwijziging aanvraag - {user['name']}",
        f"""
        <h2>Emailwijziging aanvraag</h2>
        <p>Beste {landlord['name']},</p>
        <p>De student <strong>{user['name']}</strong> heeft een aanvraag ingediend om zijn/haar emailadres te wijzigen.</p>
        <p><strong>Huidige email:</strong> {user['email']}</p>
        <p><strong>Nieuwe email:</strong> {request.new_email}</p>
        <p><strong>Pand:</strong> {prop['name']}</p>
        <p>Klik op de onderstaande link om de aanvraag te bekijken en goed te keuren of af te wijzen:</p>
        <p><a href="{approval_link}" style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Aanvraag bekijken</a></p>
        <p>Of kopieer deze link: {approval_link}</p>
        <p>Met vriendelijke groet,<br>KotKlusser Team</p>
        """
    )

    return {
        'message': 'Wijzigingsverzoek is ingediend',
        'request_id': str(request_id),
        'new_email': request.new_email
    }

@api_router.get("/profile/email-change-requests")
async def get_my_email_change_requests(user: dict = Depends(get_current_user)):
    rows = await fetch(
        "select id, new_email, status, created_at, processed_at, rejection_reason "
        "from email_change_requests where student_id = $1 order by created_at desc limit 100",
        uuid.UUID(user['id']),
    )
    return [
        {**r, 'id': str(r['id']), 'created_at': r['created_at'].isoformat(),
         'processed_at': r['processed_at'].isoformat() if r['processed_at'] else None}
        for r in rows
    ]

@api_router.delete("/profile/email-change-request")
async def cancel_email_change_request(user: dict = Depends(get_current_user)):
    result = await execute(
        "delete from email_change_requests where student_id = $1 and status = 'pending'",
        uuid.UUID(user['id']),
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail='Geen openstaand verzoek gevonden')
    return {'message': 'Verzoek geannuleerd'}

# ============ EMAIL CHANGE APPROVAL ROUTES (FOR LANDLORDS) ============

@api_router.get("/email-change-requests/pending")
async def get_pending_email_change_requests(user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen dit bekijken')
    rows = await fetch(
        "select ecr.*, p.name as property_name from email_change_requests ecr "
        "left join properties p on p.id = ecr.property_id "
        "where ecr.landlord_id = $1 and ecr.status = 'pending' order by ecr.created_at desc limit 100",
        uuid.UUID(user['id']),
    )
    return [
        {**r, 'id': str(r['id']), 'student_id': str(r['student_id']),
         'property_id': str(r['property_id']) if r['property_id'] else None,
         'landlord_id': str(r['landlord_id']) if r['landlord_id'] else None,
         'created_at': r['created_at'].isoformat(),
         'processed_at': r['processed_at'].isoformat() if r['processed_at'] else None}
        for r in rows
    ]

@api_router.get("/email-change-requests/by-token/{token}")
async def get_email_change_by_token(token: str):
    """Public endpoint for the approval page"""
    req = await fetchrow(
        "select ecr.*, p.name as property_name from email_change_requests ecr "
        "left join properties p on p.id = ecr.property_id where ecr.approval_token = $1",
        token,
    )
    if not req:
        raise HTTPException(status_code=404, detail='Verzoek niet gevonden of link is verlopen')
    return {
        **req, 'id': str(req['id']), 'student_id': str(req['student_id']),
        'property_id': str(req['property_id']) if req['property_id'] else None,
        'landlord_id': str(req['landlord_id']) if req['landlord_id'] else None,
        'created_at': req['created_at'].isoformat(),
        'processed_at': req['processed_at'].isoformat() if req['processed_at'] else None,
        'approval_token': None,
    }

@api_router.post("/email-change-requests/{token}/process")
async def process_email_change_request(
    token: str,
    approval: EmailChangeApproval,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen dit verwerken')

    req = await fetchrow(
        "select * from email_change_requests where approval_token = $1 and status = 'pending'",
        token,
    )
    if not req:
        raise HTTPException(status_code=404, detail='Verzoek niet gevonden of al verwerkt')
    if str(req['landlord_id']) != user['id']:
        raise HTTPException(status_code=403, detail='U bent niet gemachtigd voor dit verzoek')

    now = datetime.now(timezone.utc)
    student = await fetchrow(f"select {PROFILE_FIELDS} from profiles where id = $1", req['student_id'])

    if approval.approved:
        try:
            supabase_admin.auth.admin.update_user_by_id(str(req['student_id']), {"email": req['new_email']})
        except Exception as e:
            logger.error(f"Kon auth-email niet updaten voor {req['student_id']}: {e}")
            raise HTTPException(status_code=400, detail='Het nieuwe emailadres is inmiddels in gebruik of ongeldig')

        await execute(
            "update email_change_requests set status = 'approved', processed_at = $2, processed_by = $3 "
            "where approval_token = $1",
            token, now, uuid.UUID(user['id']),
        )

        background_tasks.add_task(
            send_email_notification,
            req['new_email'],
            "Emailadres gewijzigd - KotKlusser",
            f"""
            <h2>Uw emailadres is gewijzigd</h2>
            <p>Beste {student['name'] if student else ''},</p>
            <p>Uw aanvraag om uw emailadres te wijzigen is goedgekeurd door uw verhuurder.</p>
            <p><strong>Nieuw emailadres:</strong> {req['new_email']}</p>
            <p>Vanaf nu kunt u inloggen met uw nieuwe emailadres.</p>
            <p>Met vriendelijke groet,<br>KotKlusser Team</p>
            """
        )
        return {'message': 'Emailwijziging is goedgekeurd en doorgevoerd'}
    else:
        await execute(
            "update email_change_requests set status = 'rejected', processed_at = $2, processed_by = $3, "
            "rejection_reason = $4 where approval_token = $1",
            token, now, uuid.UUID(user['id']), approval.reason,
        )

        student_email = None
        try:
            student_auth = supabase_admin.auth.admin.get_user_by_id(str(req['student_id']))
            student_email = student_auth.user.email
        except Exception as e:
            logger.error(f"Kon e-mailadres van student {req['student_id']} niet ophalen: {e}")

        if student_email:
            background_tasks.add_task(
                send_email_notification,
                student_email,
                "Emailwijziging afgewezen - KotKlusser",
                f"""
                <h2>Uw emailwijziging is afgewezen</h2>
                <p>Uw aanvraag om uw emailadres te wijzigen naar <strong>{req['new_email']}</strong> is helaas afgewezen.</p>
                {f"<p><strong>Reden:</strong> {approval.reason}</p>" if approval.reason else ""}
                <p>Neem contact op met uw verhuurder voor meer informatie.</p>
                <p>Met vriendelijke groet,<br>KotKlusser Team</p>
                """
            )
        return {'message': 'Emailwijziging is afgewezen'}

# ============ PROPERTIES ============

@api_router.put("/users/tile-config")
async def update_tile_config(data: TileConfigUpdate, user: dict = Depends(get_current_user)):
    await execute(
        "update profiles set tile_config = $2 where id = $1",
        uuid.UUID(user['id']), json.dumps(data.tile_config),
    )
    return {'success': True}


def _property_row_to_response(prop: dict, tenant_count: int) -> PropertyResponse:
    floor_count = prop.get('floor_count', 5)
    return PropertyResponse(
        id=str(prop['id']),
        name=prop['name'],
        address=prop['address'],
        landlord_id=str(prop['landlord_id']),
        join_code=prop['join_code'],
        join_link=f"{APP_URL}/join/{prop['join_code']}",
        floor_count=floor_count,
        floors=generate_floors(floor_count),
        tenant_count=tenant_count,
        created_at=prop['created_at'].isoformat(),
    )


@api_router.post("/properties", response_model=PropertyResponse)
async def create_property(prop: PropertyCreate, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen panden aanmaken')

    property_id = uuid.uuid4()
    join_code = generate_join_code()
    while await fetchval("select 1 from properties where join_code = $1", join_code):
        join_code = generate_join_code()

    floor_count = max(0, min(prop.floor_count, 50))

    row = await fetchrow(
        """
        insert into properties (id, landlord_id, name, address, join_code, floor_count)
        values ($1, $2, $3, $4, $5, $6)
        returning *
        """,
        property_id, uuid.UUID(user['id']), prop.name, prop.address, join_code, floor_count,
    )
    return _property_row_to_response(row, 0)


@api_router.get("/properties", response_model=List[PropertyResponse])
async def get_properties(user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen panden bekijken')

    rows = await fetch(
        """
        select p.*, count(pr.id) as tenant_count
        from properties p
        left join profiles pr on pr.property_id = p.id
        where p.landlord_id = $1
        group by p.id
        order by p.created_at desc
        """,
        uuid.UUID(user['id']),
    )
    return [_property_row_to_response(r, r['tenant_count']) for r in rows]


@api_router.get("/properties/{property_id}", response_model=PropertyResponse)
async def get_property(property_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen panden bekijken')

    prop = await fetchrow(
        "select * from properties where id = $1 and landlord_id = $2",
        uuid.UUID(property_id), uuid.UUID(user['id']),
    )
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')

    tenant_count = await fetchval("select count(*) from profiles where property_id = $1", uuid.UUID(property_id))
    return _property_row_to_response(prop, tenant_count)


@api_router.patch("/properties/{property_id}", response_model=PropertyResponse)
async def update_property(property_id: str, update: PropertyUpdate, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen panden bijwerken')

    prop = await fetchrow(
        "select * from properties where id = $1 and landlord_id = $2",
        uuid.UUID(property_id), uuid.UUID(user['id']),
    )
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')

    sets, args = [], []
    if update.name:
        args.append(update.name)
        sets.append(f"name = ${len(args)}")
    if update.address:
        args.append(update.address)
        sets.append(f"address = ${len(args)}")
    if update.floor_count is not None:
        args.append(max(0, min(update.floor_count, 50)))
        sets.append(f"floor_count = ${len(args)}")

    if sets:
        args.append(uuid.UUID(property_id))
        updated = await fetchrow(
            f"update properties set {', '.join(sets)} where id = ${len(args)} returning *", *args,
        )
    else:
        updated = prop

    tenant_count = await fetchval("select count(*) from profiles where property_id = $1", uuid.UUID(property_id))
    return _property_row_to_response(updated, tenant_count)


@api_router.delete("/properties/{property_id}")
async def delete_property(property_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen panden verwijderen')

    prop = await fetchrow(
        "select id from properties where id = $1 and landlord_id = $2",
        uuid.UUID(property_id), uuid.UUID(user['id']),
    )
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')

    await execute(
        "update profiles set property_id = null, room_number = null, floor = null where property_id = $1",
        uuid.UUID(property_id),
    )
    await execute("delete from properties where id = $1", uuid.UUID(property_id))
    return {'message': 'Pand succesvol verwijderd'}


@api_router.post("/properties/{property_id}/regenerate-code", response_model=PropertyResponse)
async def regenerate_join_code(property_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen codes regenereren')

    prop = await fetchrow(
        "select * from properties where id = $1 and landlord_id = $2",
        uuid.UUID(property_id), uuid.UUID(user['id']),
    )
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')

    new_code = generate_join_code()
    while await fetchval("select 1 from properties where join_code = $1", new_code):
        new_code = generate_join_code()

    updated = await fetchrow(
        "update properties set join_code = $2 where id = $1 returning *",
        uuid.UUID(property_id), new_code,
    )
    tenant_count = await fetchval("select count(*) from profiles where property_id = $1", uuid.UUID(property_id))
    return _property_row_to_response(updated, tenant_count)


@api_router.get("/properties/{property_id}/tenants", response_model=List[TenantResponse])
async def get_property_tenants(property_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen huurders bekijken')

    prop = await fetchrow(
        "select id from properties where id = $1 and landlord_id = $2",
        uuid.UUID(property_id), uuid.UUID(user['id']),
    )
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')

    rows = await fetch(
        """
        select pr.id, pr.name, pr.room_number, pr.floor, pr.created_at, au.email as email,
               count(t.id) as ticket_count
        from profiles pr
        join auth.users au on au.id = pr.id
        left join tickets t on t.created_by = pr.id
        where pr.property_id = $1
        group by pr.id, au.email
        """,
        uuid.UUID(property_id),
    )
    return [
        TenantResponse(
            id=str(r['id']), name=r['name'], email=r['email'],
            room_number=r['room_number'], floor=r['floor'],
            ticket_count=r['ticket_count'], created_at=r['created_at'].isoformat(),
        )
        for r in rows
    ]


@api_router.delete("/properties/{property_id}/tenants/{tenant_id}")
async def remove_tenant(property_id: str, tenant_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen huurders verwijderen')

    prop = await fetchrow(
        "select id from properties where id = $1 and landlord_id = $2",
        uuid.UUID(property_id), uuid.UUID(user['id']),
    )
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')

    tenant = await fetchrow(
        "select id from profiles where id = $1 and property_id = $2",
        uuid.UUID(tenant_id), uuid.UUID(property_id),
    )
    if not tenant:
        raise HTTPException(status_code=404, detail='Huurder niet gevonden in dit pand')

    await execute(
        "update profiles set property_id = null, room_number = null, floor = null where id = $1",
        uuid.UUID(tenant_id),
    )
    return {'message': 'Huurder verwijderd uit pand'}

# ============ JOIN PROPERTY (FOR STUDENTS) ============

@api_router.post("/properties/join")
async def join_property(request: JoinPropertyRequest, user: dict = Depends(get_current_user)):
    if user['role'] != 'student':
        raise HTTPException(status_code=403, detail='Alleen studenten kunnen zich aansluiten bij een pand')

    if user.get('property_id'):
        raise HTTPException(
            status_code=400,
            detail='U bent al gekoppeld aan een pand. Neem contact op met uw verhuurder om van pand te wisselen.',
        )

    prop = await fetchrow("select * from properties where join_code = $1", request.join_code.upper())
    if not prop:
        raise HTTPException(status_code=404, detail='Ongeldige join code')

    await execute(
        "update profiles set property_id = $2, room_number = $3, floor = $4 where id = $1",
        uuid.UUID(user['id']), prop['id'], request.room_number, request.floor,
    )

    return {
        'message': 'Succesvol aangesloten bij pand',
        'property_id': str(prop['id']),
        'property_name': prop['name'],
    }


@api_router.get("/properties/by-code/{join_code}")
@limiter.limit("20/minute")
async def get_property_by_code(request: Request, join_code: str):
    """Public endpoint to verify join code and get property name and floors"""
    prop = await fetchrow("select * from properties where join_code = $1", join_code.upper())
    if not prop:
        raise HTTPException(status_code=404, detail='Ongeldige join code')

    floor_count = prop.get('floor_count', 5)
    return {
        'property_id': str(prop['id']),
        'property_name': prop['name'],
        'address': prop['address'],
        'floor_count': floor_count,
        'floors': generate_floors(floor_count),
    }


@api_router.post("/properties/leave")
async def leave_property(user: dict = Depends(get_current_user)):
    if user['role'] != 'student':
        raise HTTPException(status_code=403, detail='Alleen studenten kunnen een pand verlaten')

    if not user.get('property_id'):
        raise HTTPException(status_code=400, detail='U bent niet gekoppeld aan een pand')

    await execute(
        "update profiles set property_id = null, room_number = null, floor = null where id = $1",
        uuid.UUID(user['id']),
    )
    return {'message': 'Pand verlaten'}

# ============ CONTRACTOR ROUTES ============
# Was "AANNEMERS ROUTES" — hernoemd conform de English-enum/naming-beslissing.
# contractor_landlord_links vervangt het verhuurder_ids-array-veld; e-mailadres
# leeft in auth.users, dus queries hieronder joinen daarop i.p.v. een
# gedenormaliseerd veld te lezen.

@api_router.post("/contractors/invite")
async def invite_contractor(
    data: ContractorInviteRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get('role') != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen aannemers uitnodigen')

    existing = await fetchrow(
        "select pr.id, pr.name from profiles pr join auth.users au on au.id = pr.id "
        "where au.email = $1 and pr.role = 'contractor'",
        data.email,
    )
    if existing:
        await execute(
            "insert into contractor_landlord_links (contractor_id, landlord_id) values ($1, $2) "
            "on conflict do nothing",
            existing['id'], uuid.UUID(current_user['id']),
        )
        return {'status': 'gekoppeld', 'bericht': f'{existing["name"]} is gekoppeld aan jouw account'}

    token = secrets.token_urlsafe(32)
    invite_id = uuid.uuid4()
    await execute(
        """
        insert into contractor_invites (id, token, landlord_id, email, name, specialty, used)
        values ($1, $2, $3, $4, $5, $6, false)
        """,
        invite_id, token, uuid.UUID(current_user['id']), data.email, data.name, data.specialty,
    )

    invite_url = f"{FRONTEND_URL}/register?token={token}&email={data.email}&role=contractor"
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #6366F1; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Kot<span style="color: #c7d2fe;">Klusser</span></h1>
        </div>
        <div style="background-color: #f9fafb; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <p>Dag {data.name},</p>
            <p><strong>{current_user['name']}</strong> nodigt je uit als aannemer op KotKlusser.</p>
            <p style="text-align: center; margin: 32px 0;">
                <a href="{invite_url}" style="background-color: #6366F1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                    Account aanmaken
                </a>
            </p>
            <p style="color: #94a3b8; font-size: 13px;">Deze link is éénmalig geldig.</p>
        </div>
    </div>
    """
    background_tasks.add_task(
        send_email_notification, data.email, f'{current_user["name"]} nodigt je uit op KotKlusser', html_content,
    )

    return {'status': 'verstuurd', 'bericht': f'Uitnodiging verstuurd naar {data.email}'}


@api_router.get("/contractors/search")
async def search_contractors(q: str, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen aannemers zoeken')

    pattern = f"%{q}%"
    rows = await fetch(
        """
        select pr.id, pr.name, au.email, pr.specialty, pr.region
        from profiles pr
        join auth.users au on au.id = pr.id
        where pr.role = 'contractor' and (pr.name ilike $1 or au.email ilike $1)
        limit 10
        """,
        pattern,
    )
    return [
        {'id': str(r['id']), 'name': r['name'], 'email': r['email'],
         'specialty': r.get('specialty') or '', 'region': r.get('region') or ''}
        for r in rows
    ]


@api_router.get("/contractors/my-list")
async def my_contractors(current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen hun aannemerslijst ophalen')

    rows = await fetch(
        """
        select pr.id, pr.name, au.email, pr.specialty, pr.region
        from profiles pr
        join auth.users au on au.id = pr.id
        join contractor_landlord_links cll on cll.contractor_id = pr.id
        where cll.landlord_id = $1 and pr.role = 'contractor'
        """,
        uuid.UUID(current_user['id']),
    )
    return [
        {'id': str(r['id']), 'name': r['name'], 'email': r['email'],
         'specialty': r.get('specialty') or '', 'region': r.get('region') or ''}
        for r in rows
    ]


async def _assert_landlord_owns_ticket(ticket_id: str, landlord_id: str) -> dict:
    ticket = await fetchrow("select * from tickets where id = $1", uuid.UUID(ticket_id))
    if not ticket:
        raise HTTPException(status_code=404, detail='Ticket niet gevonden')
    if not ticket.get('property_id'):
        raise HTTPException(status_code=403, detail='Geen toegang tot dit ticket')
    prop = await fetchrow("select landlord_id from properties where id = $1", ticket['property_id'])
    if not prop or str(prop['landlord_id']) != landlord_id:
        raise HTTPException(status_code=403, detail='Geen toegang tot dit ticket')
    return ticket


@api_router.post("/tickets/{ticket_id}/assign-contractor")
async def assign_contractor(
    ticket_id: str,
    data: AssignContractorRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get('role') != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen aannemers toewijzen')

    ticket = await _assert_landlord_owns_ticket(ticket_id, current_user['id'])

    contractor = await fetchrow(
        "select id, name from profiles where id = $1 and role = 'contractor'",
        uuid.UUID(data.contractor_id),
    )
    if not contractor:
        raise HTTPException(status_code=404, detail='Aannemer niet gevonden')

    await execute(
        "insert into contractor_landlord_links (contractor_id, landlord_id) values ($1, $2) "
        "on conflict do nothing",
        contractor['id'], uuid.UUID(current_user['id']),
    )

    now = datetime.now(timezone.utc)
    await execute(
        "update tickets set contractor_id = $2, contractor_assigned_at = $3, status = 'in_progress' where id = $1",
        uuid.UUID(ticket_id), contractor['id'], now,
    )

    try:
        contractor_auth = supabase_admin.auth.admin.get_user_by_id(str(contractor['id']))
        contractor_email = contractor_auth.user.email
    except Exception as e:
        logger.error(f"Kon e-mailadres van aannemer {contractor['id']} niet ophalen: {e}")
        contractor_email = None

    if contractor_email:
        klus_url = f"{FRONTEND_URL}/aannemer/klus/{ticket_id}"
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="background-color: #6366F1; padding: 24px; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Kot<span style="color: #c7d2fe;">Klusser</span></h1>
            </div>
            <div style="background-color: #f9fafb; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
                <p>Dag {contractor['name']},</p>
                <p>Je hebt een nieuwe klus ontvangen van <strong>{current_user['name']}</strong>.</p>
                <p><strong>Omschrijving:</strong> {ticket.get('description', '')[:200]}</p>
                <p style="text-align: center; margin: 32px 0;">
                    <a href="{klus_url}" style="background-color: #6366F1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                        Bekijk de klus
                    </a>
                </p>
            </div>
        </div>
        """
        background_tasks.add_task(
            send_email_notification, contractor_email, 'Nieuwe klus toegewezen op KotKlusser', html_content,
        )

    return {'status': 'ok', 'bericht': 'Aannemer toegewezen'}


@api_router.delete("/tickets/{ticket_id}/assign-contractor")
async def remove_contractor(ticket_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen aannemers verwijderen')

    await _assert_landlord_owns_ticket(ticket_id, current_user['id'])

    await execute(
        "update tickets set contractor_id = null, contractor_assigned_at = null where id = $1",
        uuid.UUID(ticket_id),
    )
    return {'status': 'ok'}


@api_router.get("/contractor/tickets")
async def my_jobs(current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'contractor':
        raise HTTPException(status_code=403, detail='Alleen aannemers kunnen klussen ophalen')

    rows = await fetch(
        """
        select t.*, p.name as property_name
        from tickets t
        left join properties p on p.id = t.property_id
        where t.contractor_id = $1
        order by t.contractor_assigned_at desc nulls last
        limit 100
        """,
        uuid.UUID(current_user['id']),
    )
    return [
        {
            'id': str(r['id']),
            'ticket_number': r['ticket_number'],
            'title': r['title'],
            'description': r['description'],
            'category': r['category'],
            'status': r['status'],
            'urgency': r['urgency'],
            'property_name': r.get('property_name') or '',
            'location': r['location'],
            'contractor_assigned_at': r['contractor_assigned_at'].isoformat() if r.get('contractor_assigned_at') else None,
        }
        for r in rows
    ]


@api_router.get("/contractor/tickets/{ticket_id}")
async def get_job_detail(ticket_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'contractor':
        raise HTTPException(status_code=403, detail='Geen toegang')

    ticket = await fetchrow(
        "select * from tickets where id = $1 and contractor_id = $2",
        uuid.UUID(ticket_id), uuid.UUID(current_user['id']),
    )
    if not ticket:
        raise HTTPException(status_code=404, detail='Klus niet gevonden of geen toegang')

    property_name = ''
    if ticket.get('property_id'):
        prop = await fetchrow("select name from properties where id = $1", ticket['property_id'])
        if prop:
            property_name = prop['name']

    photos = await fetch(
        "select storage_path from ticket_photos where ticket_id = $1 order by created_at asc",
        uuid.UUID(ticket_id),
    )

    return {
        'id': str(ticket['id']),
        'ticket_number': ticket['ticket_number'],
        'title': ticket['title'],
        'description': ticket['description'],
        'category': ticket['category'],
        'status': ticket['status'],
        'urgency': ticket['urgency'],
        'property_name': property_name,
        'location': ticket['location'],
        'photos': [_signed_photo_url(p['storage_path']) for p in photos],
        'contractor_assigned_at': ticket['contractor_assigned_at'].isoformat() if ticket.get('contractor_assigned_at') else None,
        'created_at': ticket['created_at'].isoformat(),
    }


@api_router.patch("/contractor/tickets/{ticket_id}/status")
async def update_job_status(
    ticket_id: str,
    data: ContractorStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get('role') != 'contractor':
        raise HTTPException(status_code=403, detail='Alleen aannemers kunnen klus-status updaten')

    valid_statuses = ['in_progress', 'resolved']
    if data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f'Ongeldige status. Kies uit: {valid_statuses}')

    ticket = await fetchrow(
        "select id from tickets where id = $1 and contractor_id = $2",
        uuid.UUID(ticket_id), uuid.UUID(current_user['id']),
    )
    if not ticket:
        raise HTTPException(status_code=404, detail='Klus niet gevonden of geen toegang')

    now = datetime.now(timezone.utc)
    await execute(
        "update tickets set status = $2, last_status_change = $3 where id = $1",
        uuid.UUID(ticket_id), data.status, now,
    )
    return {'status': 'ok', 'nieuwe_status': data.status}


# ============ TICKET ROUTES ============

def _ticket_row_to_response(row: dict, photos: List[str], property_name: Optional[str] = None) -> TicketResponse:
    return TicketResponse(
        id=str(row['id']),
        ticket_number=row['ticket_number'],
        title=row['title'],
        description=row['description'],
        category=row['category'],
        location=row['location'],
        urgency=row['urgency'],
        status=row['status'],
        created_by=str(row['created_by']),
        created_by_name=row.get('created_by_name', ''),
        property_id=str(row['property_id']) if row.get('property_id') else None,
        property_name=property_name,
        assigned_to=str(row['contractor_id']) if row.get('contractor_id') else None,
        assigned_to_name=row.get('contractor_name'),
        assigned_to_specialty=row.get('contractor_specialty'),
        photos=photos,
        estimated_repair_date=row['estimated_repair_date'].isoformat() if row.get('estimated_repair_date') else None,
        scheduled_date=row['scheduled_date'].isoformat() if row.get('scheduled_date') else None,
        notes=row.get('notes'),
        created_at=row['created_at'].isoformat(),
        updated_at=row['updated_at'].isoformat(),
    )


def _signed_photo_url(storage_path: str, expires_in: int = 3600) -> str:
    """
    ticket-photos is een private bucket (foto's van meldingen zijn niet voor
    het publiek bedoeld). We geven daarom nooit de rauwe storage_path terug,
    maar genereren telkens een tijdelijke signed URL (default 1u geldig) die
    alleen werkt met een geldig token. Bij elke keer dat een ticket wordt
    opgehaald, wordt hier een verse URL voor gegenereerd.
    """
    try:
        result = supabase_admin.storage.from_('ticket-photos').create_signed_url(storage_path, expires_in)
        signed = result.get('signedURL') or result.get('signedUrl') or result.get('signed_url')
        if not signed:
            return storage_path
        if signed.startswith('http'):
            return signed
        return f"{SUPABASE_URL}/storage/v1{signed}"
    except Exception:
        logging.exception(f"Kon geen signed URL genereren voor foto {storage_path}")
        return storage_path


async def _get_ticket_photos(ticket_id) -> List[str]:
    rows = await fetch(
        "select storage_path from ticket_photos where ticket_id = $1 order by created_at asc",
        ticket_id,
    )
    return [_signed_photo_url(r['storage_path']) for r in rows]


@api_router.post("/tickets", response_model=TicketResponse)
async def create_ticket(
    background_tasks: BackgroundTasks,
    ticket: TicketCreate,
    user: dict = Depends(get_current_user)
):
    ticket_id = uuid.uuid4()
    ticket_number = generate_ticket_number()
    now = datetime.now(timezone.utc)

    property_id = user.get('property_id')
    property_name = None
    if property_id:
        prop = await fetchrow("select name from properties where id = $1", uuid.UUID(property_id))
        if prop:
            property_name = prop['name']

    estimated_repair = estimate_repair_date(ticket.category, ticket.urgency)

    row = await fetchrow(
        """
        insert into tickets (id, ticket_number, title, description, category, location, urgency,
                              status, created_by, property_id, estimated_repair_date, created_at, updated_at)
        values ($1, $2, $3, $4, $5, $6, $7, 'sent', $8, $9, $10, $11, $11)
        returning *
        """,
        ticket_id, ticket_number, ticket.title, ticket.description, ticket.category, ticket.location,
        ticket.urgency, uuid.UUID(user['id']), uuid.UUID(property_id) if property_id else None,
        datetime.fromisoformat(estimated_repair), now,
    )

    background_tasks.add_task(
        send_email_notification,
        user['email'],
        f"Melding ontvangen - {ticket_number}",
        f"""
        <h2>Uw melding is ontvangen</h2>
        <p>Beste {user['name']},</p>
        <p>Uw melding <strong>{ticket.title}</strong> is succesvol ontvangen.</p>
        <p><strong>Ticketnummer:</strong> {ticket_number}</p>
        <p><strong>Categorie:</strong> {ticket.category}</p>
        <p><strong>Locatie:</strong> {ticket.location}</p>
        <p><strong>Geschatte reparatiedatum:</strong> {estimated_repair[:10]}</p>
        <p>U kunt de status van uw melding volgen in uw dashboard.</p>
        <p>Met vriendelijke groet,<br>KotKlusser Team</p>
        """
    )

    return _ticket_row_to_response({**row, 'created_by_name': user['name']}, [], property_name)


@api_router.get("/tickets", response_model=List[TicketResponse])
async def get_tickets(
    status: Optional[str] = None,
    category: Optional[str] = None,
    urgency: Optional[str] = None,
    property_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    conditions, args = [], []

    if user['role'] == 'student':
        args.append(uuid.UUID(user['id']))
        conditions.append(f"t.created_by = ${len(args)}")
    elif user['role'] == 'landlord':
        landlord_property_ids = [
            r['id'] for r in await fetch("select id from properties where landlord_id = $1", uuid.UUID(user['id']))
        ]
        if property_id and uuid.UUID(property_id) in landlord_property_ids:
            args.append(uuid.UUID(property_id))
            conditions.append(f"t.property_id = ${len(args)}")
        else:
            args.append(landlord_property_ids or [uuid.uuid4()])  # lege lijst -> onmogelijke match i.p.v. "alles"
            conditions.append(f"t.property_id = any(${len(args)}::uuid[])")

    if status:
        args.append(status)
        conditions.append(f"t.status = ${len(args)}")
    if category:
        args.append(category)
        conditions.append(f"t.category = ${len(args)}")
    if urgency:
        args.append(urgency)
        conditions.append(f"t.urgency = ${len(args)}")

    where_clause = f"where {' and '.join(conditions)}" if conditions else ""
    rows = await fetch(
        f"""
        select t.*, pr.name as created_by_name, p.name as property_name,
               c.name as contractor_name, c.specialty as contractor_specialty
        from tickets t
        join profiles pr on pr.id = t.created_by
        left join properties p on p.id = t.property_id
        left join profiles c on c.id = t.contractor_id
        {where_clause}
        order by t.created_at desc
        limit 1000
        """,
        *args,
    )

    result = []
    for r in rows:
        photos = await _get_ticket_photos(r['id'])
        result.append(_ticket_row_to_response(r, photos, r.get('property_name')))
    return result


@api_router.get("/tickets/unread-counts")
async def get_unread_counts(user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen ongelezen berichten opvragen')

    rows = await fetch(
        """
        select t.id,
               count(m.id) filter (
                   where pr2.role = 'student'
                     and (t.last_landlord_read is null or m.created_at > t.last_landlord_read)
               ) as unread_count
        from tickets t
        join properties p on p.id = t.property_id
        left join messages m on m.ticket_id = t.id
        left join profiles pr2 on pr2.id = m.sender_id
        where p.landlord_id = $1
        group by t.id, t.last_landlord_read
        having count(m.id) filter (
            where pr2.role = 'student'
              and (t.last_landlord_read is null or m.created_at > t.last_landlord_read)
        ) > 0
        """,
        uuid.UUID(user['id']),
    )
    return {str(r['id']): r['unread_count'] for r in rows}


@api_router.get("/tickets/unread-counts-student")
async def get_unread_counts_student(user: dict = Depends(get_current_user)):
    if user['role'] != 'student':
        raise HTTPException(status_code=403, detail='Alleen studenten kunnen ongelezen berichten opvragen')

    tickets = await fetch(
        "select id, last_student_read, last_status_change from tickets where created_by = $1",
        uuid.UUID(user['id']),
    )

    result = {}
    for ticket in tickets:
        ticket_id = ticket['id']
        last_read = ticket.get('last_student_read')

        if last_read:
            chat_count = await fetchval(
                "select count(*) from messages m join profiles pr on pr.id = m.sender_id "
                "where m.ticket_id = $1 and pr.role = 'landlord' and m.created_at > $2",
                ticket_id, last_read,
            )
        else:
            chat_count = await fetchval(
                "select count(*) from messages m join profiles pr on pr.id = m.sender_id "
                "where m.ticket_id = $1 and pr.role = 'landlord'",
                ticket_id,
            )

        last_status_change = ticket.get('last_status_change')
        has_update = bool(last_status_change and last_read and last_status_change > last_read)

        if chat_count > 0 or has_update:
            result[str(ticket_id)] = {'chat_count': chat_count, 'has_update': has_update}

    return result


@api_router.post("/tickets/{ticket_id}/mark-read-student")
async def mark_ticket_read_student(ticket_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'student':
        raise HTTPException(status_code=403, detail='Alleen studenten kunnen tickets als gelezen markeren')

    ticket = await fetchrow("select created_by from tickets where id = $1", uuid.UUID(ticket_id))
    if not ticket:
        raise HTTPException(status_code=404, detail='Ticket niet gevonden')
    if str(ticket['created_by']) != user['id']:
        raise HTTPException(status_code=403, detail='Geen toegang tot dit ticket')

    await execute(
        "update tickets set last_student_read = $2 where id = $1",
        uuid.UUID(ticket_id), datetime.now(timezone.utc),
    )
    return {'message': 'Gelezen'}


async def _get_ticket_with_access_check(ticket_id: str, user: dict) -> dict:
    row = await fetchrow(
        """
        select t.*, pr.name as created_by_name, p.name as property_name, p.landlord_id,
               c.name as contractor_name, c.specialty as contractor_specialty
        from tickets t
        join profiles pr on pr.id = t.created_by
        left join properties p on p.id = t.property_id
        left join profiles c on c.id = t.contractor_id
        where t.id = $1
        """,
        uuid.UUID(ticket_id),
    )
    if not row:
        raise HTTPException(status_code=404, detail='Ticket niet gevonden')

    if user['role'] == 'student' and str(row['created_by']) != user['id']:
        raise HTTPException(status_code=403, detail='Geen toegang tot dit ticket')
    if user['role'] == 'landlord' and (not row.get('landlord_id') or str(row['landlord_id']) != user['id']):
        raise HTTPException(status_code=403, detail='Geen toegang tot dit ticket')
    if user['role'] == 'contractor' and str(row.get('contractor_id')) != user['id']:
        raise HTTPException(status_code=403, detail='Geen toegang tot dit ticket')

    return row


@api_router.get("/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    row = await _get_ticket_with_access_check(ticket_id, user)
    photos = await _get_ticket_photos(row['id'])
    return _ticket_row_to_response(row, photos, row.get('property_name'))


@api_router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    update: TicketUpdate,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen tickets bijwerken')

    ticket = await _get_ticket_with_access_check(ticket_id, user)

    sets, args = [], []
    if update.status:
        args.append(update.status)
        sets.append(f"status = ${len(args)}")
    if update.scheduled_date:
        args.append(datetime.fromisoformat(update.scheduled_date))
        sets.append(f"scheduled_date = ${len(args)}")
    if update.notes is not None:
        args.append(update.notes)
        sets.append(f"notes = ${len(args)}")
    if update.status or update.scheduled_date:
        args.append(datetime.now(timezone.utc))
        sets.append(f"last_status_change = ${len(args)}")

    if sets:
        args.append(uuid.UUID(ticket_id))
        await execute(f"update tickets set {', '.join(sets)} where id = ${len(args)}", *args)

    if update.status:
        status_text = {
            'sent': 'Verstuurd',
            'received': 'Ontvangen',
            'in_progress': 'In Behandeling',
            'resolved': 'Opgelost',
        }
        try:
            student_auth = supabase_admin.auth.admin.get_user_by_id(str(ticket['created_by']))
            student_email = student_auth.user.email
        except Exception as e:
            logger.error(f"Kon e-mailadres van student {ticket['created_by']} niet ophalen: {e}")
            student_email = None

        if student_email:
            background_tasks.add_task(
                send_email_notification,
                student_email,
                f"Status update - {ticket['ticket_number']}",
                f"""
                <h2>Status van uw melding is bijgewerkt</h2>
                <p>Beste {ticket['created_by_name']},</p>
                <p>De status van uw melding <strong>{ticket['title']}</strong> is bijgewerkt naar:</p>
                <p style="font-size: 18px; font-weight: bold; color: #6366F1;">{status_text.get(update.status, update.status)}</p>
                {'<p><strong>Geplande datum:</strong> ' + update.scheduled_date[:10] + '</p>' if update.scheduled_date else ''}
                <p>Met vriendelijke groet,<br>KotKlusser Team</p>
                """
            )

    updated = await _get_ticket_with_access_check(ticket_id, user)
    photos = await _get_ticket_photos(updated['id'])
    return _ticket_row_to_response(updated, photos, updated.get('property_name'))


@api_router.post("/tickets/{ticket_id}/photos")
async def upload_photo(
    ticket_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    ticket = await _get_ticket_with_access_check(ticket_id, user)

    content = await file.read()
    ext = (file.filename or '').rsplit('.', 1)[-1].lower() if file.filename and '.' in file.filename else 'jpg'
    storage_path = f"{ticket_id}/{uuid.uuid4()}.{ext}"

    try:
        supabase_admin.storage.from_('ticket-photos').upload(
            storage_path, content, {"content-type": file.content_type or "image/jpeg"},
        )
    except Exception as e:
        logger.error(f"Foto-upload naar Supabase Storage mislukt voor ticket {ticket_id}: {e}")
        raise HTTPException(status_code=500, detail='Foto uploaden mislukt')

    await execute(
        "insert into ticket_photos (id, ticket_id, storage_path, uploaded_by) values ($1, $2, $3, $4)",
        uuid.uuid4(), uuid.UUID(ticket_id), storage_path, uuid.UUID(user['id']),
    )
    await execute("update tickets set updated_at = $2 where id = $1", uuid.UUID(ticket_id), datetime.now(timezone.utc))

    return {'message': 'Foto succesvol geüpload', 'photo': storage_path}

# ============ MESSAGE ROUTES ============

@api_router.post("/tickets/{ticket_id}/messages", response_model=MessageResponse)
async def create_message(
    ticket_id: str,
    message: MessageCreate,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    ticket = await _get_ticket_with_access_check(ticket_id, user)

    message_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    await execute(
        "insert into messages (id, ticket_id, sender_id, content, created_at) values ($1, $2, $3, $4, $5)",
        message_id, uuid.UUID(ticket_id), uuid.UUID(user['id']), message.content, now,
    )

    if user['role'] == 'landlord':
        await execute(
            "update tickets set last_landlord_response = $2, updated_at = $2 where id = $1",
            uuid.UUID(ticket_id), now,
        )

    if user['role'] == 'student':
        if ticket.get('landlord_id'):
            try:
                landlord_auth = supabase_admin.auth.admin.get_user_by_id(str(ticket['landlord_id']))
                landlord_email = landlord_auth.user.email
            except Exception as e:
                logger.error(f"Kon e-mailadres van verhuurder {ticket['landlord_id']} niet ophalen: {e}")
                landlord_email = None
            if landlord_email:
                background_tasks.add_task(
                    send_email_notification,
                    landlord_email,
                    f"Nieuw bericht - {ticket['ticket_number']}",
                    f"""
                    <h2>Nieuw bericht ontvangen</h2>
                    <p>Er is een nieuw bericht van {user['name']} voor ticket {ticket['ticket_number']}:</p>
                    <blockquote style="border-left: 3px solid #6366F1; padding-left: 10px; margin: 10px 0;">{message.content}</blockquote>
                    <p>Met vriendelijke groet,<br>KotKlusser Team</p>
                    """
                )
    else:
        try:
            student_auth = supabase_admin.auth.admin.get_user_by_id(str(ticket['created_by']))
            student_email = student_auth.user.email
        except Exception as e:
            logger.error(f"Kon e-mailadres van student {ticket['created_by']} niet ophalen: {e}")
            student_email = None
        if student_email:
            background_tasks.add_task(
                send_email_notification,
                student_email,
                f"Nieuw bericht - {ticket['ticket_number']}",
                f"""
                <h2>Nieuw bericht van verhuurder</h2>
                <p>Er is een nieuw bericht voor uw melding {ticket['ticket_number']}:</p>
                <blockquote style="border-left: 3px solid #6366F1; padding-left: 10px; margin: 10px 0;">{message.content}</blockquote>
                <p>Met vriendelijke groet,<br>KotKlusser Team</p>
                """
            )

    return MessageResponse(
        id=str(message_id), ticket_id=ticket_id, sender_id=user['id'], sender_name=user['name'],
        sender_role=user['role'], content=message.content, created_at=now.isoformat(),
    )


@api_router.get("/tickets/{ticket_id}/messages", response_model=List[MessageResponse])
async def get_messages(ticket_id: str, user: dict = Depends(get_current_user)):
    await _get_ticket_with_access_check(ticket_id, user)

    rows = await fetch(
        """
        select m.*, pr.name as sender_name, pr.role as sender_role
        from messages m
        join profiles pr on pr.id = m.sender_id
        where m.ticket_id = $1
        order by m.created_at asc
        limit 1000
        """,
        uuid.UUID(ticket_id),
    )
    return [
        MessageResponse(
            id=str(r['id']), ticket_id=str(r['ticket_id']), sender_id=str(r['sender_id']),
            sender_name=r['sender_name'], sender_role=r['sender_role'], content=r['content'],
            created_at=r['created_at'].isoformat(),
        )
        for r in rows
    ]


@api_router.post("/tickets/{ticket_id}/send-reminder")
async def send_ticket_reminder(ticket_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    if user['role'] != 'student':
        raise HTTPException(status_code=403, detail='Alleen studenten kunnen een herinnering sturen')

    ticket = await _get_ticket_with_access_check(ticket_id, user)

    if ticket['status'] == 'resolved':
        raise HTTPException(status_code=400, detail='Kan geen herinnering sturen voor een opgelost ticket')

    last_reminder = ticket.get('last_reminder_sent')
    if last_reminder:
        elapsed = datetime.now(timezone.utc) - last_reminder
        if elapsed.total_seconds() < 86400:
            remaining_hours = int((86400 - elapsed.total_seconds()) / 3600)
            remaining_minutes = int((86400 - elapsed.total_seconds() - remaining_hours * 3600) / 60)
            raise HTTPException(
                status_code=429,
                detail=f'Je hebt al een herinnering gestuurd. Probeer opnieuw over {remaining_hours}u {remaining_minutes}m.'
            )

    now = datetime.now(timezone.utc)
    await execute("update tickets set last_reminder_sent = $2 where id = $1", uuid.UUID(ticket_id), now)

    message_id = uuid.uuid4()
    reminder_content = 'Herinnering: Ik wacht nog op een reactie voor dit ticket.'
    await execute(
        "insert into messages (id, ticket_id, sender_id, content, is_reminder, created_at) "
        "values ($1, $2, $3, $4, true, $5)",
        message_id, uuid.UUID(ticket_id), uuid.UUID(user['id']), reminder_content, now,
    )

    if ticket.get('landlord_id'):
        try:
            landlord_auth = supabase_admin.auth.admin.get_user_by_id(str(ticket['landlord_id']))
            landlord_email = landlord_auth.user.email
        except Exception as e:
            logger.error(f"Kon e-mailadres van verhuurder {ticket['landlord_id']} niet ophalen: {e}")
            landlord_email = None
        if landlord_email:
            background_tasks.add_task(
                send_email_notification,
                landlord_email,
                f"Herinnering van huurder - {ticket['ticket_number']}",
                f"""
                <h2>Herinnering voor openstaande melding</h2>
                <p>Huurder <strong>{user['name']}</strong> heeft u een herinnering gestuurd voor het volgende ticket:</p>
                <p><strong>{ticket['ticket_number']}: {ticket['title']}</strong></p>
                <p>Status: {ticket.get('status', 'onbekend')}</p>
                <p>Log in op KotKlusser om dit ticket te bekijken en te beantwoorden.</p>
                <p>Met vriendelijke groet,<br>KotKlusser Team</p>
                """
            )

    return {
        'message': 'Herinnering verstuurd naar uw verhuurder',
        'reminder_message': {
            'id': str(message_id), 'ticket_id': ticket_id, 'sender_id': user['id'],
            'sender_name': user['name'], 'sender_role': 'student', 'content': reminder_content,
            'created_at': now.isoformat(), 'is_reminder': True,
        },
    }


@api_router.post("/tickets/{ticket_id}/mark-read")
async def mark_ticket_read(ticket_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen tickets als gelezen markeren')

    await execute(
        "update tickets set last_landlord_read = $2 where id = $1",
        uuid.UUID(ticket_id), datetime.now(timezone.utc),
    )
    return {'message': 'Ticket gemarkeerd als gelezen'}

# ============ STATS ROUTES ============

@api_router.get("/stats/dashboard")
async def get_dashboard_stats(property_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders hebben toegang tot statistieken')

    landlord_property_ids = [
        r['id'] for r in await fetch("select id from properties where landlord_id = $1", uuid.UUID(user['id']))
    ]

    if property_id and uuid.UUID(property_id) in landlord_property_ids:
        target_ids = [uuid.UUID(property_id)]
    else:
        target_ids = landlord_property_ids or [uuid.uuid4()]

    total = await fetchval("select count(*) from tickets where property_id = any($1::uuid[])", target_ids)
    resolved = await fetchval(
        "select count(*) from tickets where property_id = any($1::uuid[]) and status = 'resolved'", target_ids,
    )
    open_tickets = total - resolved
    urgent = await fetchval(
        "select count(*) from tickets where property_id = any($1::uuid[]) and urgency = 'urgent'", target_ids,
    )

    category_rows = await fetch(
        "select category, count(*) as count from tickets where property_id = any($1::uuid[]) "
        "group by category",
        target_ids,
    )

    return {
        'total': total,
        'open': open_tickets,
        'resolved': resolved,
        'urgent': urgent,
        'by_category': {c['category']: c['count'] for c in category_rows if c['category']},
    }


@api_router.post("/contact")
async def submit_contact_form(submission: ContactFormSubmission, background_tasks: BackgroundTasks):
    await execute(
        """
        insert into contact_submissions (id, type, name, company, email, phone, message)
        values ($1, 'contact', $2, $3, $4, $5, $6)
        """,
        uuid.uuid4(), submission.name, submission.company, submission.email, submission.phone, submission.message,
    )

    background_tasks.add_task(
        send_email_notification,
        "contact@kotklusser.be",
        f"Nieuw contactbericht van {submission.name}",
        f"""
        <h2>Nieuw contactbericht via KotKlusser</h2>
        <p><strong>Naam:</strong> {submission.name}</p>
        <p><strong>Bedrijf:</strong> {submission.company or '—'}</p>
        <p><strong>E-mail:</strong> {submission.email}</p>
        <p><strong>Telefoon:</strong> {submission.phone or '—'}</p>
        <hr />
        <p><strong>Bericht:</strong></p>
        <p>{submission.message}</p>
        """,
        text_content=(
            f"Nieuw contactbericht via KotKlusser\n\n"
            f"Naam: {submission.name}\nBedrijf: {submission.company or '—'}\n"
            f"E-mail: {submission.email}\nTelefoon: {submission.phone or '—'}\n\n"
            f"Bericht:\n{submission.message}"
        ),
    )
    return {"message": "Bericht ontvangen, we nemen spoedig contact op."}


@api_router.post("/demo-signup")
async def submit_demo_signup(submission: DemoSignupSubmission, background_tasks: BackgroundTasks):
    follow_up_at = datetime.now(timezone.utc) + timedelta(days=3)
    await execute(
        """
        insert into contact_submissions (id, type, name, email, follow_up_sent, follow_up_scheduled_at)
        values ($1, 'demo_signup', $2, $3, false, $4)
        """,
        uuid.uuid4(), submission.name, submission.email, follow_up_at,
    )

    background_tasks.add_task(
        send_email_notification,
        "contact@kotklusser.be",
        f"Nieuwe demo-aanvraag van {submission.name}",
        f"""
        <h2>Nieuwe demo-aanvraag via KotKlusser</h2>
        <p><strong>Naam:</strong> {submission.name}</p>
        <p><strong>E-mail:</strong> {submission.email}</p>
        """,
        text_content=f"Nieuwe demo-aanvraag via KotKlusser\n\nNaam: {submission.name}\nE-mail: {submission.email}",
    )
    return {"message": "Demo-aanvraag ontvangen, we nemen spoedig contact op."}


@api_router.post("/cron/send-followups")
async def cron_send_followups(request: Request):
    """Endpoint called by Railway cron to send follow-up emails."""
    cron_secret = os.environ.get("CRON_SECRET", "")
    auth_header = request.headers.get("Authorization", "")
    if cron_secret and auth_header != f"Bearer {cron_secret}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    await send_followup_emails()
    return {"message": "Follow-up emails processed successfully"}


# ============ STRIPE PAYMENTS ============
# Bewust optioneel gehouden (zie STRIPE_SECRET_KEY hierboven) — subscriptions
# horen mogelijk op platformniveau thuis i.p.v. bij deze standalone module.

@api_router.post("/payments/create-checkout-session")
async def create_checkout_session(body: CheckoutSessionRequest, current_user: dict = Depends(get_current_user)):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail='Betalingen zijn momenteel niet geconfigureerd')

    price_key = f"{body.plan}_{body.billing}"
    price_id = STRIPE_PRICE_IDS.get(price_key)
    if not price_id:
        raise HTTPException(status_code=400, detail='Ongeldig plan of factuurcyclus')

    try:
        session = await asyncio.to_thread(
            stripe.checkout.Session.create,
            payment_method_types=['card'],
            line_items=[{'price': price_id, 'quantity': 1}],
            mode='subscription',
            success_url=f"{FRONTEND_URL}/betaling/succes?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/betaling/geannuleerd",
            customer_email=current_user['email'],
            metadata={
                'user_id': current_user['id'],
                'plan': body.plan,
                'billing': body.billing,
            },
        )
        return {'checkout_url': session.url}
    except Exception as e:
        logger.error(f"Stripe checkout session error: {e}")
        raise HTTPException(status_code=500, detail='Betaling kon niet gestart worden')


@api_router.post("/payments/webhook")
async def stripe_webhook(request: Request):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail='Webhook is momenteel niet geconfigureerd')

    payload = await request.body()
    sig_header = request.headers.get('stripe-signature', '')

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail='Ongeldig payload')
    except Exception:
        raise HTTPException(status_code=400, detail='Ongeldige handtekening')

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        meta = session.get('metadata') or {}
        user_id = meta.get('user_id')
        plan = meta.get('plan')
        billing = meta.get('billing')

        if user_id:
            await execute(
                """
                update profiles set plan = $2, billing = $3, subscription_status = 'active',
                       stripe_customer_id = $4, stripe_subscription_id = $5
                where id = $1
                """,
                uuid.UUID(user_id), plan, billing, session.get('customer'), session.get('subscription'),
            )
            logger.info(f"Plan activated for user {user_id}: {plan} ({billing})")

    return {'status': 'ok'}


# Health check
@api_router.get("/")
async def root():
    return {"message": "KotKlusser API is running", "version": "2.0.0"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_db_client():
    # Cleanup sprint 5: de unique/foreign-key-constraints en indexes staan al
    # in de Postgres-migratie zelf (supabase/migrations/20260716120000_initial_schema.sql).
    # De handmatige create_index-try/except-aanpak uit de Mongo-tijd (sprint 1)
    # is dus niet meer nodig — Postgres garandeert dit op databaseniveau vanaf
    # het allereerste record, in plaats van achteraf via een losse index-aanroep
    # bij elke app-boot. We openen hier wel alvast de connection pool, zodat een
    # kapotte DATABASE_URL meteen bij startup opvalt i.p.v. bij de eerste request.
    try:
        await get_pool()
        logger.info("Postgres connection pool geopend.")
    except Exception as e:
        logger.critical(f"Kon geen verbinding maken met Postgres: {e}")
        raise


@app.on_event("shutdown")
async def shutdown_db_client():
    global db_pool
    if db_pool is not None:
        await db_pool.close()
        db_pool = None
