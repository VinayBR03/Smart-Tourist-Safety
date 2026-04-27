# app/schemas/incident_schema.py

from datetime import datetime, timezone
from typing import Optional

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_validator,
    model_validator,
)

from app.core.enums import IncidentStatus, IncidentSource


# =========================================================
# Shared Limits
# =========================================================

MAX_TIMESTAMP_DRIFT_MINUTES = 5


# =========================================================
# Create Incident
# =========================================================

class IncidentCreateRequest(BaseModel):
    """
    Used for:
    - Manual incident creation
    - IoT-triggered SOS
    - Auto health/fall detection
    """

    description: str = Field(..., max_length=500)

    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)

    zone_id: Optional[int] = Field(None, ge=1)

    source: IncidentSource
    is_auto_generated: bool = False

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    # -----------------------------------------------------
    # Description normalization
    # -----------------------------------------------------

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 5:
            raise ValueError("Incident description too short.")
        return value

    # -----------------------------------------------------
    # Coordinate normalization
    # -----------------------------------------------------

    @field_validator("latitude", "longitude")
    @classmethod
    def normalize_coordinates(cls, value: Optional[float]):
        if value is not None:
            return round(value, 7)
        return value

    # -----------------------------------------------------
    # Logical validation
    # -----------------------------------------------------

    @model_validator(mode="after")
    def validate_incident_payload(self):
        has_gps = self.latitude is not None and self.longitude is not None
        has_zone = self.zone_id is not None

        if not (has_gps or has_zone):
            raise ValueError(
                "Incident must include either GPS coordinates or zone_id."
            )

        # Auto incidents must not be manual source
        if self.is_auto_generated and self.source.name == "MANUAL":
            raise ValueError(
                "Auto-generated incidents cannot have MANUAL source."
            )

        return self


# =========================================================
# Update Incident Status
# =========================================================

class IncidentStatusUpdateRequest(BaseModel):
    status: IncidentStatus

    model_config = ConfigDict(extra="forbid")

    @field_validator("status")
    @classmethod
    def prevent_direct_resolution(cls, value: IncidentStatus):
        """
        Resolution should go through dedicated resolve endpoint.
        """
        if value in {IncidentStatus.RESOLVED, IncidentStatus.CLOSED}:
            raise ValueError(
                "Use resolve endpoint to mark incident as resolved."
            )
        return value


# =========================================================
# Resolve Incident
# =========================================================

class IncidentResolveRequest(BaseModel):
    """
    Used when authority resolves an incident.
    """

    resolution_note: Optional[str] = Field(None, max_length=500)

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    @field_validator("resolution_note")
    @classmethod
    def normalize_resolution_note(cls, value: Optional[str]):
        if value:
            value = value.strip()
            if len(value) < 3:
                raise ValueError("Resolution note too short.")
        return value


# =========================================================
# Incident Response (Full)
# =========================================================

class IncidentResponse(BaseModel):
    id: int

    tourist_id: Optional[int]
    zone_id: Optional[int]

    description: str
    status: IncidentStatus
    source: IncidentSource
    is_auto_generated: bool

    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )


# =========================================================
# Incident Summary (Dashboard)
# =========================================================

class IncidentSummaryResponse(BaseModel):
    id: int
    status: IncidentStatus
    source: IncidentSource
    zone_id: Optional[int]
    is_auto_generated: bool
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )


# =========================================================
# Incident Timeline Entry
# =========================================================

class IncidentTimelineEntry(BaseModel):
    status: IncidentStatus
    changed_at: datetime
    changed_by: Optional[int]

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )