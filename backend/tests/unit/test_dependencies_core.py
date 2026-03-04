import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException

import app.core.dependencies as deps
from app.core.enums import UserRole, DeviceStatus


# =========================================================
# Helpers
# =========================================================

class FakeUser:
    def __init__(
        self,
        id=1,
        role=UserRole.TOURIST,
        is_active=True,
        is_verified=True,
        deleted_at=None,
        token_version=0,
    ):
        self.id = id
        self.role = role
        self.is_active = is_active
        self.is_verified = is_verified
        self.deleted_at = deleted_at
        self.token_version = token_version


class FakeDevice:
    def __init__(
        self,
        status=DeviceStatus.ACTIVE,
        is_verified=True,
    ):
        self.status = status
        self.is_verified = is_verified


def mock_db_with_user(monkeypatch, user):
    fake_db = MagicMock()
    fake_db.query.return_value.filter.return_value.first.return_value = user
    return fake_db


def mock_db_with_device(monkeypatch, device):
    fake_db = MagicMock()
    fake_db.query.return_value.filter.return_value.first.return_value = device
    return fake_db


# =========================================================
# get_current_user
# =========================================================

def test_get_current_user_success(monkeypatch):
    monkeypatch.setattr(
        deps,
        "decode_access_token",
        lambda token: {
            "sub": "1",
            "role": UserRole.TOURIST.value,
            "token_version": 0,
        },
    )

    user = FakeUser(role=UserRole.TOURIST)

    db = mock_db_with_user(monkeypatch, user)

    credentials = MagicMock()
    credentials.credentials = "token"

    result = deps.get_current_user(credentials=credentials, db=db)

    assert result == user


def test_invalid_payload_missing_fields(monkeypatch):
    monkeypatch.setattr(deps, "decode_access_token", lambda token: {})

    credentials = MagicMock()
    credentials.credentials = "token"

    with pytest.raises(HTTPException):
        deps.get_current_user(credentials=credentials, db=MagicMock())


def test_invalid_subject_format(monkeypatch):
    monkeypatch.setattr(
        deps,
        "decode_access_token",
        lambda token: {"sub": "abc", "role": "tourist", "token_version": 0},
    )

    credentials = MagicMock()
    credentials.credentials = "token"

    with pytest.raises(HTTPException):
        deps.get_current_user(credentials=credentials, db=MagicMock())


def test_user_not_found(monkeypatch):
    monkeypatch.setattr(
        deps,
        "decode_access_token",
        lambda token: {"sub": "1", "role": "tourist", "token_version": 0},
    )

    db = mock_db_with_user(monkeypatch, None)

    credentials = MagicMock()
    credentials.credentials = "token"

    with pytest.raises(HTTPException):
        deps.get_current_user(credentials=credentials, db=db)


def test_user_inactive(monkeypatch):
    monkeypatch.setattr(
        deps,
        "decode_access_token",
        lambda token: {"sub": "1", "role": "tourist", "token_version": 0},
    )

    user = FakeUser(is_active=False)
    db = mock_db_with_user(monkeypatch, user)

    credentials = MagicMock()
    credentials.credentials = "token"

    with pytest.raises(HTTPException):
        deps.get_current_user(credentials=credentials, db=db)


def test_user_not_verified(monkeypatch):
    monkeypatch.setattr(
        deps,
        "decode_access_token",
        lambda token: {"sub": "1", "role": "tourist", "token_version": 0},
    )

    user = FakeUser(is_verified=False)
    db = mock_db_with_user(monkeypatch, user)

    credentials = MagicMock()
    credentials.credentials = "token"

    with pytest.raises(HTTPException):
        deps.get_current_user(credentials=credentials, db=db)


def test_token_version_mismatch(monkeypatch):
    monkeypatch.setattr(
        deps,
        "decode_access_token",
        lambda token: {"sub": "1", "role": "tourist", "token_version": 5},
    )

    user = FakeUser(token_version=0)
    db = mock_db_with_user(monkeypatch, user)

    credentials = MagicMock()
    credentials.credentials = "token"

    with pytest.raises(HTTPException):
        deps.get_current_user(credentials=credentials, db=db)


def test_role_mismatch(monkeypatch):
    monkeypatch.setattr(
        deps,
        "decode_access_token",
        lambda token: {"sub": "1", "role": "admin", "token_version": 0},
    )

    user = FakeUser(role=UserRole.TOURIST)
    db = mock_db_with_user(monkeypatch, user)

    credentials = MagicMock()
    credentials.credentials = "token"

    with pytest.raises(HTTPException):
        deps.get_current_user(credentials=credentials, db=db)


# =========================================================
# require_roles
# =========================================================

def test_require_roles_success():
    user = FakeUser(role=UserRole.ADMIN)
    dependency = deps.require_roles(UserRole.ADMIN)
    result = dependency(current_user=user)
    assert result == user


def test_require_roles_denied():
    user = FakeUser(role=UserRole.TOURIST)
    dependency = deps.require_roles(UserRole.ADMIN)

    with pytest.raises(HTTPException):
        dependency(current_user=user)


# =========================================================
# get_current_iot_device
# =========================================================

def test_get_current_iot_device_success(monkeypatch):
    monkeypatch.setattr(deps, "get_refresh_token_hash", lambda key: "hashed")

    device = FakeDevice()
    db = mock_db_with_device(monkeypatch, device)

    result = deps.get_current_iot_device(x_api_key="x"*20, db=db)
    assert result == device


def test_get_current_iot_device_not_found(monkeypatch):
    monkeypatch.setattr(deps, "get_refresh_token_hash", lambda key: "hashed")
    db = mock_db_with_device(monkeypatch, None)

    with pytest.raises(HTTPException):
        deps.get_current_iot_device(x_api_key="x"*20, db=db)


def test_get_current_iot_device_inactive(monkeypatch):
    monkeypatch.setattr(deps, "get_refresh_token_hash", lambda key: "hashed")
    device = FakeDevice(status=DeviceStatus.SUSPENDED)
    db = mock_db_with_device(monkeypatch, device)

    with pytest.raises(HTTPException):
        deps.get_current_iot_device(x_api_key="x"*20, db=db)


def test_get_current_iot_device_not_verified(monkeypatch):
    monkeypatch.setattr(deps, "get_refresh_token_hash", lambda key: "hashed")
    device = FakeDevice(is_verified=False)
    db = mock_db_with_device(monkeypatch, device)

    with pytest.raises(HTTPException):
        deps.get_current_iot_device(x_api_key="x"*20, db=db)


# =========================================================
# internal_service_required
# =========================================================

def test_internal_service_missing_token():
    with pytest.raises(HTTPException):
        deps.internal_service_required(x_internal_token=None)


def test_internal_service_success(monkeypatch):
    monkeypatch.setattr(deps, "verify_internal_service_token", lambda token: None)
    deps.internal_service_required(x_internal_token="valid")