# app/schemas/device_schema.py

from datetime import datetime
from typing import Optional

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_validator,
)

from app.core.enums import DeviceType, DeviceStatus


# =========================================================
# Shared Validation
# =========================================================

RESERVED_DEVICE_IDS = {"admin", "root", "system", "null"}


def normalize_device_id(value: str) -> str:
    return value.strip().lower()


# =========================================================
# Device Registration (Admin Only)
# =========================================================

class DeviceRegisterRequest(BaseModel):
    device_id: str = Field(..., min_length=3, max_length=50)
    device_type: DeviceType

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    @field_validator("device_id")
    @classmethod
    def validate_device_id(cls, value: str) -> str:
        value = normalize_device_id(value)

        if value in RESERVED_DEVICE_IDS:
            raise ValueError("Reserved device_id not allowed.")

        if " " in value:
            raise ValueError("device_id cannot contain spaces.")

        return value


# =========================================================
# Device Registration Response
# =========================================================

class DeviceRegisterResponse(BaseModel):
    device_id: str
    device_type: DeviceType
    api_key: str  # shown once only

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )


# =========================================================
# Device Heartbeat Update
# =========================================================

class DeviceHeartbeatRequest(BaseModel):
    battery_percentage: Optional[float] = Field(None, ge=0, le=100)
    battery_voltage: Optional[float] = Field(None, ge=0)

    firmware_version: Optional[str] = Field(
        None,
        max_length=50,
    )

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    @field_validator("firmware_version")
    @classmethod
    def normalize_firmware(cls, value: Optional[str]):
        if value:
            value = value.strip()
            if len(value) < 2:
                raise ValueError("Invalid firmware version.")
        return value


# =========================================================
# Device Status Update (Admin)
# =========================================================

class DeviceStatusUpdateRequest(BaseModel):
    status: DeviceStatus

    model_config = ConfigDict(
        extra="forbid",
    )

    @field_validator("status")
    @classmethod
    def prevent_illegal_status(cls, value: DeviceStatus):
        """
        Prevent direct reactivation of decommissioned device via generic endpoint.
        """
        if value.name == "DECOMMISSIONED":
            # Decommission should go through dedicated workflow
            raise ValueError(
                "Use dedicated endpoint for device decommission."
            )
        return value


# =========================================================
# Device Response (Full View)
# =========================================================

class DeviceResponse(BaseModel):
    id: int
    device_id: str
    device_type: DeviceType
    status: DeviceStatus

    is_verified: bool

    battery_percentage: Optional[float]
    battery_voltage: Optional[float]
    battery_updated_at: Optional[datetime]

    firmware_version: Optional[str]
    last_seen: Optional[datetime]

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )


# =========================================================
# Device Summary View (Dashboard)
# =========================================================

class DeviceSummaryResponse(BaseModel):
    device_id: str
    device_type: DeviceType
    status: DeviceStatus
    battery_percentage: Optional[float]
    last_seen: Optional[datetime]

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )