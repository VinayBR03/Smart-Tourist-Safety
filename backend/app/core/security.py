# app/core/security.py

from datetime import datetime, timedelta, timezone
from typing import Dict, Any
import uuid
import hashlib
import secrets

import bcrypt
from jose import jwt, JWTError

from fastapi import HTTPException, status

from app.core.config import settings
from app.utils.logger import get_logger


logger = get_logger(__name__)


# =========================================================
# Password Hashing (Config Driven)
# =========================================================

def hash_password(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")

    salt = bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


# =========================================================
# Refresh Token Hashing (Storage Safe)
# =========================================================

def _hash_token(token: str) -> str:
    # Deterministic SHA256 for DB storage comparison
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_refresh_token_hash(token: str) -> str:
    return _hash_token(token)


# =========================================================
# Internal Token Generator
# =========================================================

def _create_token(
    *,
    data: Dict[str, Any],
    secret_key: str,
    expires_delta: timedelta,
) -> str:

    now = datetime.now(timezone.utc)
    expire = now + expires_delta

    to_encode = data.copy()
    to_encode.update(
        {
            "iat": now,
            "nbf": now,
            "exp": expire,
            "iss": settings.PROJECT_NAME,
            "aud": "smart_tourist_users",
        }
    )

    return jwt.encode(
        to_encode,
        secret_key,
        algorithm=settings.JWT_ALGORITHM,
    )


# =========================================================
# Access Token
# =========================================================

def create_access_token(
    *,
    user_id: int,
    role: str,
    token_version: int,
) -> str:

    return _create_token(
        data={
            "sub": str(user_id),
            "role": role,
            "type": "access",
            "token_version": token_version,
        },
        secret_key=settings.JWT_SECRET_KEY,
        expires_delta=timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        ),
    )


# =========================================================
# Refresh Token
# =========================================================

def create_refresh_token(
    *,
    user_id: int,
    token_version: int,
) -> tuple[str, str, datetime]:

    jti = str(uuid.uuid4())
    expires_delta = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    expires_at = datetime.now(timezone.utc) + expires_delta

    token = _create_token(
        data={
            "sub": str(user_id),
            "type": "refresh",
            "jti": jti,
            "token_version": token_version,
        },
        secret_key=settings.JWT_REFRESH_SECRET_KEY,
        expires_delta=expires_delta,
    )

    return token, jti, expires_at


# =========================================================
# Token Decoding (Strict + Defensive)
# =========================================================

def _decode_token(
    *,
    token: str,
    secret_key: str,
    expected_type: str,
) -> Dict[str, Any]:

    try:
        payload = jwt.decode(
            token,
            secret_key,
            algorithms=[settings.JWT_ALGORITHM],
            audience="smart_tourist_users",
            issuer=settings.PROJECT_NAME,
        )

        # Validate token type
        if payload.get("type") != expected_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )

        # Ensure subject exists
        if "sub" not in payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        return payload

    except JWTError:
        logger.warning("Invalid or expired JWT detected")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def decode_access_token(token: str) -> Dict[str, Any]:
    return _decode_token(
        token=token,
        secret_key=settings.JWT_SECRET_KEY,
        expected_type="access",
    )


def decode_refresh_token(token: str) -> Dict[str, Any]:
    return _decode_token(
        token=token,
        secret_key=settings.JWT_REFRESH_SECRET_KEY,
        expected_type="refresh",
    )


# =========================================================
# Internal Service Authentication
# =========================================================

def verify_internal_service_token(token: str) -> None:
    """
    Constant-time comparison to prevent timing attacks.
    """

    if not secrets.compare_digest(
        token,
        settings.INTERNAL_SERVICE_TOKEN,
    ):
        logger.warning("Invalid internal service token attempt")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal service token",
        )