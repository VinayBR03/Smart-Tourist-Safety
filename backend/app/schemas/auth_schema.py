from datetime import datetime
from typing import Optional
import re

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    ConfigDict,
    field_validator,
)

from app.core.enums import UserRole


# =========================================================
# Shared Constants
# =========================================================

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128
MAX_DEVICE_INFO_LENGTH = 255


# =========================================================
# User Registration
# =========================================================

class RegisterRequest(BaseModel):

    email: EmailStr
    password: str = Field(
        ...,
        min_length=MIN_PASSWORD_LENGTH,
        max_length=MAX_PASSWORD_LENGTH,
    )

    role: UserRole  # Required for API validation

    full_name: Optional[str] = Field(None, max_length=150)
    phone: Optional[str] = Field(None, max_length=20)

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        value = value.strip()

        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must contain at least one uppercase letter.")

        if not re.search(r"[a-z]", value):
            raise ValueError("Password must contain at least one lowercase letter.")

        if not re.search(r"\d", value):
            raise ValueError("Password must contain at least one number.")

        if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?]", value):
            raise ValueError("Password must contain at least one special character.")

        return value

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: Optional[str]):
        if value:
            value = value.strip()
            if len(value) < 7:
                raise ValueError("Invalid phone number.")
        return value


# =========================================================
# Login Request
# =========================================================

class LoginRequest(BaseModel):

    email: EmailStr
    password: str = Field(
        ...,
        min_length=MIN_PASSWORD_LENGTH,
        max_length=MAX_PASSWORD_LENGTH,
    )

    device_info: Optional[str] = Field(
        None,
        max_length=MAX_DEVICE_INFO_LENGTH,
        description="Optional device metadata for session tracking",
    )

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("device_info")
    @classmethod
    def normalize_device_info(cls, value: Optional[str]):
        if value:
            return value.strip()
        return value


# =========================================================
# JWT Token Response
# =========================================================

class TokenResponse(BaseModel):

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )

    @field_validator("token_type")
    @classmethod
    def validate_token_type(cls, value: str):
        if value.lower() != "bearer":
            raise ValueError("Unsupported token type.")
        return "bearer"

    @field_validator("access_token", "refresh_token")
    @classmethod
    def validate_token_format(cls, value: str):
        value = value.strip()

        if " " in value:
            raise ValueError("Invalid token format.")

        if len(value) < 20:
            raise ValueError("Token too short.")

        return value


# =========================================================
# Refresh Token Request
# =========================================================

class RefreshTokenRequest(BaseModel):

    refresh_token: str  # Validation handled in service

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    @field_validator("refresh_token")
    @classmethod
    def validate_refresh_token(cls, value: str):
        value = value.strip()

        if " " in value:
            raise ValueError("Invalid token format.")

        return value


# =========================================================
# Logout Request
# =========================================================

class LogoutRequest(BaseModel):

    refresh_token: str  # Validation handled in service

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    @field_validator("refresh_token")
    @classmethod
    def validate_logout_token(cls, value: str):
        value = value.strip()

        if " " in value:
            raise ValueError("Invalid token format.")

        return value


# =========================================================
# Authenticated User Profile
# =========================================================

class AuthenticatedUserResponse(BaseModel):

    id: int
    email: EmailStr
    role: UserRole
    is_active: bool
    is_verified: bool
    last_login: Optional[datetime]

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )