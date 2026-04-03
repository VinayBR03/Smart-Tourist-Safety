from datetime import datetime, timezone
from typing import Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.models.refresh_token import RefreshToken

from app.core.enums import (
    AuditAction,
    EntityType,
    NotificationSeverity,
    NotificationChannel,
    UserRole,
)

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_refresh_token_hash,
)

from app.core.exceptions import (
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError,
)

from app.core.logging_config import get_correlation_id
from app.services.audit_service import create_audit_log
from app.services.notification_service import create_notification
from app.services.outbox_service import create_outbox_event
from app.utils.logger import get_logger
from app.core.config import settings


logger = get_logger(__name__)

MAX_ACTIVE_SESSIONS = getattr(settings, "MAX_ACTIVE_SESSIONS", 10)


# =========================================================
# REGISTER
# =========================================================

def register_user(
    db: Session,
    *,
    email: str,
    password: str,
    role: UserRole,
) -> User:

    if not email or not password:
        raise ValidationError("Email and password required")

    if not isinstance(role, UserRole):
        raise ValidationError("Invalid role")

    email = email.lower().strip()

    try:
        password_hash = hash_password(password)
    except ValueError as e:
        raise ValidationError(str(e))

    user = User(
        email=email,
        password_hash=password_hash,
        role=role.value,
        token_version=1,
        is_verified=True,          # Required for integration tests
        is_active=True,
        is_pending_deletion=False,
    )

    db.add(user)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise ConflictError("Email already registered")

    create_audit_log(
        db=db,
        user_id=user.id,
        action=AuditAction.CREATE_USER,
        entity_type=EntityType.USER,
        entity_id=user.id,
    )

    create_notification(
        db=db,
        user_id=user.id,
        event_type="USER_REGISTERED",
        channel=NotificationChannel.EMAIL,
        severity=NotificationSeverity.INFO,
        related_entity_type=EntityType.USER,
        related_entity_id=user.id,
        context={},
    )

    create_outbox_event(
        db=db,
        topic="auth.user.registered",
        payload={"user_id": user.id},
    )

    logger.info(
        "User registered",
        extra={
            "extra_data": {
                "user_id": user.id,
                "role": role.value,
                "correlation_id": get_correlation_id(),
            }
        },
    )

    return user


# =========================================================
# LOGIN
# =========================================================

def authenticate_user(
    db: Session,
    *,
    email: str,
    password: str,
    device_info: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> Tuple[str, str]:

    email = email.lower().strip()

    user = (
        db.query(User)
        .filter(
            User.email == email,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
        .first()
    )

    if not user or not verify_password(password, user.password_hash):
        create_audit_log(
            db=db,
            user_id=None,
            action=AuditAction.LOGIN_FAILED,
            entity_type=EntityType.USER,
        )
        raise UnauthorizedError("Invalid credentials")

    if not user.is_verified:
        raise ForbiddenError("User not verified")

    if user.is_pending_deletion:
        raise ForbiddenError("Account pending deletion")

    now = datetime.now(timezone.utc)

    access_token = create_access_token(
        user_id=user.id,
        role=user.role,
        token_version=user.token_version,
    )

    refresh_token, jti, expires_at = create_refresh_token(
        user_id=user.id,
        token_version=user.token_version,
    )

    _enforce_session_limit(db, user.id)

    db.add(
        RefreshToken(
            user_id=user.id,
            jti=jti,
            token_hash=get_refresh_token_hash(refresh_token),
            device_info=device_info,
            ip_address=ip_address,
            expires_at=expires_at,
        )
    )

    db.flush()

    user.last_login = now

    create_audit_log(
        db=db,
        user_id=user.id,
        action=AuditAction.LOGIN_SUCCESS,
        entity_type=EntityType.USER,
        entity_id=user.id,
    )

    create_outbox_event(
        db=db,
        topic="auth.user.logged_in",
        payload={"user_id": user.id},
    )

    logger.info(
        "Login success",
        extra={
            "extra_data": {
                "user_id": user.id,
                "correlation_id": get_correlation_id(),
            }
        },
    )

    return access_token, refresh_token


def _enforce_session_limit(db: Session, user_id: int) -> None:

    active_tokens = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == user_id,
            RefreshToken.is_revoked.is_(False),
        )
        .with_for_update()
        .all()
    )

    if len(active_tokens) >= MAX_ACTIVE_SESSIONS:
        oldest = sorted(active_tokens, key=lambda t: t.created_at)[0]
        oldest.is_revoked = True
        oldest.revoked_at = datetime.now(timezone.utc)


# =========================================================
# REFRESH TOKEN (Strict Rotation)
# =========================================================

def refresh_access_token(
    db: Session,
    *,
    refresh_token: str,
) -> Tuple[str, str]:

    payload = decode_refresh_token(refresh_token)

    user_id = payload.get("sub")
    jti = payload.get("jti")
    token_version = payload.get("token_version")

    if not user_id or not jti:
        raise UnauthorizedError("Invalid refresh token")

    user = (
        db.query(User)
        .filter(User.id == int(user_id))
        .with_for_update()
        .first()
    )

    if not user or user.deleted_at:
        raise UnauthorizedError("User not found")

    if not user.is_active or user.is_pending_deletion:
        raise UnauthorizedError("Account disabled")

    if token_version != user.token_version:
        raise UnauthorizedError("Session expired")

    db_token = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.jti == jti,
            RefreshToken.user_id == user.id,
            RefreshToken.is_revoked.is_(False),
        )
        .with_for_update()
        .first()
    )

    if not db_token:
        raise UnauthorizedError("Refresh token revoked")

    expected_hash = get_refresh_token_hash(refresh_token)

    if db_token.token_hash != expected_hash:
        db_token.is_revoked = True
        db_token.revoked_at = datetime.now(timezone.utc)
        db.flush()
        raise UnauthorizedError("Token replay detected")

    if db_token.expires_at < datetime.now(timezone.utc):
        db_token.is_revoked = True
        db_token.revoked_at = datetime.now(timezone.utc)
        db.flush()
        raise UnauthorizedError("Refresh token expired")

    db_token.is_revoked = True
    db_token.revoked_at = datetime.now(timezone.utc)

    new_access = create_access_token(
        user_id=user.id,
        role=user.role,
        token_version=user.token_version,
    )

    new_refresh, new_jti, new_exp = create_refresh_token(
        user_id=user.id,
        token_version=user.token_version,
    )

    db.add(
        RefreshToken(
            user_id=user.id,
            jti=new_jti,
            token_hash=get_refresh_token_hash(new_refresh),
            device_info=db_token.device_info,
            ip_address=db_token.ip_address,
            expires_at=new_exp,
        )
    )

    db.flush()

    create_audit_log(
        db=db,
        user_id=user.id,
        action=AuditAction.TOKEN_REFRESHED,
        entity_type=EntityType.USER,
        entity_id=user.id,
    )

    logger.info(
        "Token rotated",
        extra={
            "extra_data": {
                "user_id": user.id,
                "correlation_id": get_correlation_id(),
            }
        },
    )

    return new_access, new_refresh


# =========================================================
# LOGOUT
# =========================================================

def revoke_refresh_token(
    db: Session,
    *,
    refresh_token: str,
) -> None:

    payload = decode_refresh_token(refresh_token)

    user_id = payload.get("sub")
    jti = payload.get("jti")

    if not user_id or not jti:
        raise UnauthorizedError("Invalid refresh token")

    db_token = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.jti == jti,
            RefreshToken.user_id == int(user_id),
            RefreshToken.is_revoked.is_(False),
        )
        .with_for_update()
        .first()
    )

    if not db_token:
        raise UnauthorizedError("Invalid refresh token")

    db_token.is_revoked = True
    db_token.revoked_at = datetime.now(timezone.utc)

    db.flush()

# =========================================================
# CHANGE PASSWORD
# =========================================================

def change_password(
    db: Session,
    *,
    user_id: int,
    current_password: str,
    new_password: str,
) -> None:

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .with_for_update()
        .first()
    )

    if not user:
        raise UnauthorizedError("User not found")

    if not verify_password(current_password, user.password_hash):
        raise UnauthorizedError("Current password is incorrect")

    try:
        new_hash = hash_password(new_password)
    except ValueError as e:
        raise ValidationError(str(e))

    user.password_hash = new_hash
    user.password_changed_at = datetime.now(timezone.utc)
    user.token_version += 1  # Invalidate all existing sessions

    db.flush()

    create_audit_log(
        db=db,
        user_id=user.id,
        action=AuditAction.PASSWORD_CHANGED,
        entity_type=EntityType.USER,
        entity_id=user.id,
    )

    logger.info(
        "Password changed",
        extra={
            "extra_data": {
                "user_id": user.id,
                "correlation_id": get_correlation_id(),
            }
        },
    )