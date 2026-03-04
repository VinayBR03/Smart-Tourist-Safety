# app/models/notification.py

from sqlalchemy import (
    ForeignKey,
    String,
    Index,
    CheckConstraint,
    Enum as SAEnum,
    Integer,
    DateTime,
    JSON,
    text,
)

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, VersionMixin
from app.core.enums import NotificationChannel, NotificationSeverity, NotificationStatus



class Notification(Base, TimestampMixin, VersionMixin):

    __tablename__ = "notifications"

    # =========================================================
    # Identity
    # =========================================================

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    user = relationship("User", lazy="selectin")

    # =========================================================
    # Event Definition
    # =========================================================

    event_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    correlation_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    idempotency_key: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
        unique=True,
        index=True,
    )

    # =========================================================
    # Channel & Severity
    # =========================================================

    channel: Mapped[NotificationChannel] = mapped_column(
        SAEnum(NotificationChannel, name="notification_channel_enum"),
        nullable=False,
        index=True,
    )

    severity: Mapped[NotificationSeverity] = mapped_column(
        SAEnum(NotificationSeverity, name="notification_severity_enum"),
        nullable=False,
        index=True,
    )

    # =========================================================
    # Frozen Payload (Full Rendered Content)
    # =========================================================

    payload: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )

    template_version: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    language: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        index=True,
    )

    # =========================================================
    # Delivery Lifecycle
    # =========================================================

    status: Mapped[NotificationStatus] = mapped_column(
        SAEnum(NotificationStatus, name="notification_status_enum"),
        default=NotificationStatus.PENDING,
        nullable=False,
        index=True,
    )

    retry_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    next_retry_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    sent_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    last_error: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    # =========================================================
    # Constraints & Indexes
    # =========================================================

    __table_args__ = (

        # Retry limits
        CheckConstraint(
            "retry_count >= 0 AND retry_count <= 20",
            name="ck_notification_retry_limit",
        ),

        # SENT requires sent_at
        CheckConstraint(
            "(status != 'SENT') OR (sent_at IS NOT NULL)",
            name="ck_notification_sent_requires_timestamp",
        ),

        # Prevent future timestamps
        CheckConstraint(
            "sent_at IS NULL OR sent_at <= NOW() + INTERVAL '5 minutes'",
            name="ck_notification_no_future_sent",
        ),

        # Dispatch worker scanning optimization
        Index(
            "ix_notification_dispatch_scan",
            "status",
            "next_retry_at",
            "created_at",
        ),

        # High severity scan
        Index(
            "ix_notification_high_severity",
            "severity",
            "created_at",
            postgresql_where=text("severity = 'CRITICAL'"),
        ),
    )