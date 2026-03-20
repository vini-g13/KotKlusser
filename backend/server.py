from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import random
import string
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'kotmelding-secret-key-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Resend Config
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# App URL for join links
APP_URL = os.environ.get('APP_URL', 'https://kot-quick.preview.emergentagent.com')

# Create the main app
app = FastAPI(title="KotMelding API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ MODELS ============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "student"  # student or landlord
    phone: Optional[str] = None
    join_code: Optional[str] = None  # For students joining a property
    room_number: Optional[str] = None
    floor: Optional[str] = None

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

class PropertyCreate(BaseModel):
    name: str
    address: str
    floor_count: int = 5  # Number of floors (0 = ground floor + N floors above)

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
    floors: List[dict] = []  # List of {value: "0", label: "Gelijkvloers"} etc
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

# Profile Management Models
class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None  # Only for landlords

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
    company_name: Optional[str] = None  # Only for landlords
    property_id: Optional[str] = None
    property_name: Optional[str] = None
    room_number: Optional[str] = None
    floor: Optional[str] = None
    created_at: str
    pending_email_change: Optional[dict] = None

class EmailChangeRequestResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    student_email: str
    new_email: str
    status: str  # pending, approved, rejected
    created_at: str
    processed_at: Optional[str] = None
    processed_by: Optional[str] = None
    rejection_reason: Optional[str] = None

class TicketCreate(BaseModel):
    title: str
    description: str
    category: str
    location: str
    urgency: str = "normaal"

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

# ============ HELPER FUNCTIONS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

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

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({'id': payload['user_id']}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=401, detail='Gebruiker niet gevonden')
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token verlopen')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Ongeldig token')

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
        'hoog': 0.75,
        'normaal': 1,
        'laag': 1.5
    }
    days = base_days.get(category, 5) * urgency_modifier.get(urgency, 1)
    estimated_date = datetime.now(timezone.utc) + timedelta(days=int(days))
    return estimated_date.isoformat()

async def send_email_notification(to_email: str, subject: str, html_content: str):
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
            "html": html_content
        }
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")

# ============ AUTH ROUTES ============

@api_router.post("/auth/register", response_model=dict)
async def register(user: UserCreate):
    existing = await db.users.find_one({'email': user.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail='Email is al geregistreerd')
    
    user_id = str(uuid.uuid4())
    user_doc = {
        'id': user_id,
        'email': user.email,
        'password': hash_password(user.password),
        'name': user.name,
        'role': user.role,
        'phone': user.phone,
        'property_id': None,
        'room_number': None,
        'floor': None,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    # If student provides join code during registration
    property_name = None
    if user.role == 'student' and user.join_code:
        prop = await db.properties.find_one({'join_code': user.join_code.upper()}, {'_id': 0})
        if not prop:
            raise HTTPException(status_code=400, detail='Ongeldige join code')
        if not user.room_number or not user.floor:
            raise HTTPException(status_code=400, detail='Kamernummer en verdieping zijn verplicht')
        user_doc['property_id'] = prop['id']
        user_doc['room_number'] = user.room_number
        user_doc['floor'] = user.floor
        property_name = prop['name']
    
    await db.users.insert_one(user_doc)
    
    # Check if landlord has properties
    has_property = False
    if user.role == 'landlord':
        prop_count = await db.properties.count_documents({'landlord_id': user_id})
        has_property = prop_count > 0
    
    token = create_token(user_id, user.role)
    return {
        'token': token,
        'user': {
            'id': user_id,
            'email': user.email,
            'name': user.name,
            'role': user.role,
            'phone': user.phone,
            'property_id': user_doc.get('property_id'),
            'property_name': property_name,
            'room_number': user_doc.get('room_number'),
            'floor': user_doc.get('floor'),
            'has_property': has_property,
            'created_at': user_doc['created_at']
        }
    }

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin):
    user = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    if not user or not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail='Ongeldige inloggegevens')
    
    # Get property name if student has one
    property_name = None
    if user.get('property_id'):
        prop = await db.properties.find_one({'id': user['property_id']}, {'_id': 0})
        if prop:
            property_name = prop['name']
    
    # Check if landlord has properties
    has_property = False
    if user['role'] == 'landlord':
        prop_count = await db.properties.count_documents({'landlord_id': user['id']})
        has_property = prop_count > 0
    
    token = create_token(user['id'], user['role'])
    return {
        'token': token,
        'user': {
            'id': user['id'],
            'email': user['email'],
            'name': user['name'],
            'role': user['role'],
            'phone': user.get('phone'),
            'property_id': user.get('property_id'),
            'property_name': property_name,
            'room_number': user.get('room_number'),
            'floor': user.get('floor'),
            'has_property': has_property,
            'created_at': user['created_at']
        }
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    property_name = None
    if user.get('property_id'):
        prop = await db.properties.find_one({'id': user['property_id']}, {'_id': 0})
        if prop:
            property_name = prop['name']
    
    has_property = False
    if user['role'] == 'landlord':
        prop_count = await db.properties.count_documents({'landlord_id': user['id']})
        has_property = prop_count > 0
    
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
        created_at=user['created_at']
    )

# ============ PROFILE MANAGEMENT ROUTES ============

@api_router.get("/profile", response_model=ProfileResponse)
async def get_profile(user: dict = Depends(get_current_user)):
    """Get current user's profile with split first/last name"""
    property_name = None
    if user.get('property_id'):
        prop = await db.properties.find_one({'id': user['property_id']}, {'_id': 0})
        if prop:
            property_name = prop['name']
    
    # Split name into first and last
    first_name, last_name = split_name(user.get('name', ''))
    
    # Check for pending email change request (for both students and landlords)
    pending_request = await db.email_change_requests.find_one(
        {'student_id': user['id'], 'status': 'pending'},
        {'_id': 0}
    )
    
    # Also check landlord email change requests
    if not pending_request and user['role'] == 'landlord':
        pending_request = await db.landlord_email_changes.find_one(
            {'landlord_id': user['id'], 'status': 'pending'},
            {'_id': 0}
        )
    
    pending_email_change = None
    if pending_request:
        pending_email_change = {
            'new_email': pending_request['new_email'],
            'created_at': pending_request['created_at'],
            'status': pending_request['status']
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
    update_data = {}
    
    # Get current first/last name
    current_first, current_last = split_name(user.get('name', ''))
    
    # Update name components if provided
    new_first = update.first_name if update.first_name is not None else current_first
    new_last = update.last_name if update.last_name is not None else current_last
    
    if update.first_name is not None or update.last_name is not None:
        update_data['name'] = combine_name(new_first, new_last)
    
    if update.phone is not None:
        update_data['phone'] = update.phone
    
    # Company name only for landlords
    if update.company_name is not None and user['role'] == 'landlord':
        update_data['company_name'] = update.company_name
    
    if update_data:
        await db.users.update_one({'id': user['id']}, {'$set': update_data})
    
    # Get updated user
    updated_user = await db.users.find_one({'id': user['id']}, {'_id': 0})
    
    property_name = None
    if updated_user.get('property_id'):
        prop = await db.properties.find_one({'id': updated_user['property_id']}, {'_id': 0})
        if prop:
            property_name = prop['name']
    
    first_name, last_name = split_name(updated_user.get('name', ''))
    
    # Check for pending email change
    pending_request = await db.email_change_requests.find_one(
        {'student_id': user['id'], 'status': 'pending'},
        {'_id': 0}
    )
    
    if not pending_request and user['role'] == 'landlord':
        pending_request = await db.landlord_email_changes.find_one(
            {'landlord_id': user['id'], 'status': 'pending'},
            {'_id': 0}
        )
    
    pending_email_change = None
    if pending_request:
        pending_email_change = {
            'new_email': pending_request['new_email'],
            'created_at': pending_request['created_at'],
            'status': pending_request['status']
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

@api_router.post("/profile/landlord-request-email-change")
async def landlord_request_email_change(
    request: LandlordEmailChangeRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    """Landlord requests email change - sends confirmation link to new email"""
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Dit endpoint is alleen voor verhuurders')
    
    # Check if email is already in use
    existing = await db.users.find_one({'email': request.new_email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail='Dit emailadres is al in gebruik')
    
    # Check for existing pending request
    pending = await db.landlord_email_changes.find_one(
        {'landlord_id': user['id'], 'status': 'pending'},
        {'_id': 0}
    )
    if pending:
        raise HTTPException(status_code=400, detail='U heeft al een openstaand wijzigingsverzoek')
    
    # Create the request
    request_id = str(uuid.uuid4())
    confirmation_token = generate_approval_token()
    now = datetime.now(timezone.utc).isoformat()
    
    request_doc = {
        'id': request_id,
        'landlord_id': user['id'],
        'landlord_name': user['name'],
        'old_email': user['email'],
        'new_email': request.new_email,
        'confirmation_token': confirmation_token,
        'status': 'pending',
        'created_at': now,
        'confirmed_at': None,
        'expires_at': (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    }
    await db.landlord_email_changes.insert_one(request_doc)
    
    # Send confirmation link to NEW email
    confirmation_link = f"{APP_URL}/bevestig-email/{confirmation_token}"
    background_tasks.add_task(
        send_email_notification,
        request.new_email,  # Send to new email
        "Bevestig uw nieuwe emailadres - KotMelding",
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
        <p>Met vriendelijke groet,<br>KotMelding Team</p>
        """
    )
    
    return {
        'message': 'Bevestigingslink is verstuurd naar het nieuwe emailadres',
        'request_id': request_id,
        'new_email': request.new_email
    }

@api_router.get("/profile/landlord-email-change-requests")
async def get_landlord_email_change_requests(user: dict = Depends(get_current_user)):
    """Get landlord's email change request history"""
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Dit endpoint is alleen voor verhuurders')
    
    requests = await db.landlord_email_changes.find(
        {'landlord_id': user['id']},
        {'_id': 0, 'confirmation_token': 0}
    ).sort('created_at', -1).to_list(100)
    return requests

@api_router.delete("/profile/landlord-email-change-request")
async def cancel_landlord_email_change_request(user: dict = Depends(get_current_user)):
    """Cancel pending landlord email change request"""
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Dit endpoint is alleen voor verhuurders')
    
    result = await db.landlord_email_changes.delete_one(
        {'landlord_id': user['id'], 'status': 'pending'}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Geen openstaand verzoek gevonden')
    return {'message': 'Verzoek geannuleerd'}

@api_router.post("/confirm-email/{token}")
async def confirm_landlord_email_change(token: str, background_tasks: BackgroundTasks):
    """Confirm landlord email change via token (public endpoint)"""
    request = await db.landlord_email_changes.find_one(
        {'confirmation_token': token, 'status': 'pending'},
        {'_id': 0}
    )
    if not request:
        raise HTTPException(status_code=404, detail='Ongeldige of verlopen bevestigingslink')
    
    # Check expiry
    if request.get('expires_at') and datetime.fromisoformat(request['expires_at'].replace('Z', '+00:00')) < datetime.now(timezone.utc):
        await db.landlord_email_changes.update_one(
            {'confirmation_token': token},
            {'$set': {'status': 'expired'}}
        )
        raise HTTPException(status_code=400, detail='Bevestigingslink is verlopen')
    
    # Check if new email is still available
    existing = await db.users.find_one({'email': request['new_email']}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail='Het nieuwe emailadres is inmiddels in gebruik')
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update landlord's email
    await db.users.update_one(
        {'id': request['landlord_id']},
        {'$set': {'email': request['new_email']}}
    )
    
    # Update request status
    await db.landlord_email_changes.update_one(
        {'confirmation_token': token},
        {'$set': {'status': 'confirmed', 'confirmed_at': now}}
    )
    
    # Send confirmation to old email
    background_tasks.add_task(
        send_email_notification,
        request['old_email'],
        "Emailadres gewijzigd - KotMelding",
        f"""
        <h2>Uw emailadres is gewijzigd</h2>
        <p>Beste {request['landlord_name']},</p>
        <p>Uw emailadres is succesvol gewijzigd.</p>
        <p><strong>Oud emailadres:</strong> {request['old_email']}</p>
        <p><strong>Nieuw emailadres:</strong> {request['new_email']}</p>
        <p>Vanaf nu kunt u inloggen met uw nieuwe emailadres.</p>
        <p>Als u deze wijziging niet heeft aangevraagd, neem dan onmiddellijk contact met ons op.</p>
        <p>Met vriendelijke groet,<br>KotMelding Team</p>
        """
    )
    
    return {
        'message': 'Emailadres succesvol gewijzigd',
        'new_email': request['new_email']
    }

@api_router.post("/profile/request-email-change")
async def request_email_change(
    request: EmailChangeRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    """Request an email address change. Requires landlord approval."""
    if user['role'] != 'student':
        raise HTTPException(status_code=403, detail='Alleen studenten kunnen een emailwijziging aanvragen')
    
    # Check if email is already in use
    existing = await db.users.find_one({'email': request.new_email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail='Dit emailadres is al in gebruik')
    
    # Check for existing pending request
    pending = await db.email_change_requests.find_one(
        {'student_id': user['id'], 'status': 'pending'},
        {'_id': 0}
    )
    if pending:
        raise HTTPException(status_code=400, detail='U heeft al een openstaand wijzigingsverzoek')
    
    # Check if student is linked to a property
    if not user.get('property_id'):
        raise HTTPException(status_code=400, detail='U moet eerst gekoppeld zijn aan een pand')
    
    # Get the property and landlord
    prop = await db.properties.find_one({'id': user['property_id']}, {'_id': 0})
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')
    
    landlord = await db.users.find_one({'id': prop['landlord_id']}, {'_id': 0})
    if not landlord:
        raise HTTPException(status_code=404, detail='Verhuurder niet gevonden')
    
    # Create the request
    request_id = str(uuid.uuid4())
    approval_token = generate_approval_token()
    now = datetime.now(timezone.utc).isoformat()
    
    request_doc = {
        'id': request_id,
        'student_id': user['id'],
        'student_name': user['name'],
        'student_email': user['email'],
        'new_email': request.new_email,
        'property_id': user['property_id'],
        'landlord_id': prop['landlord_id'],
        'approval_token': approval_token,
        'status': 'pending',
        'created_at': now,
        'processed_at': None,
        'processed_by': None,
        'rejection_reason': None
    }
    await db.email_change_requests.insert_one(request_doc)
    
    # Send notification to landlord
    approval_link = f"{APP_URL}/email-wijziging/{approval_token}"
    background_tasks.add_task(
        send_email_notification,
        landlord['email'],
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
        <p>Met vriendelijke groet,<br>KotMelding Team</p>
        """
    )
    
    return {
        'message': 'Wijzigingsverzoek is ingediend',
        'request_id': request_id,
        'new_email': request.new_email
    }

@api_router.get("/profile/email-change-requests")
async def get_my_email_change_requests(user: dict = Depends(get_current_user)):
    """Get user's email change request history"""
    requests = await db.email_change_requests.find(
        {'student_id': user['id']},
        {'_id': 0, 'approval_token': 0}
    ).sort('created_at', -1).to_list(100)
    return requests

@api_router.delete("/profile/email-change-request")
async def cancel_email_change_request(user: dict = Depends(get_current_user)):
    """Cancel pending email change request"""
    result = await db.email_change_requests.delete_one(
        {'student_id': user['id'], 'status': 'pending'}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Geen openstaand verzoek gevonden')
    return {'message': 'Verzoek geannuleerd'}

# ============ EMAIL CHANGE APPROVAL ROUTES (FOR LANDLORDS) ============

@api_router.get("/email-change-requests/pending")
async def get_pending_email_change_requests(user: dict = Depends(get_current_user)):
    """Get all pending email change requests for landlord's properties"""
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen dit bekijken')
    
    requests = await db.email_change_requests.find(
        {'landlord_id': user['id'], 'status': 'pending'},
        {'_id': 0}
    ).sort('created_at', -1).to_list(100)
    
    # Enrich with property info
    for req in requests:
        prop = await db.properties.find_one({'id': req.get('property_id')}, {'_id': 0})
        if prop:
            req['property_name'] = prop['name']
    
    return requests

@api_router.get("/email-change-requests/by-token/{token}")
async def get_email_change_by_token(token: str):
    """Get email change request by approval token (public endpoint for approval page)"""
    request = await db.email_change_requests.find_one(
        {'approval_token': token},
        {'_id': 0, 'approval_token': 0}
    )
    if not request:
        raise HTTPException(status_code=404, detail='Verzoek niet gevonden of link is verlopen')
    
    # Get property info
    prop = await db.properties.find_one({'id': request.get('property_id')}, {'_id': 0})
    if prop:
        request['property_name'] = prop['name']
    
    return request

@api_router.post("/email-change-requests/{token}/process")
async def process_email_change_request(
    token: str,
    approval: EmailChangeApproval,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    """Approve or reject an email change request"""
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen dit verwerken')
    
    request = await db.email_change_requests.find_one(
        {'approval_token': token, 'status': 'pending'},
        {'_id': 0}
    )
    if not request:
        raise HTTPException(status_code=404, detail='Verzoek niet gevonden of al verwerkt')
    
    # Verify landlord owns the property
    if request['landlord_id'] != user['id']:
        raise HTTPException(status_code=403, detail='U bent niet gemachtigd voor dit verzoek')
    
    now = datetime.now(timezone.utc).isoformat()
    
    if approval.approved:
        # Check if new email is still available
        existing = await db.users.find_one({'email': request['new_email']}, {'_id': 0})
        if existing:
            raise HTTPException(status_code=400, detail='Het nieuwe emailadres is inmiddels in gebruik')
        
        # Update student's email
        await db.users.update_one(
            {'id': request['student_id']},
            {'$set': {'email': request['new_email']}}
        )
        
        # Update request status
        await db.email_change_requests.update_one(
            {'approval_token': token},
            {'$set': {
                'status': 'approved',
                'processed_at': now,
                'processed_by': user['id']
            }}
        )
        
        # Notify student
        background_tasks.add_task(
            send_email_notification,
            request['new_email'],  # Send to new email
            "Emailadres gewijzigd - KotMelding",
            f"""
            <h2>Uw emailadres is gewijzigd</h2>
            <p>Beste {request['student_name']},</p>
            <p>Uw aanvraag om uw emailadres te wijzigen is goedgekeurd door uw verhuurder.</p>
            <p><strong>Oud emailadres:</strong> {request['student_email']}</p>
            <p><strong>Nieuw emailadres:</strong> {request['new_email']}</p>
            <p>Vanaf nu kunt u inloggen met uw nieuwe emailadres.</p>
            <p>Met vriendelijke groet,<br>KotMelding Team</p>
            """
        )
        
        return {'message': 'Emailwijziging is goedgekeurd en doorgevoerd'}
    else:
        # Reject the request
        await db.email_change_requests.update_one(
            {'approval_token': token},
            {'$set': {
                'status': 'rejected',
                'processed_at': now,
                'processed_by': user['id'],
                'rejection_reason': approval.reason
            }}
        )
        
        # Notify student
        background_tasks.add_task(
            send_email_notification,
            request['student_email'],
            "Emailwijziging afgewezen - KotMelding",
            f"""
            <h2>Uw emailwijziging is afgewezen</h2>
            <p>Beste {request['student_name']},</p>
            <p>Uw aanvraag om uw emailadres te wijzigen naar <strong>{request['new_email']}</strong> is helaas afgewezen.</p>
            {f"<p><strong>Reden:</strong> {approval.reason}</p>" if approval.reason else ""}
            <p>Neem contact op met uw verhuurder voor meer informatie.</p>
            <p>Met vriendelijke groet,<br>KotMelding Team</p>
            """
        )
        
        return {'message': 'Emailwijziging is afgewezen'}

@api_router.post("/properties", response_model=PropertyResponse)
async def create_property(prop: PropertyCreate, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen panden aanmaken')
    
    property_id = str(uuid.uuid4())
    join_code = generate_join_code()
    
    # Ensure unique join code
    while await db.properties.find_one({'join_code': join_code}):
        join_code = generate_join_code()
    
    floor_count = max(0, min(prop.floor_count, 50))  # Limit to 0-50 floors
    
    property_doc = {
        'id': property_id,
        'name': prop.name,
        'address': prop.address,
        'landlord_id': user['id'],
        'join_code': join_code,
        'floor_count': floor_count,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.properties.insert_one(property_doc)
    
    return PropertyResponse(
        id=property_id,
        name=prop.name,
        address=prop.address,
        landlord_id=user['id'],
        join_code=join_code,
        join_link=f"{APP_URL}/join/{join_code}",
        floor_count=floor_count,
        floors=generate_floors(floor_count),
        tenant_count=0,
        created_at=property_doc['created_at']
    )

@api_router.get("/properties", response_model=List[PropertyResponse])
async def get_properties(user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen panden bekijken')
    
    properties = await db.properties.find({'landlord_id': user['id']}, {'_id': 0}).to_list(1000)
    
    result = []
    for prop in properties:
        tenant_count = await db.users.count_documents({'property_id': prop['id']})
        floor_count = prop.get('floor_count', 5)
        result.append(PropertyResponse(
            id=prop['id'],
            name=prop['name'],
            address=prop['address'],
            landlord_id=prop['landlord_id'],
            join_code=prop['join_code'],
            join_link=f"{APP_URL}/join/{prop['join_code']}",
            floor_count=floor_count,
            floors=generate_floors(floor_count),
            tenant_count=tenant_count,
            created_at=prop['created_at']
        ))
    
    return result

@api_router.get("/properties/{property_id}", response_model=PropertyResponse)
async def get_property(property_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen panden bekijken')
    
    prop = await db.properties.find_one({'id': property_id, 'landlord_id': user['id']}, {'_id': 0})
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')
    
    tenant_count = await db.users.count_documents({'property_id': property_id})
    floor_count = prop.get('floor_count', 5)
    
    return PropertyResponse(
        id=prop['id'],
        name=prop['name'],
        address=prop['address'],
        landlord_id=prop['landlord_id'],
        join_code=prop['join_code'],
        join_link=f"{APP_URL}/join/{prop['join_code']}",
        floor_count=floor_count,
        floors=generate_floors(floor_count),
        tenant_count=tenant_count,
        created_at=prop['created_at']
    )

@api_router.patch("/properties/{property_id}", response_model=PropertyResponse)
async def update_property(property_id: str, update: PropertyUpdate, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen panden bijwerken')
    
    prop = await db.properties.find_one({'id': property_id, 'landlord_id': user['id']}, {'_id': 0})
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')
    
    update_data = {}
    if update.name:
        update_data['name'] = update.name
    if update.address:
        update_data['address'] = update.address
    if update.floor_count is not None:
        update_data['floor_count'] = max(0, min(update.floor_count, 50))
    
    if update_data:
        await db.properties.update_one({'id': property_id}, {'$set': update_data})
    
    updated = await db.properties.find_one({'id': property_id}, {'_id': 0})
    tenant_count = await db.users.count_documents({'property_id': property_id})
    floor_count = updated.get('floor_count', 5)
    
    return PropertyResponse(
        id=updated['id'],
        name=updated['name'],
        address=updated['address'],
        landlord_id=updated['landlord_id'],
        join_code=updated['join_code'],
        join_link=f"{APP_URL}/join/{updated['join_code']}",
        floor_count=floor_count,
        floors=generate_floors(floor_count),
        tenant_count=tenant_count,
        created_at=updated['created_at']
    )

@api_router.post("/properties/{property_id}/regenerate-code", response_model=PropertyResponse)
async def regenerate_join_code(property_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen codes regenereren')
    
    prop = await db.properties.find_one({'id': property_id, 'landlord_id': user['id']}, {'_id': 0})
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')
    
    new_code = generate_join_code()
    while await db.properties.find_one({'join_code': new_code}):
        new_code = generate_join_code()
    
    await db.properties.update_one({'id': property_id}, {'$set': {'join_code': new_code}})
    
    tenant_count = await db.users.count_documents({'property_id': property_id})
    floor_count = prop.get('floor_count', 5)
    
    return PropertyResponse(
        id=prop['id'],
        name=prop['name'],
        address=prop['address'],
        landlord_id=prop['landlord_id'],
        join_code=new_code,
        join_link=f"{APP_URL}/join/{new_code}",
        floor_count=floor_count,
        floors=generate_floors(floor_count),
        tenant_count=tenant_count,
        created_at=prop['created_at']
    )

@api_router.get("/properties/{property_id}/tenants", response_model=List[TenantResponse])
async def get_property_tenants(property_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen huurders bekijken')
    
    prop = await db.properties.find_one({'id': property_id, 'landlord_id': user['id']}, {'_id': 0})
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')
    
    tenants = await db.users.find({'property_id': property_id}, {'_id': 0, 'password': 0}).to_list(1000)
    
    result = []
    for tenant in tenants:
        ticket_count = await db.tickets.count_documents({'created_by': tenant['id']})
        result.append(TenantResponse(
            id=tenant['id'],
            name=tenant['name'],
            email=tenant['email'],
            room_number=tenant.get('room_number'),
            floor=tenant.get('floor'),
            ticket_count=ticket_count,
            created_at=tenant['created_at']
        ))
    
    return result

@api_router.delete("/properties/{property_id}/tenants/{tenant_id}")
async def remove_tenant(property_id: str, tenant_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen huurders verwijderen')
    
    prop = await db.properties.find_one({'id': property_id, 'landlord_id': user['id']}, {'_id': 0})
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')
    
    tenant = await db.users.find_one({'id': tenant_id, 'property_id': property_id}, {'_id': 0})
    if not tenant:
        raise HTTPException(status_code=404, detail='Huurder niet gevonden in dit pand')
    
    # Remove tenant from property (don't delete user, just unlink)
    await db.users.update_one(
        {'id': tenant_id},
        {'$set': {'property_id': None, 'room_number': None, 'floor': None}}
    )
    
    return {'message': 'Huurder verwijderd uit pand'}

# ============ JOIN PROPERTY (FOR STUDENTS) ============

@api_router.post("/properties/join")
async def join_property(request: JoinPropertyRequest, user: dict = Depends(get_current_user)):
    if user['role'] != 'student':
        raise HTTPException(status_code=403, detail='Alleen studenten kunnen zich aansluiten bij een pand')
    
    if user.get('property_id'):
        raise HTTPException(status_code=400, detail='U bent al gekoppeld aan een pand. Neem contact op met uw verhuurder om van pand te wisselen.')
    
    prop = await db.properties.find_one({'join_code': request.join_code.upper()}, {'_id': 0})
    if not prop:
        raise HTTPException(status_code=404, detail='Ongeldige join code')
    
    await db.users.update_one(
        {'id': user['id']},
        {'$set': {
            'property_id': prop['id'],
            'room_number': request.room_number,
            'floor': request.floor
        }}
    )
    
    return {
        'message': 'Succesvol aangesloten bij pand',
        'property_id': prop['id'],
        'property_name': prop['name']
    }

@api_router.get("/properties/by-code/{join_code}")
async def get_property_by_code(join_code: str):
    """Public endpoint to verify join code and get property name and floors"""
    prop = await db.properties.find_one({'join_code': join_code.upper()}, {'_id': 0})
    if not prop:
        raise HTTPException(status_code=404, detail='Ongeldige join code')
    
    floor_count = prop.get('floor_count', 5)
    
    return {
        'property_id': prop['id'],
        'property_name': prop['name'],
        'address': prop['address'],
        'floor_count': floor_count,
        'floors': generate_floors(floor_count)
    }

@api_router.post("/properties/leave")
async def leave_property(user: dict = Depends(get_current_user)):
    if user['role'] != 'student':
        raise HTTPException(status_code=403, detail='Alleen studenten kunnen een pand verlaten')
    
    if not user.get('property_id'):
        raise HTTPException(status_code=400, detail='U bent niet gekoppeld aan een pand')
    
    await db.users.update_one(
        {'id': user['id']},
        {'$set': {'property_id': None, 'room_number': None, 'floor': None}}
    )
    
    return {'message': 'Pand verlaten'}

# ============ TICKET ROUTES ============

@api_router.post("/tickets", response_model=TicketResponse)
async def create_ticket(
    background_tasks: BackgroundTasks,
    ticket: TicketCreate,
    user: dict = Depends(get_current_user)
):
    ticket_id = str(uuid.uuid4())
    ticket_number = generate_ticket_number()
    now = datetime.now(timezone.utc).isoformat()
    
    # Get property info if student has one
    property_id = user.get('property_id')
    property_name = None
    if property_id:
        prop = await db.properties.find_one({'id': property_id}, {'_id': 0})
        if prop:
            property_name = prop['name']
    
    ticket_doc = {
        'id': ticket_id,
        'ticket_number': ticket_number,
        'title': ticket.title,
        'description': ticket.description,
        'category': ticket.category,
        'location': ticket.location,
        'urgency': ticket.urgency,
        'status': 'verstuurd',
        'created_by': user['id'],
        'created_by_name': user['name'],
        'property_id': property_id,
        'property_name': property_name,
        'assigned_to': None,
        'photos': [],
        'estimated_repair_date': estimate_repair_date(ticket.category, ticket.urgency),
        'scheduled_date': None,
        'notes': None,
        'created_at': now,
        'updated_at': now,
        'last_landlord_response': None
    }
    await db.tickets.insert_one(ticket_doc)
    
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
        <p><strong>Geschatte reparatiedatum:</strong> {ticket_doc['estimated_repair_date'][:10]}</p>
        <p>U kunt de status van uw melding volgen in uw dashboard.</p>
        <p>Met vriendelijke groet,<br>KotMelding Team</p>
        """
    )
    
    return TicketResponse(**{k: v for k, v in ticket_doc.items() if k != 'last_landlord_response'})

@api_router.get("/tickets", response_model=List[TicketResponse])
async def get_tickets(
    status: Optional[str] = None,
    category: Optional[str] = None,
    urgency: Optional[str] = None,
    property_id: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    
    if user['role'] == 'student':
        query['created_by'] = user['id']
    elif user['role'] == 'landlord':
        # Landlord can only see tickets from their properties
        landlord_properties = await db.properties.find({'landlord_id': user['id']}, {'_id': 0}).to_list(1000)
        property_ids = [p['id'] for p in landlord_properties]
        if property_id and property_id in property_ids:
            query['property_id'] = property_id
        else:
            query['property_id'] = {'$in': property_ids}
    
    if status:
        query['status'] = status
    if category:
        query['category'] = category
    if urgency:
        query['urgency'] = urgency
    
    tickets = await db.tickets.find(query, {'_id': 0, 'last_landlord_response': 0}).sort('created_at', -1).to_list(1000)
    return [TicketResponse(**t) for t in tickets]

@api_router.get("/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({'id': ticket_id}, {'_id': 0, 'last_landlord_response': 0})
    if not ticket:
        raise HTTPException(status_code=404, detail='Ticket niet gevonden')
    
    if user['role'] == 'student' and ticket['created_by'] != user['id']:
        raise HTTPException(status_code=403, detail='Geen toegang tot dit ticket')
    
    if user['role'] == 'landlord':
        landlord_properties = await db.properties.find({'landlord_id': user['id']}, {'_id': 0}).to_list(1000)
        property_ids = [p['id'] for p in landlord_properties]
        if ticket.get('property_id') not in property_ids:
            raise HTTPException(status_code=403, detail='Geen toegang tot dit ticket')
    
    return TicketResponse(**ticket)

@api_router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    update: TicketUpdate,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen tickets bijwerken')
    
    ticket = await db.tickets.find_one({'id': ticket_id}, {'_id': 0})
    if not ticket:
        raise HTTPException(status_code=404, detail='Ticket niet gevonden')
    
    # Verify landlord owns the property
    landlord_properties = await db.properties.find({'landlord_id': user['id']}, {'_id': 0}).to_list(1000)
    property_ids = [p['id'] for p in landlord_properties]
    if ticket.get('property_id') not in property_ids:
        raise HTTPException(status_code=403, detail='Geen toegang tot dit ticket')
    
    update_data = {'updated_at': datetime.now(timezone.utc).isoformat()}
    if update.status:
        update_data['status'] = update.status
    if update.scheduled_date:
        update_data['scheduled_date'] = update.scheduled_date
    if update.notes is not None:
        update_data['notes'] = update.notes
    
    await db.tickets.update_one({'id': ticket_id}, {'$set': update_data})
    
    student = await db.users.find_one({'id': ticket['created_by']}, {'_id': 0})
    if student and update.status:
        status_text = {
            'verstuurd': 'Verstuurd',
            'ontvangen': 'Ontvangen',
            'in_behandeling': 'In Behandeling',
            'opgelost': 'Opgelost'
        }
        background_tasks.add_task(
            send_email_notification,
            student['email'],
            f"Status update - {ticket['ticket_number']}",
            f"""
            <h2>Status van uw melding is bijgewerkt</h2>
            <p>Beste {student['name']},</p>
            <p>De status van uw melding <strong>{ticket['title']}</strong> is bijgewerkt naar:</p>
            <p style="font-size: 18px; font-weight: bold; color: #6366F1;">{status_text.get(update.status, update.status)}</p>
            {'<p><strong>Geplande datum:</strong> ' + update.scheduled_date[:10] + '</p>' if update.scheduled_date else ''}
            <p>Met vriendelijke groet,<br>KotMelding Team</p>
            """
        )
    
    updated = await db.tickets.find_one({'id': ticket_id}, {'_id': 0, 'last_landlord_response': 0})
    return TicketResponse(**updated)

@api_router.post("/tickets/{ticket_id}/photos")
async def upload_photo(
    ticket_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    ticket = await db.tickets.find_one({'id': ticket_id}, {'_id': 0})
    if not ticket:
        raise HTTPException(status_code=404, detail='Ticket niet gevonden')
    
    if user['role'] == 'student' and ticket['created_by'] != user['id']:
        raise HTTPException(status_code=403, detail='Geen toegang tot dit ticket')
    
    content = await file.read()
    base64_image = base64.b64encode(content).decode('utf-8')
    photo_data = f"data:{file.content_type};base64,{base64_image}"
    
    await db.tickets.update_one(
        {'id': ticket_id},
        {'$push': {'photos': photo_data}, '$set': {'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    return {'message': 'Foto succesvol geüpload', 'photo': photo_data}

# ============ MESSAGE ROUTES ============

@api_router.post("/tickets/{ticket_id}/messages", response_model=MessageResponse)
async def create_message(
    ticket_id: str,
    message: MessageCreate,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    ticket = await db.tickets.find_one({'id': ticket_id}, {'_id': 0})
    if not ticket:
        raise HTTPException(status_code=404, detail='Ticket niet gevonden')
    
    if user['role'] == 'student' and ticket['created_by'] != user['id']:
        raise HTTPException(status_code=403, detail='Geen toegang tot dit ticket')
    
    message_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    message_doc = {
        'id': message_id,
        'ticket_id': ticket_id,
        'sender_id': user['id'],
        'sender_name': user['name'],
        'sender_role': user['role'],
        'content': message.content,
        'created_at': now
    }
    await db.messages.insert_one(message_doc)
    
    if user['role'] == 'landlord':
        await db.tickets.update_one({'id': ticket_id}, {'$set': {'last_landlord_response': now, 'updated_at': now}})
    
    if user['role'] == 'student':
        if ticket.get('property_id'):
            prop = await db.properties.find_one({'id': ticket['property_id']}, {'_id': 0})
            if prop:
                landlord = await db.users.find_one({'id': prop['landlord_id']}, {'_id': 0})
                if landlord:
                    background_tasks.add_task(
                        send_email_notification,
                        landlord['email'],
                        f"Nieuw bericht - {ticket['ticket_number']}",
                        f"""
                        <h2>Nieuw bericht ontvangen</h2>
                        <p>Er is een nieuw bericht van {user['name']} voor ticket {ticket['ticket_number']}:</p>
                        <blockquote style="border-left: 3px solid #6366F1; padding-left: 10px; margin: 10px 0;">{message.content}</blockquote>
                        <p>Met vriendelijke groet,<br>KotMelding Team</p>
                        """
                    )
    else:
        student = await db.users.find_one({'id': ticket['created_by']}, {'_id': 0})
        if student:
            background_tasks.add_task(
                send_email_notification,
                student['email'],
                f"Nieuw bericht - {ticket['ticket_number']}",
                f"""
                <h2>Nieuw bericht van verhuurder</h2>
                <p>Er is een nieuw bericht voor uw melding {ticket['ticket_number']}:</p>
                <blockquote style="border-left: 3px solid #6366F1; padding-left: 10px; margin: 10px 0;">{message.content}</blockquote>
                <p>Met vriendelijke groet,<br>KotMelding Team</p>
                """
            )
    
    return MessageResponse(**{k: v for k, v in message_doc.items()})

@api_router.get("/tickets/{ticket_id}/messages", response_model=List[MessageResponse])
async def get_messages(ticket_id: str, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({'id': ticket_id}, {'_id': 0})
    if not ticket:
        raise HTTPException(status_code=404, detail='Ticket niet gevonden')
    
    if user['role'] == 'student' and ticket['created_by'] != user['id']:
        raise HTTPException(status_code=403, detail='Geen toegang tot dit ticket')
    
    messages = await db.messages.find({'ticket_id': ticket_id}, {'_id': 0}).sort('created_at', 1).to_list(1000)
    return [MessageResponse(**m) for m in messages]

# ============ STATS ROUTES ============

@api_router.get("/stats/dashboard")
async def get_dashboard_stats(property_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders hebben toegang tot statistieken')
    
    # Get landlord's properties
    landlord_properties = await db.properties.find({'landlord_id': user['id']}, {'_id': 0}).to_list(1000)
    property_ids = [p['id'] for p in landlord_properties]
    
    # Build query
    query = {'property_id': {'$in': property_ids}}
    if property_id and property_id in property_ids:
        query = {'property_id': property_id}
    
    total = await db.tickets.count_documents(query)
    open_tickets = await db.tickets.count_documents({**query, 'status': {'$ne': 'opgelost'}})
    resolved = await db.tickets.count_documents({**query, 'status': 'opgelost'})
    urgent = await db.tickets.count_documents({**query, 'urgency': {'$in': ['hoog', 'urgent']}})
    
    pipeline = [
        {'$match': query},
        {'$group': {'_id': '$category', 'count': {'$sum': 1}}}
    ]
    categories = await db.tickets.aggregate(pipeline).to_list(100)
    
    return {
        'total': total,
        'open': open_tickets,
        'resolved': resolved,
        'urgent': urgent,
        'by_category': {c['_id']: c['count'] for c in categories if c['_id']}
    }

# ============ REMINDER SYSTEM ============

@api_router.post("/admin/send-reminders")
async def send_reminders(background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen herinneringen versturen')
    
    # Get landlord's properties
    landlord_properties = await db.properties.find({'landlord_id': user['id']}, {'_id': 0}).to_list(1000)
    property_ids = [p['id'] for p in landlord_properties]
    
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    
    stale_tickets = await db.tickets.find({
        'property_id': {'$in': property_ids},
        'status': {'$nin': ['opgelost']},
        '$or': [
            {'last_landlord_response': None},
            {'last_landlord_response': {'$lt': cutoff}}
        ]
    }, {'_id': 0}).to_list(1000)
    
    if stale_tickets:
        background_tasks.add_task(
            send_email_notification,
            user['email'],
            f"Herinnering: {len(stale_tickets)} openstaande meldingen",
            f"""
            <h2>Openstaande meldingen</h2>
            <p>Er zijn {len(stale_tickets)} meldingen die al meer dan 24 uur wachten op een reactie:</p>
            <ul>
            {''.join([f"<li>{t['ticket_number']}: {t['title']}</li>" for t in stale_tickets[:10]])}
            </ul>
            <p>Log in om deze meldingen te bekijken en op te volgen.</p>
            <p>Met vriendelijke groet,<br>KotMelding Team</p>
            """
        )
    
    return {'message': f'{len(stale_tickets)} herinneringen verstuurd'}

# Health check
@api_router.get("/")
async def root():
    return {"message": "KotMelding API is running", "version": "1.3.0"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
