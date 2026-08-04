"""Tests for GET /contractors/search matching on specialty/region (not just name/email)."""
import uuid

import requests

from conftest import create_confirmed_test_user, unique_test_email, get_contractor_invite_token, BASE_URL


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


def test_search_in_scope_true_when_contractor_has_no_scope_restriction():
    _, landlord_token = create_confirmed_test_user(
        role="landlord",
        email=unique_test_email("test_search_scope_landlord_unrestricted"),
        password="test123",
        name="Search Scope Test Landlord",
    )

    unique_specialty = f"Schrijnwerk-{uuid.uuid4().hex[:8]}"
    contractor_email = unique_test_email("test_search_scope_contractor_unrestricted")
    create_confirmed_test_user(
        role="contractor",
        email=contractor_email,
        password="test123",
        name="Search Scope Test Contractor",
        specialty=unique_specialty,
        region="Leuven",
    )

    resp = requests.get(
        f"{BASE_URL}/api/contractors/search",
        params={"q": unique_specialty, "property_id": str(uuid.uuid4())},
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert resp.status_code == 200, resp.text
    result = next(r for r in resp.json() if r["email"] == contractor_email)
    assert result["in_scope"] is True


def test_search_in_scope_reflects_property_restriction():
    _, landlord_token = create_confirmed_test_user(
        role="landlord",
        email=unique_test_email("test_search_scope_landlord_restricted"),
        password="test123",
        name="Search Scope Test Landlord",
    )
    prop_resp = requests.post(
        f"{BASE_URL}/api/properties",
        json={
            "name": "Search Scope Test Property",
            "street": "Teststraat", "house_number": "1",
            "postal_code": "3500", "city": "Hasselt",
            "floor_count": 2,
        },
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert prop_resp.status_code == 200, prop_resp.text
    property_id = prop_resp.json()["id"]

    contractor_email = unique_test_email("test_search_scope_contractor_restricted")
    invite_resp = requests.post(
        f"{BASE_URL}/api/contractors/invite",
        json={"email": contractor_email, "name": "Restricted Contractor"},
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert invite_resp.status_code == 200, invite_resp.text
    invite_token = get_contractor_invite_token(contractor_email)
    assert invite_token, f"no contractor_invites row found for {contractor_email}"

    unique_specialty = f"Dakwerk-{uuid.uuid4().hex[:8]}"
    contractor_id, _ = create_confirmed_test_user(
        role="contractor",
        email=contractor_email,
        password="test123",
        name="Restricted Contractor",
        specialty=unique_specialty,
        invite_token=invite_token,
    )

    scope_resp = requests.put(
        f"{BASE_URL}/api/contractors/{contractor_id}/property-scope",
        json={"property_ids": [property_id]},
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert scope_resp.status_code == 200, scope_resp.text

    matching_resp = requests.get(
        f"{BASE_URL}/api/contractors/search",
        params={"q": unique_specialty, "property_id": property_id},
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert matching_resp.status_code == 200, matching_resp.text
    matching_result = next(r for r in matching_resp.json() if r["email"] == contractor_email)
    assert matching_result["in_scope"] is True

    other_property_resp = requests.get(
        f"{BASE_URL}/api/contractors/search",
        params={"q": unique_specialty, "property_id": str(uuid.uuid4())},
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert other_property_resp.status_code == 200, other_property_resp.text
    other_result = next(r for r in other_property_resp.json() if r["email"] == contractor_email)
    assert other_result["in_scope"] is False


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


def test_search_in_scope_unaffected_by_a_different_landlords_scope_restriction():
    """Landlord A restricts a contractor to A's own property. Landlord B,
    completely unrelated to A, must NOT see that contractor as out-of-scope
    for B's own property just because the contractor happens to be scoped
    by a different landlord somewhere else."""
    _, landlord_a_token = create_confirmed_test_user(
        role="landlord",
        email=unique_test_email("test_search_scope_isolation_landlord_a"),
        password="test123",
        name="Isolation Test Landlord A",
    )
    prop_a_resp = requests.post(
        f"{BASE_URL}/api/properties",
        json={
            "name": "Isolation Test Property A",
            "street": "Teststraat", "house_number": "1",
            "postal_code": "3500", "city": "Hasselt",
            "floor_count": 2,
        },
        headers={"Authorization": f"Bearer {landlord_a_token}"},
    )
    assert prop_a_resp.status_code == 200, prop_a_resp.text
    property_a_id = prop_a_resp.json()["id"]

    unique_specialty = f"Loodgieterij-{uuid.uuid4().hex[:8]}"
    contractor_email = unique_test_email("test_search_scope_isolation_contractor")
    invite_resp = requests.post(
        f"{BASE_URL}/api/contractors/invite",
        json={"email": contractor_email, "name": "Isolation Test Contractor"},
        headers={"Authorization": f"Bearer {landlord_a_token}"},
    )
    assert invite_resp.status_code == 200, invite_resp.text
    invite_token = get_contractor_invite_token(contractor_email)
    assert invite_token, f"no contractor_invites row found for {contractor_email}"

    contractor_id, _ = create_confirmed_test_user(
        role="contractor",
        email=contractor_email,
        password="test123",
        name="Isolation Test Contractor",
        specialty=unique_specialty,
        invite_token=invite_token,
    )

    # A restricts the contractor to A's own property.
    scope_resp = requests.put(
        f"{BASE_URL}/api/contractors/{contractor_id}/property-scope",
        json={"property_ids": [property_a_id]},
        headers={"Authorization": f"Bearer {landlord_a_token}"},
    )
    assert scope_resp.status_code == 200, scope_resp.text

    # A completely unrelated landlord B, searching for the same contractor
    # from B's own property, must see them as in_scope=True — B never
    # restricted this contractor, so A's restriction must not leak into B's view.
    _, landlord_b_token = create_confirmed_test_user(
        role="landlord",
        email=unique_test_email("test_search_scope_isolation_landlord_b"),
        password="test123",
        name="Isolation Test Landlord B",
    )
    prop_b_resp = requests.post(
        f"{BASE_URL}/api/properties",
        json={
            "name": "Isolation Test Property B",
            "street": "Teststraat", "house_number": "2",
            "postal_code": "9000", "city": "Gent",
            "floor_count": 2,
        },
        headers={"Authorization": f"Bearer {landlord_b_token}"},
    )
    assert prop_b_resp.status_code == 200, prop_b_resp.text
    property_b_id = prop_b_resp.json()["id"]

    resp = requests.get(
        f"{BASE_URL}/api/contractors/search",
        params={"q": unique_specialty, "property_id": property_b_id},
        headers={"Authorization": f"Bearer {landlord_b_token}"},
    )
    assert resp.status_code == 200, resp.text
    result = next(r for r in resp.json() if r["email"] == contractor_email)
    assert result["in_scope"] is True
