# app/schemas/location_event_schema.py

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
MIN_DEVICE_ID_LENGTH = 3
MAX_DEVICE_ID_LENGTH = 50


# =========================================================
# Location Event Ingestion
# =========================================================

class LocationEventCreateRequest(BaseModel):
    """
    Used internally by mobile & IoT ingestion endpoints.
    """

    tourist_id: Optional[int] = Field(None, ge=1)
    device_id: Optional[str] = Field(
        None,
        min_length=MIN_DEVICE_ID_LENGTH,
        max_length=MAX_DEVICE_ID_LENGTH,
    )

    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)

    zone_id: Optional[int] = Field(None, ge=1)

    rssi: Optional[float] = Field(None, ge=-150, le=0)

    source: EventSource

    sos_flag: bool = False

    timestamp: Optional[datetime] = None

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    # -----------------------------------------------------
    # Identity rule (matches DB constraint)
    # Must have either tourist_id OR device_id
    # -----------------------------------------------------

    @model_validator(mode="after")
    def validate_identity(self):
        if not (self.tourist_id or self.device_id):
            raise ValueError(
                "LocationEvent must include tourist_id or device_id."
            )
        return self

    # -----------------------------------------------------
    # Must contain GPS or zone fallback
    # -----------------------------------------------------

    @model_validator(mode="after")
    def validate_location_or_zone(self):
        has_gps = self.latitude is not None and self.longitude is not None
        has_zone = self.zone_id is not None

        if not (has_gps or has_zone):
            raise ValueError(
                "LocationEvent must include GPS coordinates or zone_id."
            )
        return self

    # -----------------------------------------------------
    # Normalize coordinates precision
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

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, value: Optional[datetime]):
        if value is None:
            return value

        now = datetime.now(timezone.utc)
        drift = abs((now - value).total_seconds()) / 60

        if drift > MAX_TIMESTAMP_DRIFT_MINUTES:
            raise ValueError("Timestamp drift exceeds allowed limit.")

        return value


# =========================================================
# Location Event Response
# =========================================================

class LocationEventResponse(BaseModel):
    id: int

    tourist_id: Optional[int]
    device_id: Optional[str]
    zone_id: Optional[int]

    rssi: Optional[float]
    source: EventSource
    sos_flag: bool

    timestamp: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )


# =========================================================
# Zone Aggregation View (Authority Dashboard)
# =========================================================

class ZoneActivitySummary(BaseModel):
    zone_id: int
    event_count: int
    unique_tourists: int
    sos_count: int

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )