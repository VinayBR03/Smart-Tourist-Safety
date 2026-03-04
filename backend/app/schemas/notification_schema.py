from datetime import datetime, timezone
from typing import Optional, Dict, Any

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_validator,
    model_validator,
)

from app.core.enums import (
    NotificationChannel,
    NotificationSeverity,
    NotificationStatus,
    UserLanguage,
)


# =========================================================
# Internal Create Request (Service Layer Only)
# =========================================================

class NotificationCreateRequest(BaseModel):
    """
    Internal service-layer schema.
    Event-driven notification creation.
    Not exposed publicly.
    """

    user_id: int = Field(..., ge=1)

    event_type: str = Field(..., min_length=3, max_length=100)

    channel: NotificationChannel
    severity: NotificationSeverity

    context: Optional[Dict[str, Any]] = None

    related_entity_type: Optional[str] = Field(None, max_length=50)
    related_entity_id: Optional[int] = Field(None, ge=1)

    correlation_id: Optional[str] = Field(None, max_length=100)
    idempotency_key: Optional[str] = Field(None, max_length=150)

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    # -----------------------------------------------------
    # Normalize event type
    # -----------------------------------------------------

    @field_validator("event_type")
    @classmethod
    def normalize_event(cls, value: str) -> str:
        value = value.strip().upper()
        if len(value) < 3:
            raise ValueError("Invalid event_type.")
        return value

    # -----------------------------------------------------
    # Normalize correlation_id
    # -----------------------------------------------------

    @field_validator("correlation_id")
    @classmethod
    def normalize_correlation(cls, value: Optional[str]):
        if value:
            value = value.strip()
            if " " in value:
                raise ValueError("Invalid correlation_id.")
        return value

    # -----------------------------------------------------
    # Normalize idempotency key
    # -----------------------------------------------------

    @field_validator("idempotency_key")
    @classmethod
    def normalize_idempotency(cls, value: Optional[str]):
        if value:
            value = value.strip()
            if " " in value:
                raise ValueError("Invalid idempotency_key.")
        return value

    # -----------------------------------------------------
    # Ensure entity integrity
    # -----------------------------------------------------

    @model_validator(mode="after")
    def validate_entity_integrity(self):

        has_type = self.related_entity_type is not None
        has_id = self.related_entity_id is not None

        if has_type != has_id:
            raise ValueError(
                "Both related_entity_type and related_entity_id must be provided together."
            )

        if self.related_entity_type:
            self.related_entity_type = self.related_entity_type.strip().upper()

        return self


# =========================================================
# Notification Response (Full Detail)
# =========================================================

class NotificationResponse(BaseModel):

    id: int
    user_id: Optional[int]

    event_type: str

    channel: NotificationChannel
    severity: NotificationSeverity
    status: NotificationStatus

    payload: Dict[str, Any]

    template_version: str
    language: UserLanguage

    retry_count: int
    next_retry_at: Optional[datetime]
    sent_at: Optional[datetime]
    last_error: Optional[str]

    version: int

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )

    # -----------------------------------------------------
    # Defense in depth validations
    # -----------------------------------------------------

    @field_validator("retry_count")
    @classmethod
    def validate_retry_count(cls, value: int):
        if value < 0 or value > 20:
            raise ValueError("Invalid retry_count.")
        return value

    @model_validator(mode="after")
    def validate_status_consistency(self):

        if self.status == NotificationStatus.SENT and self.sent_at is None:
            raise ValueError("SENT notifications must have sent_at timestamp.")

        if self.sent_at is not None:
            now = datetime.now(timezone.utc)
            if self.sent_at > now:
                raise ValueError("sent_at cannot be in the future.")

        return self


# =========================================================
# Mark as Read (In-App Only)
# =========================================================

class NotificationMarkReadRequest(BaseModel):

    model_config = ConfigDict(extra="forbid")


# =========================================================
# Unread Count Response
# =========================================================

class NotificationUnreadCountResponse(BaseModel):

    unread_count: int

    model_config = ConfigDict(
        frozen=True,
    )


# =========================================================
# Summary View
# =========================================================

class NotificationSummaryResponse(BaseModel):

    id: int
    event_type: str
    severity: NotificationSeverity
    status: NotificationStatus
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )