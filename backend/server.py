from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
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

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    phone: Optional[str] = None
    created_at: str

class TicketCreate(BaseModel):
    title: str
    description: str
    category: str  # sanitair, elektriciteit, verwarming, internet, keuken, anders
    location: str  # kamer, badkamer, keuken, gang, etc.
    urgency: str = "normaal"  # laag, normaal, hoog, urgent

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
    """Heuristic estimation based on category and urgency"""
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
    """Send email using Resend"""
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
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user.role)
    return {
        'token': token,
        'user': {
            'id': user_id,
            'email': user.email,
            'name': user.name,
            'role': user.role,
            'phone': user.phone,
            'created_at': user_doc['created_at']
        }
    }

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin):
    user = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    if not user or not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail='Ongeldige inloggegevens')
    
    token = create_token(user['id'], user['role'])
    return {
        'token': token,
        'user': {
            'id': user['id'],
            'email': user['email'],
            'name': user['name'],
            'role': user['role'],
            'phone': user.get('phone'),
            'created_at': user['created_at']
        }
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user['id'],
        email=user['email'],
        name=user['name'],
        role=user['role'],
        phone=user.get('phone'),
        created_at=user['created_at']
    )

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
    
    ticket_doc = {
        'id': ticket_id,
        'ticket_number': ticket_number,
        'title': ticket.title,
        'description': ticket.description,
        'category': ticket.category,
        'location': ticket.location,
        'urgency': ticket.urgency,
        'status': 'ontvangen',
        'created_by': user['id'],
        'created_by_name': user['name'],
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
    
    # Send confirmation email
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
    user: dict = Depends(get_current_user)
):
    query = {}
    
    if user['role'] == 'student':
        query['created_by'] = user['id']
    
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
    
    update_data = {'updated_at': datetime.now(timezone.utc).isoformat()}
    if update.status:
        update_data['status'] = update.status
    if update.scheduled_date:
        update_data['scheduled_date'] = update.scheduled_date
    if update.notes is not None:
        update_data['notes'] = update.notes
    
    await db.tickets.update_one({'id': ticket_id}, {'$set': update_data})
    
    # Notify student
    student = await db.users.find_one({'id': ticket['created_by']}, {'_id': 0})
    if student and update.status:
        status_text = {
            'ontvangen': 'Ontvangen',
            'in_behandeling': 'In Behandeling',
            'ingepland': 'Ingepland',
            'in_uitvoering': 'In Uitvoering',
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
    
    # Update last landlord response if landlord sends message
    if user['role'] == 'landlord':
        await db.tickets.update_one({'id': ticket_id}, {'$set': {'last_landlord_response': now, 'updated_at': now}})
    
    # Notify the other party
    if user['role'] == 'student':
        landlords = await db.users.find({'role': 'landlord'}, {'_id': 0}).to_list(100)
        for landlord in landlords:
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
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders hebben toegang tot statistieken')
    
    total = await db.tickets.count_documents({})
    open_tickets = await db.tickets.count_documents({'status': {'$ne': 'opgelost'}})
    resolved = await db.tickets.count_documents({'status': 'opgelost'})
    urgent = await db.tickets.count_documents({'urgency': {'$in': ['hoog', 'urgent']}})
    
    # Category breakdown
    pipeline = [
        {'$group': {'_id': '$category', 'count': {'$sum': 1}}}
    ]
    categories = await db.tickets.aggregate(pipeline).to_list(100)
    
    return {
        'total': total,
        'open': open_tickets,
        'resolved': resolved,
        'urgent': urgent,
        'by_category': {c['_id']: c['count'] for c in categories}
    }

# ============ REMINDER SYSTEM ============

@api_router.post("/admin/send-reminders")
async def send_reminders(background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    """Send reminders for tickets without landlord response in 24h"""
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen herinneringen versturen')
    
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    
    # Find tickets without recent landlord response
    stale_tickets = await db.tickets.find({
        'status': {'$nin': ['opgelost']},
        '$or': [
            {'last_landlord_response': None},
            {'last_landlord_response': {'$lt': cutoff}}
        ]
    }, {'_id': 0}).to_list(1000)
    
    landlords = await db.users.find({'role': 'landlord'}, {'_id': 0}).to_list(100)
    
    for landlord in landlords:
        if stale_tickets:
            background_tasks.add_task(
                send_email_notification,
                landlord['email'],
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
    return {"message": "KotMelding API is running", "version": "1.0.0"}

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
