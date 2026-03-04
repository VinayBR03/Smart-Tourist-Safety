# app/schemas/incident_assignment_schema.py

from datetime import datetime
from typing import Optional

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_validator,
)


# =========================================================
# Assign Incident to Authority
# =========================================================

class IncidentAssignRequest(BaseModel):
    """
    Assign an authority to an incident.
    Only ADMIN or supervisor role should call this.
    """

    authority_id: int = Field(..., ge=1)

    model_config = ConfigDict(
        extra="forbid",
    )


# =========================================================
# Reassign Incident
# =========================================================

class IncidentReassignRequest(BaseModel):
    """
    Reassign incident to another authority.
    Service layer must:
    - Close previous assignment
    - Create new row
    """

    new_authority_id: int = Field(..., ge=1)

    model_config = ConfigDict(
        extra="forbid",
    )

    @field_validator("new_authority_id")
    @classmethod
    def prevent_invalid_reassignment(cls, value: int):
        if value <= 0:
            raise ValueError("Invalid authority ID.")
        return value


# =========================================================
# Unassign Incident
# =========================================================

class IncidentUnassignRequest(BaseModel):
    """
    Unassign authority from incident.
    Used when authority unavailable or escalation required.
    """

    reason: Optional[str] = Field(
        None,
        max_length=300,
    )

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: Optional[str]):
        if value:
            value = value.strip()
            if len(value) < 3:
                raise ValueError("Unassignment reason too short.")
        return value


# =========================================================
# Full Assignment Record
# =========================================================

class IncidentAssignmentResponse(BaseModel):
    id: int

    incident_id: int
    authority_id: Optional[int]

    assigned_at: datetime
    unassigned_at: Optional[datetime]

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )


# =========================================================
# Active Assignment View
# =========================================================

class ActiveIncidentAssignmentResponse(BaseModel):
    """
    Used in incident detail page.
    Only current active assignment.
    """

    incident_id: int
    authority_id: Optional[int]
    assigned_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )


# =========================================================
# Authority Workload View
# =========================================================

class AuthorityWorkloadResponse(BaseModel):
    """
    Used for authority dashboard workload.
    """

    incident_id: int
    assigned_at: datetime
    status: str
    zone_id: Optional[int]

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )