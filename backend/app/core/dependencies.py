# app/core/dependencies.py

from typing import Optional, Set

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.enums import DeviceStatus, UserRole
from app.models.user import User
from app.models.iot_device import IoTDevice
from app.core.security import get_refresh_token_hash, verify_internal_service_token,decode_access_token
from app.utils.logger import get_logger


logger = get_logger("security")

security = HTTPBearer(auto_error=True)


# =========================================================
# Get Current Authenticated User (Enterprise Hardened)
# =========================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Fully hardened JWT validation.

    Enforces:
    - Bearer scheme
    - Token type (access only)
    - Required claims
    - User existence
    - Active state
    - Soft delete protection
    - Verification status
    - Token version match (revocation safety)
    - Role tampering protection
    """

    token = credentials.credentials

    payload = decode_access_token(token)

    user_id = payload.get("sub")
    token_role = payload.get("role")
    token_version = payload.get("token_version")

    if user_id is None or token_role is None or token_version is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Account state checks
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account inactive",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not verified",
        )

    if user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account deleted",
        )

    # Session revocation safety
    if user.token_version != token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalidated. Please login again.",
        )

    # Role tampering prevention
    if user.role.value != token_role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token role mismatch",
        )

    return user


# =========================================================
# Role-Based Authorization (Generic + Enum Safe)
# =========================================================

def require_roles(*allowed_roles: UserRole):

    allowed: Set[str] = {role.value for role in allowed_roles}

    def role_dependency(
        current_user: User = Depends(get_current_user),
    ) -> User:

        if current_user.role.value not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )

        return current_user

    return role_dependency


# =========================================================
# IoT Device Authentication (Enterprise Hardened)
# =========================================================

def get_current_iot_device(
    x_api_key: str = Header(..., min_length=20, max_length=512),
    db: Session = Depends(get_db),
) -> IoTDevice:
    """
    Validates IoT device using API key.

    Enforces:
    - Header presence
    - Key length sanity
    - Device existence
    - Active status
    - Verified state
    """

    hashed_key = get_refresh_token_hash(x_api_key)

    device = (
        db.query(IoTDevice)
        .filter(IoTDevice.api_key_hash == hashed_key)
        .first()
    )

    if not device:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid IoT device",
        )

    if device.status != DeviceStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="IoT device inactive",
        )

    if not device.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="IoT device not verified",
        )

    return device


# =========================================================
# Internal ML / Service Guard
# =========================================================

def internal_service_required(
    x_internal_token: Optional[str] = Header(None),
) -> None:
    """
    Protect internal-only endpoints.
    """

    if not x_internal_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing internal service token",
        )

    verify_internal_service_token(x_internal_token)