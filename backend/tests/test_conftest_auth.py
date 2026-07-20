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
