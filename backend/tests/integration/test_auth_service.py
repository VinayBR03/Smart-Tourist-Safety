#tests/integration/test_auth_service.py

import pytest
from datetime import datetime, timezone, timedelta

from app.services.auth_service import (
    register_user,
    authenticate_user,
    refresh_access_token,
)

from app.models.user import User
from app.models.refresh_token import RefreshToken

from app.core.enums import UserRole
from app.core.exceptions import (
    ValidationError,
    UnauthorizedError,
    ConflictError,
)


# =========================================================
# REGISTER
# =========================================================

def test_register_user_success(db_session):
    user = register_user(
        db_session,
        email="test@example.com",
        password="StrongPass123",
        role=UserRole.TOURIST,
    )

    db_session.commit()

    saved = db_session.query(User).filter_by(email="test@example.com").first()

    assert saved is not None
    assert saved.id == user.id
    assert saved.role == UserRole.TOURIST.value
    assert saved.password_hash is not None


def test_register_duplicate_email(db_session):
    register_user(
        db_session,
        email="dup@example.com",
        password="StrongPass123",
        role=UserRole.TOURIST,
    )
    db_session.commit()

    with pytest.raises(ConflictError):
        register_user(
            db_session,
            email="dup@example.com",
            password="StrongPass123",
            role=UserRole.TOURIST,
        )


def test_register_weak_password(db_session):
    with pytest.raises(ValidationError):
        register_user(
            db_session,
            email="weak@example.com",
            password="123",
            role=UserRole.TOURIST,
        )


# =========================================================
# LOGIN
# =========================================================

def test_authenticate_user_success(db_session):
    register_user(
        db_session,
        email="login@example.com",
        password="StrongPass123",
        role=UserRole.TOURIST,
    )
    db_session.commit()

    access, refresh = authenticate_user(
        db_session,
        email="login@example.com",
        password="StrongPass123",
    )

    db_session.commit()

    assert access is not None
    assert refresh is not None

    tokens = db_session.query(RefreshToken).all()
    assert len(tokens) == 1
    assert tokens[0].is_revoked is False


def test_authenticate_user_invalid_password(db_session):
    register_user(
        db_session,
        email="fail@example.com",
        password="StrongPass123",
        role=UserRole.TOURIST,
    )
    db_session.commit()

    with pytest.raises(UnauthorizedError):
        authenticate_user(
            db_session,
            email="fail@example.com",
            password="WrongPass",
        )


# =========================================================
# REFRESH TOKEN ROTATION
# =========================================================

def test_refresh_token_success(db_session):
    register_user(
        db_session,
        email="refresh@example.com",
        password="StrongPass123",
        role=UserRole.TOURIST,
    )
    db_session.commit()

    _, refresh = authenticate_user(
        db_session,
        email="refresh@example.com",
        password="StrongPass123",
    )
    db_session.commit()

    new_access, new_refresh = refresh_access_token(
        db_session,
        refresh_token=refresh,
    )
    db_session.commit()

    tokens = db_session.query(RefreshToken).all()

    # Old token revoked, new token created
    assert len(tokens) == 2
    revoked_count = sum(1 for t in tokens if t.is_revoked)
    assert revoked_count == 1

    assert new_access is not None
    assert new_refresh is not None


def test_refresh_token_replay_attack(db_session):
    register_user(
        db_session,
        email="replay@example.com",
        password="StrongPass123",
        role=UserRole.TOURIST,
    )
    db_session.commit()

    _, refresh = authenticate_user(
        db_session,
        email="replay@example.com",
        password="StrongPass123",
    )
    db_session.commit()

    # First refresh works
    refresh_access_token(db_session, refresh_token=refresh)
    db_session.commit()

    # Second attempt with same token should fail
    with pytest.raises(UnauthorizedError):
        refresh_access_token(db_session, refresh_token=refresh)


def test_refresh_token_expired(db_session):
    user = register_user(
        db_session,
        email="expired@example.com",
        password="StrongPass123",
        role=UserRole.TOURIST,
    )
    db_session.commit()

    _, refresh = authenticate_user(
        db_session,
        email="expired@example.com",
        password="StrongPass123",
    )
    db_session.commit()

    token = db_session.query(RefreshToken).first()
    token.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()

    with pytest.raises(UnauthorizedError):
        refresh_access_token(db_session, refresh_token=refresh)