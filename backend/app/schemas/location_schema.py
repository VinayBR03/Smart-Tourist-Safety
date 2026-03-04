# app/schemas/location_schema.py

from datetime import datetime
from typing import Optional

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_validator,
    model_validator,
)


# =========================================================
# Shared Limits
# =========================================================

MAX_REASONABLE_ACCURACY_METERS = 10000  # 10km upper cap
MAX_BATTERY = 100
MIN_BATTERY = 0


# =========================================================
# Update User Location (Mobile / IoT Fallback)
# =========================================================

class LocationUpdateRequest(BaseModel):
    """
    Used by mobile app or IoT fallback update.
    """

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

    accuracy_meters: Optional[float] = Field(
        None,
        ge=0,
        description="GPS accuracy in meters",
    )

    battery_percentage: Optional[float] = Field(
        None,
        ge=MIN_BATTERY,
        le=MAX_BATTERY,
    )

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    # -----------------------------------------------------
    # Accuracy sanity check
    # -----------------------------------------------------

    @field_validator("accuracy_meters")
    @classmethod
    def validate_accuracy(cls, value: Optional[float]):
        if value is not None and value > MAX_REASONABLE_ACCURACY_METERS:
            raise ValueError("Accuracy value unrealistic.")
        return value

    # -----------------------------------------------------
    # Prevent coordinate precision abuse
    # -----------------------------------------------------

    @field_validator("latitude", "longitude")
    @classmethod
    def normalize_coordinates(cls, value: float) -> float:
        # Round to 7 decimal places (~1cm precision)
        return round(value, 7)

    # -----------------------------------------------------
    # Logical consistency validation
    # -----------------------------------------------------

    @model_validator(mode="after")
    def validate_logical_consistency(self):
        # Example: extremely poor accuracy should not coexist with ultra precision coords
        if self.accuracy_meters is not None and self.accuracy_meters > 5000:
            # Warn-level constraint: allow but realistic threshold
            pass

        return self


# =========================================================
# Location Snapshot Response (Live Dashboard)
# =========================================================

class LocationResponse(BaseModel):
    """
    Used for authority live map.
    """

    tourist_id: int

    latitude: float
    longitude: float

    accuracy_meters: Optional[float]
    battery_percentage: Optional[float]

    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )


# =========================================================
# Live Zone Presence View
# =========================================================

class ZoneLivePresence(BaseModel):
    zone_id: int
    tourist_count: int

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )