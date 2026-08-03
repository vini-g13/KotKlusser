"""
Shared Supabase-Auth test-user helper for backend/tests/* and root backend_test.py.

Replaces the pre-Supabase-migration pattern of calling the (now-removed)
POST /auth/register and POST /auth/login routes directly. The real flow
today is: Supabase Auth signUp() client-side -> POST /profile/complete-registration
with the resulting session token. This helper reproduces exactly that,
using the Supabase Admin API only to skip the email-confirmation step
(email_confirm=True) so tests don't need a real mailbox.
"""
import asyncio
import os
import uuid

import asyncpg
import requests
from dotenv import load_dotenv
from supabase import create_client

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(ROOT_DIR, '.env'))

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000').rstrip('/')

_SUPABASE_URL = os.environ['SUPABASE_URL']
_SUPABASE_ANON_KEY = os.environ['SUPABASE_ANON_KEY']
_SUPABASE_SERVICE_ROLE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']

supabase_admin = create_client(_SUPABASE_URL, _SUPABASE_SERVICE_ROLE_KEY)
supabase_anon = create_client(_SUPABASE_URL, _SUPABASE_ANON_KEY)


def create_confirmed_test_user(role: str, email: str, password: str, name: str, **extra_fields) -> tuple[str, str]:
    """
    Ensures a Supabase Auth user + KotKlusser profile exist for the given
    test account, and returns (user_id, access_token).

    Idempotent across repeated test runs: tries sign-in first (account may
    already exist from a previous run); only falls back to admin-creating
    the account if sign-in fails.
    """
    try:
        auth_response = supabase_anon.auth.sign_in_with_password({"email": email, "password": password})
    except Exception:
        supabase_admin.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "kotklusser_registration": {
                    "name": name,
                    "role": role,
                    **extra_fields,
                }
            },
        })
        auth_response = supabase_anon.auth.sign_in_with_password({"email": email, "password": password})

    user_id = auth_response.user.id
    access_token = auth_response.session.access_token

    body = {"name": name, "role": role, **extra_fields}
    resp = requests.post(
        f"{BASE_URL}/api/profile/complete-registration",
        json=body,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    # 400 "Profiel bestaat al voor deze gebruiker" is expected + fine on repeated runs.
    if resp.status_code not in (200, 400):
        raise RuntimeError(f"complete-registration failed for {email}: {resp.status_code} {resp.text}")

    return user_id, access_token


def unique_test_email(prefix: str) -> str:
    """Fresh, collision-free email for tests that need a brand-new account each run."""
    return f"{prefix}_{uuid.uuid4().hex[:8]}@test.com"


def get_contractor_invite_token(email: str) -> str:
    """contractor_invites.token is generated server-side by invite_contractor()
    and only ever sent via the invite email link — the API response never
    includes it. Read it directly from Postgres via the same DATABASE_URL
    this module already loads above (asyncpg is already a backend dependency)."""
    async def _query():
        # statement_cache_size=0 is VERPLICHT tegen Supabase's transaction pooler
        # (poort 6543) — zie server.py get_pool() voor dezelfde reden. Zonder dit
        # geeft asyncpg een DuplicatePreparedStatementError.
        conn = await asyncpg.connect(os.environ['DATABASE_URL'], statement_cache_size=0)
        try:
            return await conn.fetchval(
                "select token from contractor_invites where email = $1 order by created_at desc limit 1",
                email,
            )
        finally:
            await conn.close()
    return asyncio.run(_query())
