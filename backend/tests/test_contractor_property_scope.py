"""Tests for contractor property-scoped assignment: GET /contractors/my-list
scope info and PUT /contractors/{contractor_id}/property-scope."""
import requests

from conftest import create_confirmed_test_user, unique_test_email, get_contractor_invite_token, BASE_URL


def _create_landlord_with_property(name_suffix):
    _, landlord_token = create_confirmed_test_user(
        role="landlord",
        email=unique_test_email(f"test_scope_landlord_{name_suffix}"),
        password="test123",
        name="Scope Test Landlord",
    )
    prop_resp = requests.post(
        f"{BASE_URL}/api/properties",
        json={
            "name": f"Scope Test Property {name_suffix}",
            "street": "Teststraat", "house_number": "1",
            "postal_code": "3500", "city": "Hasselt",
            "floor_count": 2,
        },
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert prop_resp.status_code == 200, prop_resp.text
    return landlord_token, prop_resp.json()["id"]


def _invite_and_register_contractor(landlord_token, name_suffix):
    """Establishes a real contractor_landlord_links row the same way
    production does: invite -> contractor registers with that invite's
    token. (Self-registration without a token, from the separate
    contractor-self-registration feature, deliberately creates NO link —
    not usable here.)"""
    contractor_email = unique_test_email(f"test_scope_contractor_{name_suffix}")
    invite_resp = requests.post(
        f"{BASE_URL}/api/contractors/invite",
        json={"email": contractor_email, "name": f"Scope Contractor {name_suffix}"},
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert invite_resp.status_code == 200, invite_resp.text

    invite_token = get_contractor_invite_token(contractor_email)
    assert invite_token, f"no contractor_invites row found for {contractor_email}"

    contractor_id, _ = create_confirmed_test_user(
        role="contractor",
        email=contractor_email,
        password="test123",
        name=f"Scope Contractor {name_suffix}",
        invite_token=invite_token,
    )
    return contractor_id


def test_my_list_reports_unrestricted_scope_for_new_link():
    landlord_token, property_id = _create_landlord_with_property("mylist_default")
    contractor_id = _invite_and_register_contractor(landlord_token, "mylist_default")

    my_list_resp = requests.get(
        f"{BASE_URL}/api/contractors/my-list",
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert my_list_resp.status_code == 200, my_list_resp.text
    entry = next(c for c in my_list_resp.json() if c["id"] == contractor_id)
    assert entry["scope_property_ids"] == []


def test_update_and_read_back_specific_scope():
    landlord_token, property_id = _create_landlord_with_property("scope_rw")
    contractor_id = _invite_and_register_contractor(landlord_token, "scope_rw")

    update_resp = requests.put(
        f"{BASE_URL}/api/contractors/{contractor_id}/property-scope",
        json={"property_ids": [property_id]},
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert update_resp.status_code == 200, update_resp.text
    assert update_resp.json()["property_ids"] == [property_id]

    my_list_resp = requests.get(
        f"{BASE_URL}/api/contractors/my-list",
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert my_list_resp.status_code == 200, my_list_resp.text
    entry = next(c for c in my_list_resp.json() if c["id"] == contractor_id)
    assert entry["scope_property_ids"] == [property_id]

    # Setting back to [] must clear scope (unrestricted again), not append.
    clear_resp = requests.put(
        f"{BASE_URL}/api/contractors/{contractor_id}/property-scope",
        json={"property_ids": []},
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert clear_resp.status_code == 200, clear_resp.text
    my_list_resp_2 = requests.get(
        f"{BASE_URL}/api/contractors/my-list",
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    entry_2 = next(c for c in my_list_resp_2.json() if c["id"] == contractor_id)
    assert entry_2["scope_property_ids"] == []


def test_update_scope_rejects_unlinked_contractor():
    landlord_token, property_id = _create_landlord_with_property("unlinked")

    # A contractor this landlord never invited/linked.
    contractor_id, _ = create_confirmed_test_user(
        role="contractor",
        email=unique_test_email("test_scope_contractor_unlinked"),
        password="test123",
        name="Unlinked Contractor",
    )

    resp = requests.put(
        f"{BASE_URL}/api/contractors/{contractor_id}/property-scope",
        json={"property_ids": [property_id]},
        headers={"Authorization": f"Bearer {landlord_token}"},
    )
    assert resp.status_code == 404, resp.text


def test_update_scope_rejects_property_not_owned_by_caller():
    landlord_a_token, _ = _create_landlord_with_property("owner_a")
    _, other_landlord_property_id = _create_landlord_with_property("owner_b")
    contractor_id = _invite_and_register_contractor(landlord_a_token, "crossowner")

    resp = requests.put(
        f"{BASE_URL}/api/contractors/{contractor_id}/property-scope",
        json={"property_ids": [other_landlord_property_id]},
        headers={"Authorization": f"Bearer {landlord_a_token}"},
    )
    assert resp.status_code == 400, resp.text


def test_scope_update_does_not_affect_other_landlords_scope_for_shared_contractor():
    """A contractor can be linked to multiple landlords. Landlord A sets a
    scope for their own property; landlord B (who separately links the same
    contractor) later updates their own scope. B's write must not touch A's
    rows for A's own property."""
    landlord_a_token, property_a_id = _create_landlord_with_property("shared_owner_a")
    landlord_b_token, property_b_id = _create_landlord_with_property("shared_owner_b")

    contractor_email = unique_test_email("test_scope_contractor_shared")
    invite_a_resp = requests.post(
        f"{BASE_URL}/api/contractors/invite",
        json={"email": contractor_email, "name": "Shared Contractor"},
        headers={"Authorization": f"Bearer {landlord_a_token}"},
    )
    assert invite_a_resp.status_code == 200, invite_a_resp.text
    invite_a_token = get_contractor_invite_token(contractor_email)
    assert invite_a_token, f"no contractor_invites row found for {contractor_email}"

    contractor_id, _ = create_confirmed_test_user(
        role="contractor",
        email=contractor_email,
        password="test123",
        name="Shared Contractor",
        invite_token=invite_a_token,
    )

    # Link the same (already-registered) contractor to landlord B too — the
    # existing profile lookup path in invite_contractor creates the link
    # immediately (no second invite-token flow needed for an already-registered
    # contractor).
    invite_b_resp = requests.post(
        f"{BASE_URL}/api/contractors/invite",
        json={"email": contractor_email, "name": "Shared Contractor"},
        headers={"Authorization": f"Bearer {landlord_b_token}"},
    )
    assert invite_b_resp.status_code == 200, invite_b_resp.text
    assert invite_b_resp.json()["status"] == "gekoppeld", invite_b_resp.text

    # A scopes the contractor to A's own property.
    scope_a_resp = requests.put(
        f"{BASE_URL}/api/contractors/{contractor_id}/property-scope",
        json={"property_ids": [property_a_id]},
        headers={"Authorization": f"Bearer {landlord_a_token}"},
    )
    assert scope_a_resp.status_code == 200, scope_a_resp.text

    # B scopes the (shared) contractor to B's own property.
    scope_b_resp = requests.put(
        f"{BASE_URL}/api/contractors/{contractor_id}/property-scope",
        json={"property_ids": [property_b_id]},
        headers={"Authorization": f"Bearer {landlord_b_token}"},
    )
    assert scope_b_resp.status_code == 200, scope_b_resp.text

    # A's own view of the contractor's scope must still show A's property —
    # B's write must not have deleted A's row.
    my_list_a_resp = requests.get(
        f"{BASE_URL}/api/contractors/my-list",
        headers={"Authorization": f"Bearer {landlord_a_token}"},
    )
    assert my_list_a_resp.status_code == 200, my_list_a_resp.text
    entry_a = next(c for c in my_list_a_resp.json() if c["id"] == contractor_id)
    assert entry_a["scope_property_ids"] == [property_a_id]

    # B's own view must show only B's property.
    my_list_b_resp = requests.get(
        f"{BASE_URL}/api/contractors/my-list",
        headers={"Authorization": f"Bearer {landlord_b_token}"},
    )
    assert my_list_b_resp.status_code == 200, my_list_b_resp.text
    entry_b = next(c for c in my_list_b_resp.json() if c["id"] == contractor_id)
    assert entry_b["scope_property_ids"] == [property_b_id]
