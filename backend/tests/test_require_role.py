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
