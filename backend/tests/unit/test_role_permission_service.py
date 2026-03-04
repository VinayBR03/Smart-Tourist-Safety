import pytest
from unittest.mock import MagicMock

from app.services.role_permission_service import (
    require_role,
    require_admin,
    require_authority_or_admin,
    require_tourist,
    require_self_or_admin,
)

from app.core.enums import UserRole
from app.core.exceptions import ValidationError, ForbiddenError


# =========================================================
# Helpers
# =========================================================

class DummyUser:
    def __init__(
        self,
        *,
        id=1,
        role=UserRole.TOURIST,
        is_active=True,
        deleted_at=None,
    ):
        self.id = id
        self.role = role
        self.is_active = is_active
        self.deleted_at = deleted_at


# =========================================================
# require_role - Happy Path
# =========================================================

def test_require_role_success(monkeypatch):
    db = MagicMock()
    user = DummyUser(role=UserRole.ADMIN)

    monkeypatch.setattr(
        "app.services.role_permission_service.create_audit_log",
        lambda *args, **kwargs: None,
    )

    require_role(
        db=db,
        user=user,
        allowed_roles=[UserRole.ADMIN],
    )


# =========================================================
# require_role - DB missing
# =========================================================

def test_require_role_no_db():
    user = DummyUser()

    with pytest.raises(ValidationError):
        require_role(
            db=None,
            user=user,
            allowed_roles=[UserRole.ADMIN],
        )


# =========================================================
# require_role - No user
# =========================================================

def test_require_role_no_user():
    db = MagicMock()

    with pytest.raises(ForbiddenError):
        require_role(
            db=db,
            user=None,
            allowed_roles=[UserRole.ADMIN],
        )


# =========================================================
# require_role - Deleted user
# =========================================================

def test_require_role_deleted_user():
    db = MagicMock()
    user = DummyUser(deleted_at="timestamp")

    with pytest.raises(ForbiddenError):
        require_role(
            db=db,
            user=user,
            allowed_roles=[UserRole.ADMIN],
        )


# =========================================================
# require_role - Inactive user
# =========================================================

def test_require_role_inactive_user():
    db = MagicMock()
    user = DummyUser(is_active=False)

    with pytest.raises(ForbiddenError):
        require_role(
            db=db,
            user=user,
            allowed_roles=[UserRole.ADMIN],
        )


# =========================================================
# require_role - Invalid allowed_roles
# =========================================================

def test_require_role_invalid_allowed_roles():
    db = MagicMock()
    user = DummyUser()

    with pytest.raises(ValidationError):
        require_role(
            db=db,
            user=user,
            allowed_roles=[],
        )


def test_require_role_invalid_role_type():
    db = MagicMock()
    user = DummyUser()

    with pytest.raises(ValidationError):
        require_role(
            db=db,
            user=user,
            allowed_roles=["ADMIN"],  # not enum
        )


# =========================================================
# require_role - Access Denied triggers audit
# =========================================================

def test_require_role_access_denied(monkeypatch):
    db = MagicMock()
    user = DummyUser(role=UserRole.TOURIST)

    called = {}

    def fake_audit(*args, **kwargs):
        called["audit"] = True

    monkeypatch.setattr(
        "app.services.role_permission_service.create_audit_log",
        fake_audit,
    )

    with pytest.raises(ForbiddenError):
        require_role(
            db=db,
            user=user,
            allowed_roles=[UserRole.ADMIN],
        )

    assert called.get("audit") is True


# =========================================================
# Shortcut Functions
# =========================================================

def test_require_admin_success(monkeypatch):
    db = MagicMock()
    user = DummyUser(role=UserRole.ADMIN)

    monkeypatch.setattr(
        "app.services.role_permission_service.create_audit_log",
        lambda *args, **kwargs: None,
    )

    require_admin(db=db, user=user)


def test_require_authority_or_admin_success(monkeypatch):
    db = MagicMock()
    user = DummyUser(role=UserRole.AUTHORITY)

    monkeypatch.setattr(
        "app.services.role_permission_service.create_audit_log",
        lambda *args, **kwargs: None,
    )

    require_authority_or_admin(db=db, user=user)


def test_require_tourist_success(monkeypatch):
    db = MagicMock()
    user = DummyUser(role=UserRole.TOURIST)

    monkeypatch.setattr(
        "app.services.role_permission_service.create_audit_log",
        lambda *args, **kwargs: None,
    )

    require_tourist(db=db, user=user)


# =========================================================
# require_self_or_admin
# =========================================================

def test_require_self_or_admin_admin(monkeypatch):
    db = MagicMock()
    user = DummyUser(id=1, role=UserRole.ADMIN)

    monkeypatch.setattr(
        "app.services.role_permission_service.create_audit_log",
        lambda *args, **kwargs: None,
    )

    require_self_or_admin(
        db=db,
        current_user=user,
        target_user_id=999,
    )


def test_require_self_or_admin_self(monkeypatch):
    db = MagicMock()
    user = DummyUser(id=5, role=UserRole.TOURIST)

    monkeypatch.setattr(
        "app.services.role_permission_service.create_audit_log",
        lambda *args, **kwargs: None,
    )

    require_self_or_admin(
        db=db,
        current_user=user,
        target_user_id=5,
    )


def test_require_self_or_admin_denied(monkeypatch):
    db = MagicMock()
    user = DummyUser(id=5, role=UserRole.TOURIST)

    called = {}

    def fake_audit(*args, **kwargs):
        called["audit"] = True

    monkeypatch.setattr(
        "app.services.role_permission_service.create_audit_log",
        fake_audit,
    )

    with pytest.raises(ForbiddenError):
        require_self_or_admin(
            db=db,
            current_user=user,
            target_user_id=10,
        )

    assert called.get("audit") is True