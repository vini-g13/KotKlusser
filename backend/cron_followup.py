"""Railway cron entry point voor de demo-signup follow-up e-mails.

Cleanup sprint 5 (2026-07): dit script bevatte voorheen een volledige,
losstaande kopie van de follow-up-logica rechtstreeks tegen MongoDB — inclusief
emoji in de e-mail (👉, 👋), wat een van de geïdentificeerde oorzaken was van
e-mails die in spam belandden (zie kotklusser-cleanup-plan.md sectie 6.3).

In plaats van die logica opnieuw te dupliceren tegen Postgres, hergebruikt dit
script nu gewoon de al-geteste `send_followup_emails()` uit server.py — één
plek voor deze logica, geen risico meer dat de twee implementaties uit elkaar
lopen (wat hier precies gebeurde: de emoji-fix in server.py was nooit
doorgevoerd in dit bestand).

Railway cron-config blijft ongewijzigd: `python cron_followup.py` in dezelfde
service/omgeving als de backend, dus dezelfde env vars (SUPABASE_URL,
DATABASE_URL, RESEND_API_KEY, ...) zijn al beschikbaar.
"""
import asyncio

from server import send_followup_emails

if __name__ == "__main__":
    asyncio.run(send_followup_emails())
