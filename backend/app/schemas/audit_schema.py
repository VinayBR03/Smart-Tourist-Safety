# app/schemas/audit_schema.py

from datetime import datetime, timezone
from typing import Optional, Any

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_validator,
    model_validator,
)

from app.core.enums import AuditAction, EntityType


# =========================================================
# Shared Limits
# =========================================================

MAX_FILTER_WINDOW_DAYS = 90


# =========================================================
# Audit Log Response
# =========================================================

class AuditLogResponse(BaseModel):
    """
    Full audit log record.
    Used for admin dashboard & compliance review.
    """

    id: int
    user_id: Optional[int]

    action: AuditAction
    entity_type: EntityType
    entity_id: Optional[int]

    old_value: Optional[Any]
    new_value: Optional[Any]

    ip_address: Optional[str]
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )

    @field_validator("ip_address")
    @classmethod
    def normalize_ip(cls, value: Optional[str]):
        if value:
            value = value.strip()
            if len(value) > 45:
                raise ValueError("Invalid IP address length.")
        return value


# =========================================================
# Audit Filter Schema (Admin Use)
# =========================================================

class AuditLogFilter(BaseModel):
    """
    Used to filter audit logs in admin dashboard.
    """

    user_id: Optional[int] = Field(None, ge=1)
    action: Optional[AuditAction] = None
    entity_type: Optional[EntityType] = None
    entity_id: Optional[int] = Field(None, ge=1)

    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    model_config = ConfigDict(
        extra="forbid",
    )

    # Prevent inverted or abusive date ranges
    @model_validator(mode="after")
    def validate_date_range(self):
        if self.start_date and self.end_date:
            if self.start_date > self.end_date:
                raise ValueError("start_date cannot be after end_date.")

            window = (self.end_date - self.start_date).days
            if window > MAX_FILTER_WINDOW_DAYS:
                raise ValueError(
                    f"Date range cannot exceed {MAX_FILTER_WINDOW_DAYS} days."
                )

        # Prevent future filtering abuse
        now = datetime.now(timezone.utc)
        if self.start_date and self.start_date > now:
            raise ValueError("start_date cannot be in the future.")
        if self.end_date and self.end_date > now:
            raise ValueError("end_date cannot be in the future.")

        return self


# =========================================================
# Audit Summary Schema
# =========================================================

class AuditSummaryResponse(BaseModel):
    """
    Lightweight view for dashboards.
    """

    id: int
    action: AuditAction
    entity_type: EntityType
    entity_id: Optional[int]
    user_id: Optional[int]
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )