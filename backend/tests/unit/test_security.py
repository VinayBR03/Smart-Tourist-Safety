# tests/unit/test_security.py

import pytest
from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    verify_internal_service_token,
)
from app.core.config import settings


# =========================================================
# Password Hashing
# =========================================================

def test_hash_password_success():
    password = "StrongPassword123!"
    hashed = hash_password(password)

    assert hashed != password
    assert isinstance(hashed, str)
    assert verify_password(password, hashed) is True


def test_hash_password_min_length():
    with pytest.raises(ValueError):
        hash_password("short")


def test_verify_password_wrong_password():
    password = "StrongPassword123!"
    hashed = hash_password(password)

    assert verify_password("WrongPassword!", hashed) is False


# =========================================================
# Access Token
# =========================================================

def test_create_and_decode_access_token():
    token = create_access_token(
        user_id=1,
        role="TOURIST",
        token_version=0,
    )

    payload = decode_access_token(token)

    assert payload["sub"] == "1"
    assert payload["role"] == "TOURIST"
    assert payload["type"] == "access"
    assert payload["token_version"] == 0


def test_access_token_wrong_type():
    token, _, _ = create_refresh_token(
        user_id=1,
        token_version=0,
    )

    with pytest.raises(HTTPException):
        decode_access_token(token)


# =========================================================
# Refresh Token
# =========================================================

def test_create_and_decode_refresh_token():
    token, jti, expires_at = create_refresh_token(
        user_id=1,
        token_version=0,
    )

    payload = decode_refresh_token(token)

    assert payload["sub"] == "1"
    assert payload["type"] == "refresh"
    assert payload["jti"] == jti
    assert payload["token_version"] == 0
    assert isinstance(expires_at, datetime)


def test_refresh_token_wrong_type():
    token = create_access_token(
        user_id=1,
        role="TOURIST",
        token_version=0,
    )

    with pytest.raises(HTTPException):
        decode_refresh_token(token)


# =========================================================
# Expired Token
# =========================================================

def test_invalid_token():
    with pytest.raises(HTTPException):
        decode_access_token("invalid.token.value")


# =========================================================
# Internal Service Token
# =========================================================

def test_verify_internal_service_token_success():
    verify_internal_service_token(settings.INTERNAL_SERVICE_TOKEN)


def test_verify_internal_service_token_failure():
    with pytest.raises(HTTPException):
        verify_internal_service_token("wrong_token")