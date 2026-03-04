# app/schemas/iot_schema.py

from datetime import datetime, timezone
from typing import Optional

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_validator,
    model_validator,
)

from app.core.enums import EventSource


# =========================================================
# Constants
# =========================================================

MAX_TIMESTAMP_DRIFT_MINUTES = 5
MAX_FIRMWARE_VERSION_LENGTH = 50
MIN_DEVICE_ID_LENGTH = 3
MAX_DEVICE_ID_LENGTH = 50


# =========================================================
# Device Authentication Header (Internal)
# =========================================================

class IoTAuthHeader(BaseModel):
    """
    Used internally after API key validation.
    Not exposed directly to clients.
    """

    device_id: str = Field(
        ...,
        min_length=MIN_DEVICE_ID_LENGTH,
        max_length=MAX_DEVICE_ID_LENGTH,
    )

    firmware_version: Optional[str] = Field(
        None,
        max_length=MAX_FIRMWARE_VERSION_LENGTH,
    )

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        frozen=True,
    )


# =========================================================
# IoT Location Ingestion
# =========================================================

class IoTLocationRequest(BaseModel):
    """
    Sent by wristband or node devices.
    """

    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)

    zone_id: Optional[int] = Field(None, ge=1)

    rssi: Optional[float] = Field(None, ge=-150, le=0)

    sos_flag: bool = False

    recorded_at: Optional[datetime] = None

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    # -----------------------------------------------------
    # Must contain GPS or zone fallback
    # -----------------------------------------------------

    @model_validator(mode="after")
    def validate_location_or_zone(self):
        has_gps = self.latitude is not None and self.longitude is not None
        has_zone = self.zone_id is not None

        if not (has_gps or has_zone):
            raise ValueError("Location must include GPS coordinates or zone_id.")

        return self

    # -----------------------------------------------------
    # Normalize coordinates
    # -----------------------------------------------------

    @field_validator("latitude", "longitude")
    @classmethod
    def normalize_coordinates(cls, value: Optional[float]):
        if value is not None:
            return round(value, 7)
        return value

    # -----------------------------------------------------
    # Timestamp drift protection
    # -----------------------------------------------------

    @field_validator("recorded_at")
    @classmethod
    def validate_timestamp(cls, value: Optional[datetime]):
        if value is None:
            return value

        now = datetime.now(timezone.utc)
        drift = abs((now - value).total_seconds()) / 60

        if drift > MAX_TIMESTAMP_DRIFT_MINUTES:
            raise ValueError("recorded_at drift exceeds allowed limit.")

        return value


# =========================================================
# IoT Health Ingestion
# =========================================================

class IoTHealthRequest(BaseModel):
    heart_rate: Optional[float] = Field(None, gt=0)
    spo2: Optional[float] = Field(None, ge=0, le=100)
    body_temperature: Optional[float] = Field(None, gt=0)

    is_alert: bool = False
    alert_type: Optional[str] = Field(None, max_length=50)

    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)

    recorded_at: Optional[datetime] = None

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    # -----------------------------------------------------
    # At least one health metric required
    # -----------------------------------------------------

    @model_validator(mode="after")
    def validate_metrics_present(self):
        if not any([
            self.heart_rate is not None,
            self.spo2 is not None,
            self.body_temperature is not None,
        ]):
            raise ValueError("At least one health metric must be provided.")
        return self

    # -----------------------------------------------------
    # Timestamp validation
    # -----------------------------------------------------

    @field_validator("recorded_at")
    @classmethod
    def validate_timestamp(cls, value: Optional[datetime]):
        if value is None:
            return value

        now = datetime.now(timezone.utc)
        drift = abs((now - value).total_seconds()) / 60

        if drift > MAX_TIMESTAMP_DRIFT_MINUTES:
            raise ValueError("recorded_at drift exceeds allowed limit.")

        return value


# =========================================================
# IoT Heartbeat
# =========================================================

class IoTHeartbeatRequest(BaseModel):
    battery_percentage: Optional[float] = Field(None, ge=0, le=100)
    battery_voltage: Optional[float] = Field(None, ge=0)
    firmware_version: Optional[str] = Field(None, max_length=MAX_FIRMWARE_VERSION_LENGTH)

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


# =========================================================
# Generic IoT Response
# =========================================================

class IoTResponse(BaseModel):
    status: str

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )