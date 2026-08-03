"""Tests for GET /contractors/search matching on specialty/region (not just name/email)."""
import uuid

import requests

from conftest import create_confirmed_test_user, unique_test_email, BASE_URL


def test_search_contractors_matches_on_specialty():
    _, landlord_token = create_confirmed_test_user(
        role="landlord",
        email=unique_test_email("test_search_landlord_specialty"),
        password="test123",
        name="Search Test Landlord",
    )

    unique_specialty = f"Loodgieterij-{uuid.uuid4().hex[:8]}"
    contractor_email = unique_test_email("test_search_contractor_specialty")
    create_confirmed_test_user(
        role="contractor",
        email=contractor_email,
        password="test123",
        name="Search Test Contractor",
        specialty=unique_specialty,
        region="Hasselt",
    )

    resp = requests.get(
        f"{BASE_URL}/api/contractors/search",
        params={"q": unique_specialty},
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert resp.status_code == 200, resp.text
    results = resp.json()
    assert any(r["email"] == contractor_email for r in results), results

    unrelated_resp = requests.get(
        f"{BASE_URL}/api/contractors/search",
        params={"q": f"nonexistent-{uuid.uuid4().hex[:8]}"},
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert unrelated_resp.status_code == 200, unrelated_resp.text
    assert unrelated_resp.json() == [], unrelated_resp.text


def test_search_contractors_matches_on_region():
    _, landlord_token = create_confirmed_test_user(
        role="landlord",
        email=unique_test_email("test_search_landlord_region"),
        password="test123",
        name="Search Test Landlord",
    )

    unique_region = f"Gent-{uuid.uuid4().hex[:8]}"
    contractor_email = unique_test_email("test_search_contractor_region")
    create_confirmed_test_user(
        role="contractor",
        email=contractor_email,
        password="test123",
        name="Search Test Contractor",
        specialty="Elektriciteit",
        region=unique_region,
    )

    resp = requests.get(
        f"{BASE_URL}/api/contractors/search",
        params={"q": unique_region},
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert resp.status_code == 200, resp.text
    results = resp.json()
    assert any(r["email"] == contractor_email for r in results), results

    unrelated_resp = requests.get(
        f"{BASE_URL}/api/contractors/search",
        params={"q": f"nonexistent-{uuid.uuid4().hex[:8]}"},
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert unrelated_resp.status_code == 200, unrelated_resp.text
    assert unrelated_resp.json() == [], unrelated_resp.text
