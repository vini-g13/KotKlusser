import asyncio
import os
import logging
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'contact@kotklusser.be')

async def send_followup_emails():
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured, skipping follow-up emails")
        return

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    try:
        now = datetime.now(timezone.utc)
        pending = await db.contact_submissions.find({
            "type": "demo_signup",
            "follow_up_sent": False,
            "follow_up_scheduled_at": {"$lte": now.isoformat()}
        }).to_list(1000)

        logger.info(f"Found {len(pending)} pending follow-up emails")

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
                            👉 Ontdek KotKlusser verder
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

            try:
                import resend
                resend.api_key = RESEND_API_KEY
                params = {
                    "from": SENDER_EMAIL,
                    "to": [signup['email']],
                    "subject": "Nog even over KotKlusser 👋",
                    "html": html_content
                }
                resend.Emails.send(params)

                await db.contact_submissions.update_one(
                    {"id": signup['id']},
                    {"$set": {
                        "follow_up_sent": True,
                        "follow_up_sent_at": now.isoformat()
                    }}
                )
                logger.info(f"Follow-up email sent to {signup['email']}")

            except Exception as e:
                logger.error(f"Failed to send follow-up to {signup['email']}: {e}")

    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(send_followup_emails())
