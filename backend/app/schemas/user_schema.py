# app/schema/user_schema.py

from datetime import datetime
from typing import Optional

from pydantic import (
    BaseModel,
    Field,
    EmailStr,
    ConfigDict,
    field_validator,
)

from app.core.enums import UserRole, UserLanguage


# =========================================================
# Base User Fields (Shared)
# =========================================================


class UserBase(BaseModel):
    email: EmailStr = Field(..., max_length=255)
    full_name: Optional[str] = Field(None, max_length=150)
    phone: Optional[str] = Field(None, max_length=20)
    preferred_language: UserLanguage = UserLanguage.EN

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.lower().strip()

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: Optional[str]) -> Optional[str]:
        if value:
            return value.strip()
        return value


# =========================================================
# Create User (Registration)
# =========================================================


class UserCreateRequest(UserBase):
    password: str = Field(..., min_length=8, max_length=128)

    role: UserRole = UserRole.TOURIST

    model_config = ConfigDict(extra="forbid")

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return value


# =========================================================
# Update Profile (Self-Service)
# =========================================================


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, max_length=150)
    phone: Optional[str] = Field(None, max_length=20)
    preferred_language: Optional[UserLanguage] = None

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: Optional[str]) -> Optional[str]:
        if value:
            return value.strip()
        return value


# =========================================================
# Admin Update (Role / Status Control)
# =========================================================


class UserAdminUpdateRequest(BaseModel):
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None

    model_config = ConfigDict(extra="forbid")


# =========================================================
# Public User Response
# =========================================================


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: UserRole
    is_active: bool
    is_verified: bool
    preferred_language: UserLanguage

    full_name: Optional[str]
    phone: Optional[str]

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )


# =========================================================
# Admin User Response (Extended)
# =========================================================


class UserAdminResponse(UserResponse):
    token_version: int
    last_login: Optional[datetime]
    password_changed_at: Optional[datetime]

    is_pending_deletion: bool
    deletion_requested_at: Optional[datetime]

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )