# Backend Dedup + Test Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize KotKlusser's two stale backend integration-test files to Supabase Auth, then use that restored test suite to safely extract a `require_role()` FastAPI dependency (replacing 31 duplicated inline role-checks) and a `get_landlord_property_ids()` helper (replacing 2 duplicated queries) in `backend/server.py`.

**Architecture:** Fase 1 builds one shared pytest fixture module (`backend/tests/conftest.py`) that creates/confirms Supabase Auth test users via the Admin API and completes their `profiles` row via the real `POST /profile/complete-registration` route — the exact flow the production frontend uses. Both existing test files are migrated onto it. Fase 2 then adds two small, pure-Python helpers to `server.py` and mechanically migrates each of the 31 role-check call sites and 2 duplicated-query call sites onto them, verifying after each group by re-running the now-working test suite (plus manual curl smoke checks for the two contractor route groups, which neither test file exercises).

**Tech Stack:** Python 3.12, FastAPI, `supabase-py` 2.10.0 (`gotrue` 2.12.4 admin/auth clients), pytest, `requests`, asyncpg — all already in `requirements.txt`, no new dependencies.

## Global Constraints

- Every HTTP 403 `detail` string touched in Fase 2 must remain byte-identical to what it is today — this is a pure internal refactor, zero user-facing/frontend-facing behavior change.
- `require_role()` supports exactly one role per call — no multi-role/permission-table support (confirmed: no route today allows more than one role).
- No new pip packages. `supabase-py`'s `auth.admin.create_user(...)` / `auth.sign_in_with_password(...)` accept plain `dict` bodies (the underlying `gotrue` types are `TypedDict`s, not pydantic models — verified locally).
- All tests in this plan are integration-style against a **locally running backend** (`uvicorn server:app --reload --host 0.0.0.0 --port 8000`, run from `backend/`) with `backend/.env` fully populated (already true — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `CORS_ORIGINS`, `SENDER_EMAIL`, `APP_URL` are all filled in). Every "Run tests" step in this plan assumes that server is running in another terminal.
- Base env var for test target: `REACT_APP_BACKEND_URL`, defaulting to `http://localhost:8000` if unset — matches the existing convention in `backend/tests/test_floor_configuration.py:10`.

---

## File Structure

- **Create:** `backend/tests/conftest.py` — shared Supabase-Auth test-user fixture factory, used by every file under `backend/tests/`.
- **Create:** `backend/tests/test_conftest_auth.py` — isolated smoke tests proving the new fixture works, independent of the (currently broken) legacy suites.
- **Modify:** `backend/tests/test_floor_configuration.py` — swap `landlord_token`/`authenticated_landlord`/`new_student_token`/`authenticated_student` fixtures and the one inline `/auth/register` call in `test_join_floor_validation` onto the new helper.
- **Modify:** `backend_test.py` (repo root) — fix hardcoded `base_url` default, replace `test_register_student`/`test_register_landlord`/`test_login_student` bodies to use the new helper instead of the non-existent `/auth/register`/`/auth/login` routes.
- **Create:** `backend/tests/test_require_role.py` — fast, isolated unit test for the new dependency (no live server / DB needed).
- **Modify:** `backend/server.py` — add `require_role()` (after `get_current_user`, ~line 515) and `get_landlord_property_ids()` (just above `get_tickets`, ~line 1903); migrate all 31 role-check call sites and both duplicated-query call sites onto them.

---

### Task 1: Supabase test-auth fixture + isolated smoke test

**Files:**
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_conftest_auth.py`

**Interfaces:**
- Produces: `create_confirmed_test_user(role: str, email: str, password: str, name: str, **extra_fields) -> tuple[str, str]` — returns `(user_id, access_token)`. Later tasks (2, 3) import and call this directly.
- Produces: module-level `BASE_URL: str` in `conftest.py`, importable by other test files.

- [ ] **Step 1: Write `backend/tests/conftest.py`**

```python
"""
Shared Supabase-Auth test-user helper for backend/tests/* and root backend_test.py.

Replaces the pre-Supabase-migration pattern of calling the (now-removed)
POST /auth/register and POST /auth/login routes directly. The real flow
today is: Supabase Auth signUp() client-side -> POST /profile/complete-registration
with the resulting session token. This helper reproduces exactly that,
using the Supabase Admin API only to skip the email-confirmation step
(email_confirm=True) so tests don't need a real mailbox.
"""
import os
import uuid

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
```

- [ ] **Step 2: Write the smoke test — `backend/tests/test_conftest_auth.py`**

```python
"""Isolated smoke tests for the Supabase test-auth helper in conftest.py.
Run these first when touching conftest.py — they don't depend on the
(currently being migrated) legacy suites."""
import requests

from conftest import create_confirmed_test_user, unique_test_email, BASE_URL


def test_create_confirmed_landlord_and_call_auth_me():
    email = unique_test_email("test_conftest_landlord")
    user_id, token = create_confirmed_test_user(
        role="landlord", email=email, password="test123", name="Conftest Landlord Test"
    )
    assert user_id
    assert token

    resp = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == user_id
    assert resp.json()["role"] == "landlord"


def test_create_confirmed_student_and_call_auth_me():
    email = unique_test_email("test_conftest_student")
    user_id, token = create_confirmed_test_user(
        role="student", email=email, password="test123", name="Conftest Student Test"
    )
    resp = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["role"] == "student"


def test_create_confirmed_contractor_and_call_auth_me():
    email = unique_test_email("test_conftest_contractor")
    user_id, token = create_confirmed_test_user(
        role="contractor", email=email, password="test123", name="Conftest Contractor Test"
    )
    resp = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["role"] == "contractor"


def test_repeated_call_is_idempotent():
    """Second call for the same email must not raise, and must return a valid session."""
    email = unique_test_email("test_conftest_idempotent")
    create_confirmed_test_user(role="student", email=email, password="test123", name="Idempotent Test")
    user_id_2, token_2 = create_confirmed_test_user(role="student", email=email, password="test123", name="Idempotent Test")
    assert user_id_2
    assert token_2
```

- [ ] **Step 3: Run it to verify it currently fails (no local server yet, or to confirm baseline)**

Start the backend in another terminal first:
```bash
cd backend && venv/Scripts/python.exe -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```
Then run:
```bash
cd backend && venv/Scripts/python.exe -m pytest tests/test_conftest_auth.py -v
```
Expected: all 4 tests **PASS** (this is new code with no prior broken state to compare against — "verify it fails first" doesn't apply here since there's no pre-existing implementation to be red against; treat a clean pass as the acceptance signal). If any test fails, the error will point at either a Supabase credentials issue (check `backend/.env`) or a `complete-registration` response body — fix before proceeding.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/conftest.py backend/tests/test_conftest_auth.py
git commit -m "test: add Supabase Auth test-user fixture + smoke tests"
```

---

### Task 2: Migrate `test_floor_configuration.py` to the new fixture

**Files:**
- Modify: `backend/tests/test_floor_configuration.py`

**Interfaces:**
- Consumes: `create_confirmed_test_user`, `unique_test_email`, `BASE_URL` from Task 1's `conftest.py` (same directory, so a plain `from conftest import ...` resolves via pytest's rootdir insertion — no path changes needed since both files live in `backend/tests/`).

- [ ] **Step 1: Replace the landlord fixtures (lines 10-57)**

Old:
```python
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from main agent
TEST_LANDLORD = {
    "email": "test_landlord_floor@test.com",
    "password": "test123"
}
TEST_STUDENT = {
    "email": "test_student_floor@test.com",
    "password": "test123"
}
EXISTING_JOIN_CODE = "VXSJD2"


class TestFloorConfigurationBackend:
    """Tests for floor configuration feature in backend"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def landlord_token(self, api_client):
        """Get landlord auth token - try login first, register if needed"""
        # Try login
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=TEST_LANDLORD)
        if response.status_code == 200:
            return response.json()["token"]
        
        # Register new landlord if login fails
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_LANDLORD["email"],
            "password": TEST_LANDLORD["password"],
            "name": "Test Landlord Floor",
            "role": "landlord"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Could not authenticate landlord")
    
    @pytest.fixture(scope="class")
    def authenticated_landlord(self, api_client, landlord_token):
        """Session with landlord auth header"""
        api_client.headers.update({"Authorization": f"Bearer {landlord_token}"})
        return api_client
```

New:
```python
from conftest import create_confirmed_test_user, unique_test_email, BASE_URL

# Test credentials from main agent
TEST_LANDLORD = {
    "email": "test_landlord_floor@test.com",
    "password": "test123"
}
TEST_STUDENT = {
    "email": "test_student_floor@test.com",
    "password": "test123"
}
EXISTING_JOIN_CODE = "VXSJD2"


class TestFloorConfigurationBackend:
    """Tests for floor configuration feature in backend"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def landlord_token(self, api_client):
        """Get landlord auth token via the Supabase test-auth helper"""
        _, token = create_confirmed_test_user(
            role="landlord",
            email=TEST_LANDLORD["email"],
            password=TEST_LANDLORD["password"],
            name="Test Landlord Floor",
        )
        return token
    
    @pytest.fixture(scope="class")
    def authenticated_landlord(self, api_client, landlord_token):
        """Session with landlord auth header"""
        api_client.headers.update({"Authorization": f"Bearer {landlord_token}"})
        return api_client
```

Note: `BASE_URL` is now imported from `conftest`, not redefined — remove the old `os.environ.get(...)` line entirely (shown already omitted above). Keep the existing `import pytest`, `import requests`, `import os`, `import uuid` at the top of the file as-is; only add the new `from conftest import ...` line among them.

- [ ] **Step 2: Replace the student fixtures (lines ~230-244) in `TestStudentJoinWithFloorDropdown`**

Old:
```python
    @pytest.fixture(scope="class")
    def new_student_token(self, api_client):
        """Register a new test student"""
        unique_email = f"test_floor_student_{uuid.uuid4().hex[:8]}@test.com"
        
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "test123",
            "name": "Test Floor Student",
            "role": "student"
        })
        
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip(f"Could not register student: {response.text}")
```

New:
```python
    @pytest.fixture(scope="class")
    def new_student_token(self, api_client):
        """Register a new test student via the Supabase test-auth helper"""
        _, token = create_confirmed_test_user(
            role="student",
            email=unique_test_email("test_floor_student"),
            password="test123",
            name="Test Floor Student",
        )
        return token
```

- [ ] **Step 3: Replace the inline `/auth/register` call in `test_join_floor_validation` (lines ~280-302)**

Old:
```python
    # Test 11: Join with invalid floor value should still work (backend accepts any string)
    def test_join_floor_validation(self, api_client):
        """Test that floor is properly stored (string value)"""
        # Register another student
        unique_email = f"test_floor_val_{uuid.uuid4().hex[:8]}@test.com"
        
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "test123",
            "name": "Test Floor Validation",
            "role": "student",
            "join_code": EXISTING_JOIN_CODE,
            "room_number": "TEST102",
            "floor": "2"  # Using dropdown value
        })
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        assert data["user"]["floor"] == "2"
        assert data["user"]["property_name"] == "Test Gebouw"
        
        print(f"Student registered with floor value '2' successfully")
```

New (`complete-registration` supports `join_code`/`room_number`/`floor` directly, `server.py:678-683`, so the join-on-registration behavior is preserved 1:1):
```python
    # Test 11: Join with invalid floor value should still work (backend accepts any string)
    def test_join_floor_validation(self, api_client):
        """Test that floor is properly stored (string value)"""
        _, token = create_confirmed_test_user(
            role="student",
            email=unique_test_email("test_floor_val"),
            password="test123",
            name="Test Floor Validation",
            join_code=EXISTING_JOIN_CODE,
            room_number="TEST102",
            floor="2",  # Using dropdown value
        )

        response = api_client.get(
            f"{BASE_URL}/api/profile", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Profile fetch failed: {response.text}"

        data = response.json()
        assert data["floor"] == "2"
        assert data["property_name"] == "Test Gebouw"

        print(f"Student registered with floor value '2' successfully")
```

- [ ] **Step 4: Run the migrated suite**

```bash
cd backend && venv/Scripts/python.exe -m pytest tests/test_floor_configuration.py -v
```
Expected: all 11 tests **PASS**. (`EXISTING_JOIN_CODE = "VXSJD2"` and property name `"Test Gebouw"` must already exist in your Supabase database from prior manual testing — if `test_get_property_by_code_returns_floors` fails with 404, create that property once manually via the running app first, then re-run.)

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_floor_configuration.py
git commit -m "test: migrate test_floor_configuration.py to Supabase Auth fixtures"
```

---

### Task 3: Migrate root `backend_test.py`

**Files:**
- Modify: `backend_test.py`

**Interfaces:**
- Consumes: `create_confirmed_test_user`, `unique_test_email` from `backend/tests/conftest.py` — imported via `sys.path` insertion since this file lives at repo root, one level up from `backend/tests/`.

- [ ] **Step 1: Fix imports and the hardcoded `base_url` default (lines 1-16)**

Old:
```python
#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for KotKlusser System
Tests all authentication, ticket management, messaging, and stats endpoints
"""

import requests
import sys
import json
from datetime import datetime
import base64
import io

class KotKlusserAPITester:
    def __init__(self, base_url="https://kot-quick.preview.emergentagent.com/api"):
        self.base_url = base_url
```

New:
```python
#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for KotKlusser System
Tests all authentication, ticket management, messaging, and stats endpoints
"""

import os
import requests
import sys
import json
from datetime import datetime
import base64
import io

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', 'tests'))
from conftest import create_confirmed_test_user, unique_test_email  # noqa: E402

DEFAULT_BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000').rstrip('/') + '/api'


class KotKlusserAPITester:
    def __init__(self, base_url=DEFAULT_BASE_URL):
        self.base_url = base_url
```

- [ ] **Step 2: Replace `test_register_student` (lines 82-102)**

Old:
```python
    def test_register_student(self):
        """Test student registration"""
        test_data = {
            "email": f"student_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123!",
            "name": "Test Student",
            "role": "student",
            "phone": "+32 123 456 789"
        }
        
        status, response = self.make_request('POST', 'auth/register', test_data)
        success = status == 200 and 'token' in response and 'user' in response
        
        if success:
            self.student_token = response['token']
            self.student_user = response['user']
            self.log_test("Student Registration", True, f"User ID: {self.student_user['id']}")
        else:
            self.log_test("Student Registration", False, f"Status {status}", response)
        
        return success
```

New:
```python
    def test_register_student(self):
        """Test student registration via Supabase Auth"""
        email = unique_test_email("student")
        try:
            user_id, token = create_confirmed_test_user(
                role="student", email=email, password="TestPass123!", name="Test Student",
                phone="+32 123 456 789",
            )
            self.student_token = token
            self.student_user = {"id": user_id, "email": email, "name": "Test Student"}
            self.log_test("Student Registration", True, f"User ID: {user_id}")
            return True
        except Exception as e:
            self.log_test("Student Registration", False, str(e))
            return False
```

- [ ] **Step 3: Replace `test_register_landlord` (lines 104-124)**

Old:
```python
    def test_register_landlord(self):
        """Test landlord registration"""
        test_data = {
            "email": f"landlord_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123!",
            "name": "Test Landlord",
            "role": "landlord",
            "phone": "+32 987 654 321"
        }
        
        status, response = self.make_request('POST', 'auth/register', test_data)
        success = status == 200 and 'token' in response and 'user' in response
        
        if success:
            self.landlord_token = response['token']
            self.landlord_user = response['user']
            self.log_test("Landlord Registration", True, f"User ID: {self.landlord_user['id']}")
        else:
            self.log_test("Landlord Registration", False, f"Status {status}", response)
        
        return success
```

New:
```python
    def test_register_landlord(self):
        """Test landlord registration via Supabase Auth"""
        email = unique_test_email("landlord")
        try:
            user_id, token = create_confirmed_test_user(
                role="landlord", email=email, password="TestPass123!", name="Test Landlord",
                phone="+32 987 654 321",
            )
            self.landlord_token = token
            self.landlord_user = {"id": user_id, "email": email, "name": "Test Landlord"}
            self.log_test("Landlord Registration", True, f"User ID: {user_id}")
            return True
        except Exception as e:
            self.log_test("Landlord Registration", False, str(e))
            return False
```

- [ ] **Step 4: Replace `test_login_student` (lines 126-145)**

The backend no longer has a `/auth/login` route — logging back in happens directly against Supabase. Re-purpose this test to verify that: it now confirms a *second* `create_confirmed_test_user` call for the same account (simulating "log back in") still returns a working token.

Old:
```python
    def test_login_student(self):
        """Test student login"""
        if not self.student_user:
            self.log_test("Student Login", False, "No student user to login")
            return False
        
        test_data = {
            "email": self.student_user['email'],
            "password": "TestPass123!"
        }
        
        status, response = self.make_request('POST', 'auth/login', test_data)
        success = status == 200 and 'token' in response
        
        if success:
            self.log_test("Student Login", True, "Login successful")
        else:
            self.log_test("Student Login", False, f"Status {status}", response)
        
        return success
```

New:
```python
    def test_login_student(self):
        """Test student re-authentication (Supabase sign-in for an already-confirmed account)"""
        if not self.student_user:
            self.log_test("Student Login", False, "No student user to login")
            return False

        try:
            _, token = create_confirmed_test_user(
                role="student", email=self.student_user['email'], password="TestPass123!",
                name="Test Student",
            )
            success = bool(token)
            self.log_test("Student Login", success, "Login successful" if success else "No token returned")
            return success
        except Exception as e:
            self.log_test("Student Login", False, str(e))
            return False
```

- [ ] **Step 5: Run the full suite**

```bash
python backend_test.py
```
Expected: `📊 TEST RESULTS SUMMARY` printed at the end with a success rate. Contractor-related functionality isn't covered by this file (no `test_contractor_*` methods exist) — that's fine, it's out of scope for this task and handled by manual smoke checks in Tasks 8-9. Every other listed test (properties, tickets, messaging, profile/email-change, dashboard stats, security/role-restriction checks) must pass. Investigate and fix any failure before moving on — a failure here means the auth-bootstrap migration itself is broken, not yet the require_role refactor (that hasn't started).

- [ ] **Step 6: Commit**

```bash
git add backend_test.py
git commit -m "test: migrate backend_test.py auth bootstrap to Supabase Auth"
```

---

### Task 4: Add `require_role()` and `get_landlord_property_ids()` helpers

**Files:**
- Modify: `backend/server.py:514-515` (insert `require_role` after `get_current_user`)
- Modify: `backend/server.py:1903` (insert `get_landlord_property_ids` above `get_tickets`)
- Create: `backend/tests/test_require_role.py`

**Interfaces:**
- Produces: `require_role(role: str, detail: str)` — a dependency factory. Tasks 5-10 replace `Depends(get_current_user)` + inline role-check with `Depends(require_role(role, detail))` at all 31 call sites.
- Produces: `async def get_landlord_property_ids(landlord_id: str) -> list` — Task 10 replaces both duplicated inline queries with a call to this.

- [ ] **Step 1: Write the failing test — `backend/tests/test_require_role.py`**

```python
"""
Isolated unit test for require_role() — no live server or DB needed, since
require_role is pure Python logic layered on top of an already-resolved
user dict (FastAPI's Depends(get_current_user) is bypassed entirely here
by calling the inner checker coroutine directly).
"""
import asyncio

import pytest
from fastapi import HTTPException

from server import require_role


def test_require_role_allows_matching_role():
    checker = require_role("landlord", "Alleen verhuurders mogen dit doen")
    user = {"id": "abc", "role": "landlord"}
    result = asyncio.run(checker(user=user))
    assert result == user


def test_require_role_rejects_non_matching_role():
    checker = require_role("landlord", "Alleen verhuurders mogen dit doen")
    user = {"id": "abc", "role": "student"}
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(checker(user=user))
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Alleen verhuurders mogen dit doen"


def test_require_role_uses_the_exact_detail_passed_in():
    checker = require_role("student", "Alleen studenten kunnen zich aansluiten bij een pand")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(checker(user={"id": "xyz", "role": "contractor"}))
    assert exc_info.value.detail == "Alleen studenten kunnen zich aansluiten bij een pand"
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd backend && venv/Scripts/python.exe -m pytest tests/test_require_role.py -v
```
Expected: FAIL with `ImportError: cannot import name 'require_role' from 'server'`.

- [ ] **Step 3: Implement `require_role()` — insert into `backend/server.py` right after `get_current_user`**

Old (`server.py:512-517`):
```python
        raise HTTPException(status_code=401, detail='Gebruikersprofiel niet gevonden')

    return _profile_row_to_dict(profile, email)


def generate_join_code() -> str:
```

New:
```python
        raise HTTPException(status_code=401, detail='Gebruikersprofiel niet gevonden')

    return _profile_row_to_dict(profile, email)


def require_role(role: str, detail: str):
    """Dependency factory: only allows the given single role through, else
    raises 403 with the exact detail text the call site provides. Keeps
    every route's existing, route-specific error message intact — this is
    a pure refactor of *where* the check happens, not *what* it says."""
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user['role'] != role:
            raise HTTPException(status_code=403, detail=detail)
        return user
    return checker


def generate_join_code() -> str:
```

- [ ] **Step 4: Run the test again to verify it passes**

```bash
cd backend && venv/Scripts/python.exe -m pytest tests/test_require_role.py -v
```
Expected: all 3 tests **PASS**.

- [ ] **Step 5: Implement `get_landlord_property_ids()` — insert just above `get_tickets`**

Old (`server.py:1901-1905`):
```python
    return _ticket_row_to_response({**row, 'created_by_name': user['name']}, [], property_name)


@api_router.get("/tickets", response_model=List[TicketResponse])
async def get_tickets(
```

New:
```python
    return _ticket_row_to_response({**row, 'created_by_name': user['name']}, [], property_name)


async def get_landlord_property_ids(landlord_id: str) -> list:
    """Shared by get_tickets and get_dashboard_stats — both needed the same
    'all property IDs owned by this landlord' query."""
    rows = await fetch("select id from properties where landlord_id = $1", uuid.UUID(landlord_id))
    return [r['id'] for r in rows]


@api_router.get("/tickets", response_model=List[TicketResponse])
async def get_tickets(
```

This helper isn't independently unit-testable without mocking `fetch()` (no mocking convention exists anywhere in this codebase's tests — all existing tests are live-integration-style against a running server + real DB). It's verified in Task 10 when it gets wired into its two call sites, via the same live test suites from Tasks 2-3.

- [ ] **Step 6: `py_compile` check that `server.py` still imports cleanly**

```bash
cd backend && venv/Scripts/python.exe -m py_compile server.py && venv/Scripts/python.exe -c "import server; print('IMPORT OK')"
```
Expected: `IMPORT OK` (plus the existing harmless `SENTRY_DSN niet ingesteld` warning).

- [ ] **Step 7: Commit**

```bash
git add backend/server.py backend/tests/test_require_role.py
git commit -m "feat: add require_role() dependency and get_landlord_property_ids() helper"
```

---

### Task 5: Migrate Group 1 — profile / email-change routes (6 sites)

**Files:**
- Modify: `backend/server.py` (lines 874-1012, 1098-1144 — see individual hunks)

**Interfaces:**
- Consumes: `require_role` from Task 4.

- [ ] **Step 1: `landlord_request_email_change` (line 878-881)**

Old:
```python
@api_router.post("/profile/landlord-request-email-change")
async def landlord_request_email_change(
    request: LandlordEmailChangeRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Dit endpoint is alleen voor verhuurders')

    pending = await fetchrow(
```

New:
```python
@api_router.post("/profile/landlord-request-email-change")
async def landlord_request_email_change(
    request: LandlordEmailChangeRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_role('landlord', 'Dit endpoint is alleen voor verhuurders'))
):
    pending = await fetchrow(
```

- [ ] **Step 2: `get_landlord_email_change_requests` (line 931-934)**

Old:
```python
@api_router.get("/profile/landlord-email-change-requests")
async def get_landlord_email_change_requests(user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Dit endpoint is alleen voor verhuurders')
    rows = await fetch(
```

New:
```python
@api_router.get("/profile/landlord-email-change-requests")
async def get_landlord_email_change_requests(
    user: dict = Depends(require_role('landlord', 'Dit endpoint is alleen voor verhuurders'))
):
    rows = await fetch(
```

- [ ] **Step 3: `cancel_landlord_email_change_request` (line 946-949)**

Old:
```python
@api_router.delete("/profile/landlord-email-change-request")
async def cancel_landlord_email_change_request(user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Dit endpoint is alleen voor verhuurders')
    result = await execute(
```

New:
```python
@api_router.delete("/profile/landlord-email-change-request")
async def cancel_landlord_email_change_request(
    user: dict = Depends(require_role('landlord', 'Dit endpoint is alleen voor verhuurders'))
):
    result = await execute(
```

- [ ] **Step 4: `request_email_change` (line 1004-1012)**

Old:
```python
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
```

New:
```python
@api_router.post("/profile/request-email-change")
async def request_email_change(
    request: EmailChangeRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_role('student', 'Alleen studenten kunnen een emailwijziging aanvragen'))
):
    """Request an email address change. Requires landlord approval."""
    pending = await fetchrow(
```

- [ ] **Step 5: `get_pending_email_change_requests` (line 1098-1101)**

Old:
```python
@api_router.get("/email-change-requests/pending")
async def get_pending_email_change_requests(user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen dit bekijken')
    rows = await fetch(
```

New:
```python
@api_router.get("/email-change-requests/pending")
async def get_pending_email_change_requests(
    user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen dit bekijken'))
):
    rows = await fetch(
```

- [ ] **Step 6: `process_email_change_request` (line 1136-1144)**

Old:
```python
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
```

New:
```python
@api_router.post("/email-change-requests/{token}/process")
async def process_email_change_request(
    token: str,
    approval: EmailChangeApproval,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen dit verwerken'))
):
    req = await fetchrow(
```

- [ ] **Step 7: Verify — run `backend_test.py`'s email-change tests**

```bash
python backend_test.py
```
Expected: `test_request_email_change`, `test_get_email_change_requests`, `test_profile_with_pending_email_change`, `test_duplicate_email_change_request`, `test_get_pending_email_requests_landlord`, `test_cancel_email_change_request` all still pass, same as before this task.

- [ ] **Step 8: Commit**

```bash
git add backend/server.py
git commit -m "refactor: migrate profile/email-change routes to require_role()"
```

---

### Task 6: Migrate Group 2 — properties CRUD (8 sites)

**Files:**
- Modify: `backend/server.py` (lines 1241-1415)

**Interfaces:**
- Consumes: `require_role` from Task 4.

- [ ] **Step 1: `create_property` (line 1241-1244)**

Old:
```python
@api_router.post("/properties", response_model=PropertyResponse)
async def create_property(prop: PropertyCreate, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen panden aanmaken')

    property_id = uuid.uuid4()
```

New:
```python
@api_router.post("/properties", response_model=PropertyResponse)
async def create_property(
    prop: PropertyCreate,
    user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen panden aanmaken')),
):
    property_id = uuid.uuid4()
```

- [ ] **Step 2: `get_properties` (line 1264-1267)** — note the duplicate detail text with `get_property` below; each hunk's surrounding decorator/def line disambiguates them for exact-match editing.

Old:
```python
@api_router.get("/properties", response_model=List[PropertyResponse])
async def get_properties(user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen panden bekijken')

    rows = await fetch(
        """
        select p.*, count(pr.id) as tenant_count
        from properties p
```

New:
```python
@api_router.get("/properties", response_model=List[PropertyResponse])
async def get_properties(
    user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen panden bekijken')),
):
    rows = await fetch(
        """
        select p.*, count(pr.id) as tenant_count
        from properties p
```

- [ ] **Step 3: `get_property` (line 1283-1286)**

Old:
```python
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
```

New:
```python
@api_router.get("/properties/{property_id}", response_model=PropertyResponse)
async def get_property(
    property_id: str,
    user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen panden bekijken')),
):
    prop = await fetchrow(
        "select * from properties where id = $1 and landlord_id = $2",
        uuid.UUID(property_id), uuid.UUID(user['id']),
    )
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')

    tenant_count = await fetchval("select count(*) from profiles where property_id = $1", uuid.UUID(property_id))
    return _property_row_to_response(prop, tenant_count)


@api_router.patch("/properties/{property_id}", response_model=PropertyResponse)
```

- [ ] **Step 4: `update_property` (line 1299-1302)**

Old:
```python
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
```

New:
```python
@api_router.patch("/properties/{property_id}", response_model=PropertyResponse)
async def update_property(
    property_id: str,
    update: PropertyUpdate,
    user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen panden bijwerken')),
):
    prop = await fetchrow(
        "select * from properties where id = $1 and landlord_id = $2",
        uuid.UUID(property_id), uuid.UUID(user['id']),
    )
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')

    sets, args = [], []
```

- [ ] **Step 5: `delete_property` (line 1334-1337)**

Old:
```python
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
```

New:
```python
@api_router.delete("/properties/{property_id}")
async def delete_property(
    property_id: str,
    user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen panden verwijderen')),
):
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
```

- [ ] **Step 6: `regenerate_join_code` (line 1354-1357)**

Old:
```python
@api_router.post("/properties/{property_id}/regenerate-code", response_model=PropertyResponse)
async def regenerate_join_code(property_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen codes regenereren')

    prop = await fetchrow(
```

New:
```python
@api_router.post("/properties/{property_id}/regenerate-code", response_model=PropertyResponse)
async def regenerate_join_code(
    property_id: str,
    user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen codes regenereren')),
):
    prop = await fetchrow(
```

- [ ] **Step 7: `get_property_tenants` (line 1378-1381)**

Old:
```python
@api_router.get("/properties/{property_id}/tenants", response_model=List[TenantResponse])
async def get_property_tenants(property_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen huurders bekijken')

    prop = await fetchrow(
```

New:
```python
@api_router.get("/properties/{property_id}/tenants", response_model=List[TenantResponse])
async def get_property_tenants(
    property_id: str,
    user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen huurders bekijken')),
):
    prop = await fetchrow(
```

- [ ] **Step 8: `remove_tenant` (line 1412-1415)**

Old:
```python
@api_router.delete("/properties/{property_id}/tenants/{tenant_id}")
async def remove_tenant(property_id: str, tenant_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen huurders verwijderen')

    prop = await fetchrow(
```

New:
```python
@api_router.delete("/properties/{property_id}/tenants/{tenant_id}")
async def remove_tenant(
    property_id: str,
    tenant_id: str,
    user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen huurders verwijderen')),
):
    prop = await fetchrow(
```

- [ ] **Step 9: Verify**

```bash
python backend_test.py
```
Expected: `test_create_property`, `test_get_properties`, `test_get_property_detail`, `test_regenerate_join_code`, `test_get_property_tenants`, `test_remove_tenant`, `test_property_access_control` all still pass.

- [ ] **Step 10: Commit**

```bash
git add backend/server.py
git commit -m "refactor: migrate properties CRUD routes to require_role()"
```

---

### Task 7: Migrate Group 3 — join/leave property (student) (2 sites)

**Files:**
- Modify: `backend/server.py` (lines 1439-1487)

- [ ] **Step 1: `join_property` (line 1439-1442)**

Old:
```python
@api_router.post("/properties/join")
async def join_property(request: JoinPropertyRequest, user: dict = Depends(get_current_user)):
    if user['role'] != 'student':
        raise HTTPException(status_code=403, detail='Alleen studenten kunnen zich aansluiten bij een pand')

    if user.get('property_id'):
```

New:
```python
@api_router.post("/properties/join")
async def join_property(
    request: JoinPropertyRequest,
    user: dict = Depends(require_role('student', 'Alleen studenten kunnen zich aansluiten bij een pand')),
):
    if user.get('property_id'):
```

- [ ] **Step 2: `leave_property` (line 1484-1487)**

Old:
```python
@api_router.post("/properties/leave")
async def leave_property(user: dict = Depends(get_current_user)):
    if user['role'] != 'student':
        raise HTTPException(status_code=403, detail='Alleen studenten kunnen een pand verlaten')

    if not user.get('property_id'):
```

New:
```python
@api_router.post("/properties/leave")
async def leave_property(
    user: dict = Depends(require_role('student', 'Alleen studenten kunnen een pand verlaten')),
):
    if not user.get('property_id'):
```

- [ ] **Step 3: Verify**

```bash
python backend_test.py
```
Expected: `test_student_join_property`, `test_invalid_join_code` still pass.

- [ ] **Step 4: Commit**

```bash
git add backend/server.py
git commit -m "refactor: migrate join/leave property routes to require_role()"
```

---

### Task 8: Migrate Group 4 — contractor routes, landlord side (5 sites)

**Files:**
- Modify: `backend/server.py` (lines 1504-1694)

Note: none of these 5 routes are exercised by `backend_test.py` or `test_floor_configuration.py` — verification here is a manual curl smoke check using the Task 1 fixture, run once via a short throwaway Python snippet (not committed).

- [ ] **Step 1: `invite_contractor` (line 1504-1511)**

Old:
```python
@api_router.post("/contractors/invite")
async def invite_contractor(
    data: ContractorInviteRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get('role') != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen aannemers uitnodigen')

    existing = await fetchrow(
```

New:
```python
@api_router.post("/contractors/invite")
async def invite_contractor(
    data: ContractorInviteRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen aannemers uitnodigen')),
):
    existing = await fetchrow(
```

- [ ] **Step 2: `search_contractors` (line 1561-1564)**

Old:
```python
@api_router.get("/contractors/search")
async def search_contractors(q: str, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen aannemers zoeken')

    pattern = f"%{q}%"
```

New:
```python
@api_router.get("/contractors/search")
async def search_contractors(
    q: str,
    current_user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen aannemers zoeken')),
):
    pattern = f"%{q}%"
```

- [ ] **Step 3: `my_contractors` (line 1584-1587)**

Old:
```python
@api_router.get("/contractors/my-list")
async def my_contractors(current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen hun aannemerslijst ophalen')

    rows = await fetch(
```

New:
```python
@api_router.get("/contractors/my-list")
async def my_contractors(
    current_user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen hun aannemerslijst ophalen')),
):
    rows = await fetch(
```

- [ ] **Step 4: `assign_contractor` (line 1618-1626)**

Old:
```python
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
```

New:
```python
@api_router.post("/tickets/{ticket_id}/assign-contractor")
async def assign_contractor(
    ticket_id: str,
    data: AssignContractorRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen aannemers toewijzen')),
):
    ticket = await _assert_landlord_owns_ticket(ticket_id, current_user['id'])
```

- [ ] **Step 5: `remove_contractor` (line 1682-1685)**

Old:
```python
@api_router.delete("/tickets/{ticket_id}/assign-contractor")
async def remove_contractor(ticket_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen aannemers verwijderen')

    await _assert_landlord_owns_ticket(ticket_id, current_user['id'])
```

New:
```python
@api_router.delete("/tickets/{ticket_id}/assign-contractor")
async def remove_contractor(
    ticket_id: str,
    current_user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen aannemers verwijderen')),
):
    await _assert_landlord_owns_ticket(ticket_id, current_user['id'])
```

- [ ] **Step 6: Manual smoke verification**

With the local server running, execute this throwaway script (don't commit it — delete after running):

```python
# backend/tests/_manual_smoke_group4.py (delete after running)
from conftest import create_confirmed_test_user, BASE_URL, unique_test_email
import requests

_, landlord_token = create_confirmed_test_user(
    role="landlord", email=unique_test_email("smoke_landlord"), password="test123", name="Smoke Landlord"
)
_, student_token = create_confirmed_test_user(
    role="student", email=unique_test_email("smoke_student"), password="test123", name="Smoke Student"
)

# Landlord-only route as landlord -> 200
r = requests.get(f"{BASE_URL}/api/contractors/my-list", headers={"Authorization": f"Bearer {landlord_token}"})
assert r.status_code == 200, r.text

# Same route as student -> 403 with the exact preserved detail text
r = requests.get(f"{BASE_URL}/api/contractors/my-list", headers={"Authorization": f"Bearer {student_token}"})
assert r.status_code == 403, r.text
assert r.json()["detail"] == "Alleen verhuurders kunnen hun aannemerslijst ophalen", r.json()

print("Group 4 smoke check passed")
```

```bash
cd backend/tests && ../venv/Scripts/python.exe _manual_smoke_group4.py && rm _manual_smoke_group4.py
```
Expected: `Group 4 smoke check passed`, then the throwaway file is removed.

- [ ] **Step 7: Commit**

```bash
git add backend/server.py
git commit -m "refactor: migrate contractor landlord-side routes to require_role()"
```

---

### Task 9: Migrate Group 5 — contractor-role routes (3 sites)

**Files:**
- Modify: `backend/server.py` (lines 1696-1793)

- [ ] **Step 1: `my_jobs` (line 1696-1699)**

Old:
```python
@api_router.get("/contractor/tickets")
async def my_jobs(current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'contractor':
        raise HTTPException(status_code=403, detail='Alleen aannemers kunnen klussen ophalen')

    rows = await fetch(
```

New:
```python
@api_router.get("/contractor/tickets")
async def my_jobs(
    current_user: dict = Depends(require_role('contractor', 'Alleen aannemers kunnen klussen ophalen')),
):
    rows = await fetch(
```

- [ ] **Step 2: `get_job_detail` (line 1729-1732)**

Old:
```python
@api_router.get("/contractor/tickets/{ticket_id}")
async def get_job_detail(ticket_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'contractor':
        raise HTTPException(status_code=403, detail='Geen toegang')

    ticket = await fetchrow(
```

New:
```python
@api_router.get("/contractor/tickets/{ticket_id}")
async def get_job_detail(
    ticket_id: str,
    current_user: dict = Depends(require_role('contractor', 'Geen toegang')),
):
    ticket = await fetchrow(
```

- [ ] **Step 3: `update_job_status` (line 1768-1775)**

Old:
```python
@api_router.patch("/contractor/tickets/{ticket_id}/status")
async def update_job_status(
    ticket_id: str,
    data: ContractorStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get('role') != 'contractor':
        raise HTTPException(status_code=403, detail='Alleen aannemers kunnen klus-status updaten')

    valid_statuses = ['in_progress', 'resolved']
```

New:
```python
@api_router.patch("/contractor/tickets/{ticket_id}/status")
async def update_job_status(
    ticket_id: str,
    data: ContractorStatusUpdate,
    current_user: dict = Depends(require_role('contractor', 'Alleen aannemers kunnen klus-status updaten')),
):
    valid_statuses = ['in_progress', 'resolved']
```

- [ ] **Step 4: Manual smoke verification**

Same pattern as Task 8 Step 6 — write, run, delete `backend/tests/_manual_smoke_group5.py`:

```python
from conftest import create_confirmed_test_user, BASE_URL, unique_test_email
import requests

_, contractor_token = create_confirmed_test_user(
    role="contractor", email=unique_test_email("smoke_contractor"), password="test123", name="Smoke Contractor"
)
_, student_token = create_confirmed_test_user(
    role="student", email=unique_test_email("smoke_student2"), password="test123", name="Smoke Student 2"
)

r = requests.get(f"{BASE_URL}/api/contractor/tickets", headers={"Authorization": f"Bearer {contractor_token}"})
assert r.status_code == 200, r.text

r = requests.get(f"{BASE_URL}/api/contractor/tickets", headers={"Authorization": f"Bearer {student_token}"})
assert r.status_code == 403, r.text
assert r.json()["detail"] == "Alleen aannemers kunnen klussen ophalen", r.json()

print("Group 5 smoke check passed")
```

```bash
cd backend/tests && ../venv/Scripts/python.exe _manual_smoke_group5.py && rm _manual_smoke_group5.py
```
Expected: `Group 5 smoke check passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/server.py
git commit -m "refactor: migrate contractor-role routes to require_role()"
```

---

### Task 10: Migrate Group 6 — tickets/unread/stats routes (7 sites) + wire in `get_landlord_property_ids`

**Files:**
- Modify: `backend/server.py` (lines 1917-1920, 1961-1964, 1989-1992, 2026-2029, 2077-2085, 2265-2268, 2329-2332, 2342-2348)

- [ ] **Step 1: Wire `get_landlord_property_ids` into `get_tickets` (line 1917-1920)**

Old:
```python
    elif user['role'] == 'landlord':
        landlord_property_ids = [
            r['id'] for r in await fetch("select id from properties where landlord_id = $1", uuid.UUID(user['id']))
        ]
        if property_id and uuid.UUID(property_id) in landlord_property_ids:
```

New:
```python
    elif user['role'] == 'landlord':
        landlord_property_ids = await get_landlord_property_ids(user['id'])
        if property_id and uuid.UUID(property_id) in landlord_property_ids:
```

- [ ] **Step 2: `get_unread_counts` (line 1961-1964)**

Old:
```python
@api_router.get("/tickets/unread-counts")
async def get_unread_counts(user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen ongelezen berichten opvragen')

    rows = await fetch(
```

New:
```python
@api_router.get("/tickets/unread-counts")
async def get_unread_counts(
    user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen ongelezen berichten opvragen')),
):
    rows = await fetch(
```

- [ ] **Step 3: `get_unread_counts_student` (line 1989-1992)**

Old:
```python
@api_router.get("/tickets/unread-counts-student")
async def get_unread_counts_student(user: dict = Depends(get_current_user)):
    if user['role'] != 'student':
        raise HTTPException(status_code=403, detail='Alleen studenten kunnen ongelezen berichten opvragen')

    tickets = await fetch(
```

New:
```python
@api_router.get("/tickets/unread-counts-student")
async def get_unread_counts_student(
    user: dict = Depends(require_role('student', 'Alleen studenten kunnen ongelezen berichten opvragen')),
):
    tickets = await fetch(
```

- [ ] **Step 4: `mark_ticket_read_student` (line 2026-2029)**

Old:
```python
@api_router.post("/tickets/{ticket_id}/mark-read-student")
async def mark_ticket_read_student(ticket_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'student':
        raise HTTPException(status_code=403, detail='Alleen studenten kunnen tickets als gelezen markeren')

    ticket = await fetchrow("select created_by from tickets where id = $1", uuid.UUID(ticket_id))
```

New:
```python
@api_router.post("/tickets/{ticket_id}/mark-read-student")
async def mark_ticket_read_student(
    ticket_id: str,
    user: dict = Depends(require_role('student', 'Alleen studenten kunnen tickets als gelezen markeren')),
):
    ticket = await fetchrow("select created_by from tickets where id = $1", uuid.UUID(ticket_id))
```

- [ ] **Step 5: `update_ticket` (line 2077-2085)**

Old:
```python
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
```

New:
```python
@api_router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    update: TicketUpdate,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen tickets bijwerken')),
):
    ticket = await _get_ticket_with_access_check(ticket_id, user)
```

- [ ] **Step 6: `send_ticket_reminder` (line 2265-2268)**

Old:
```python
@api_router.post("/tickets/{ticket_id}/send-reminder")
async def send_ticket_reminder(ticket_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    if user['role'] != 'student':
        raise HTTPException(status_code=403, detail='Alleen studenten kunnen een herinnering sturen')

    ticket = await _get_ticket_with_access_check(ticket_id, user)
```

New:
```python
@api_router.post("/tickets/{ticket_id}/send-reminder")
async def send_ticket_reminder(
    ticket_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_role('student', 'Alleen studenten kunnen een herinnering sturen')),
):
    ticket = await _get_ticket_with_access_check(ticket_id, user)
```

- [ ] **Step 7: `mark_ticket_read` (line 2329-2332)**

Old:
```python
@api_router.post("/tickets/{ticket_id}/mark-read")
async def mark_ticket_read(ticket_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen tickets als gelezen markeren')

    await execute(
```

New:
```python
@api_router.post("/tickets/{ticket_id}/mark-read")
async def mark_ticket_read(
    ticket_id: str,
    user: dict = Depends(require_role('landlord', 'Alleen verhuurders kunnen tickets als gelezen markeren')),
):
    await execute(
```

- [ ] **Step 8: `get_dashboard_stats` (line 2342-2348) — role-check + wire in `get_landlord_property_ids`**

Old:
```python
@api_router.get("/stats/dashboard")
async def get_dashboard_stats(property_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders hebben toegang tot statistieken')

    landlord_property_ids = [
        r['id'] for r in await fetch("select id from properties where landlord_id = $1", uuid.UUID(user['id']))
    ]

    if property_id and uuid.UUID(property_id) in landlord_property_ids:
```

New:
```python
@api_router.get("/stats/dashboard")
async def get_dashboard_stats(
    property_id: Optional[str] = None,
    user: dict = Depends(require_role('landlord', 'Alleen verhuurders hebben toegang tot statistieken')),
):
    landlord_property_ids = await get_landlord_property_ids(user['id'])

    if property_id and uuid.UUID(property_id) in landlord_property_ids:
```

- [ ] **Step 9: Verify — full suite**

```bash
python backend_test.py
cd backend && venv/Scripts/python.exe -m pytest tests/ -v
```
Expected: every test in both suites still passes, including `test_get_tickets_student`, `test_get_tickets_landlord`, `test_property_filtered_tickets`, `test_dashboard_stats`, `test_dashboard_stats_with_property_filter`, `test_update_ticket_status`, `test_send_reminders`, `test_role_restrictions`.

- [ ] **Step 10: Commit**

```bash
git add backend/server.py
git commit -m "refactor: migrate ticket/stats routes to require_role(), wire in get_landlord_property_ids()"
```

---

### Task 11: Final full-suite regression pass

**Files:** none (verification only)

- [ ] **Step 1: Confirm all 31 sites are gone**

```bash
cd backend && grep -n "role.*!=.*'landlord'\|role.*!=.*'student'\|role.*!=.*'contractor'" server.py
```
Expected: **no output** (empty) — every inline role-check has been replaced by a `require_role(...)` dependency.

- [ ] **Step 2: Confirm the two duplicated property-ids queries are gone**

```bash
cd backend && grep -n "select id from properties where landlord_id" server.py
```
Expected: exactly **one** match, inside `get_landlord_property_ids` itself.

- [ ] **Step 3: Run the complete test suite one final time**

```bash
cd backend && venv/Scripts/python.exe -m pytest tests/ -v
python backend_test.py
```
Expected: all pass.

- [ ] **Step 4: Re-run the Task 8 and Task 9 manual smoke checks one more time** (recreate the two throwaway scripts, run, delete again) to confirm the final state of Groups 4-5 still behaves correctly after Group 6's changes.

- [ ] **Step 5: Final commit (if anything is outstanding)**

```bash
git status
# If clean, nothing to do. If anything is unstaged (e.g. a stray manual-smoke leftover), remove/stage as appropriate.
```

---

## Self-Review Notes

- **Spec coverage:** Fase 1 (conftest.py + both legacy test files) → Tasks 1-3. Fase 2 (`require_role` + `get_landlord_property_ids`, all 31+2 call sites) → Tasks 4-10. Final verification → Task 11. All spec sections covered.
- **Type consistency:** `require_role(role: str, detail: str)` signature is identical everywhere it's called across Tasks 5-10. `get_landlord_property_ids(landlord_id: str) -> list` matches both call sites in Task 10.
- **No placeholders:** every step shows exact before/after code pulled directly from the current `server.py`/`backend_test.py`/`test_floor_configuration.py` — no "similar to Task N" shortcuts.
