from datetime import datetime

from sqlalchemy import (
    String,
    Boolean,
    Integer,
    Index,
    CheckConstraint,
    DateTime,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import (
    TimestampMixin,
    VersionMixin,
)


class EventOutbox(Base, TimestampMixin, VersionMixin):

    __tablename__ = "event_outbox"

    # =========================================================
    # Primary Key
    # =========================================================

    id: Mapped[int] = mapped_column(primary_key=True)

    # =========================================================
    # Event Metadata
    # =========================================================

    topic: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
    )

    payload: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )

    # Optional metadata for routing and tracing

    event_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    partition_key: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    correlation_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    # Business idempotency key
    idempotency_key: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    # =========================================================
    # Processing State
    # =========================================================

    is_published: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    processing: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    locked_by: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    locked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    retry_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    next_retry_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    last_error: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    # =========================================================
    # Constraints
    # =========================================================

    __table_args__ = (

        CheckConstraint(
            "retry_count >= 0",
            name="ck_outbox_retry_non_negative",
        ),

        CheckConstraint(
            "(is_published = FALSE) OR (published_at IS NOT NULL)",
            name="ck_outbox_published_timestamp_required",
        ),

        CheckConstraint(
            "(processing = FALSE) OR (locked_at IS NOT NULL)",
            name="ck_outbox_processing_requires_lock",
        ),

        Index(
            "uq_outbox_idempotency_key",
            "idempotency_key",
            unique=True,
            postgresql_where=text("idempotency_key IS NOT NULL"),
        ),

        Index(
            "ix_outbox_worker_scan",
            "is_published",
            "processing",
            "next_retry_at",
            "created_at",
            postgresql_where=text(
                "is_published = FALSE AND processing = FALSE"
            ),
        ),

        Index(
            "ix_outbox_retry_priority",
            "retry_count",
            "created_at",
        ),
    )