from datetime import datetime
from typing import Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    model_validator,
    Field,
    AliasChoices,
)

from app.core.enums import IncidentStatus


# =========================================================
# Status History Response (Immutable)
# =========================================================

class IncidentStatusHistoryResponse(BaseModel):
    """
    Immutable status transition record.

    Used for:
    - Audit review
    - SLA measurement
    - Timeline rendering
    - Compliance export

    This is a response model.
    It does NOT enforce timestamp freshness validation.
    """

    id: int
    incident_id: int
    changed_by: Optional[int]

    old_status: IncidentStatus
    new_status: IncidentStatus

    changed_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )

    # -----------------------------------------------------
    # Prevent same-state transition (defensive validation)
    # -----------------------------------------------------

    @model_validator(mode="after")
    def validate_transition(self):
        if self.old_status == self.new_status:
            raise ValueError(
                "Invalid transition: old_status equals new_status."
            )
        return self


# =========================================================
# Simplified Timeline View
# =========================================================

class IncidentTimelineResponse(BaseModel):
    """
    Lightweight projection for incident timeline display.

    Historical records are allowed.
    No freshness validation is applied here.
    """

    status: IncidentStatus = Field(validation_alias=AliasChoices("new_status","status"))
    changed_at: datetime
    changed_by: Optional[int]

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        frozen=True,
    )