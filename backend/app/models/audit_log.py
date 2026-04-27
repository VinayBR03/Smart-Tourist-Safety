# app/models/audit_log.py

from sqlalchemy import (
    ForeignKey,
    String,
    Index,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import DateTime
from sqlalchemy import Enum as SAEnum

from app.core.database import Base
from app.models.base import TimestampMixin
from app.core.enums import AuditAction, EntityType


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    # =========================================================
    # Primary Key
    # =========================================================

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    # =========================================================
    # Actor
    # =========================================================

    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # =========================================================
    # Action Metadata (Strongly Typed)
    # =========================================================

    action: Mapped[AuditAction] = mapped_column(
        SAEnum(AuditAction, name="audit_action_enum"),
        nullable=False,
        index=True,
    )

    entity_type: Mapped[EntityType] = mapped_column(
        SAEnum(EntityType, name="audit_entity_enum"),
        nullable=False,
        index=True,
    )

    entity_id: Mapped[int | None] = mapped_column(
        nullable=True,
        index=True,
    )

    # =========================================================
    # Change Snapshot
    # =========================================================

    old_value: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    new_value: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # =========================================================
    # Context
    # =========================================================

    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
    )

    user_agent: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    correlation_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    blockchain_tx_hash: Mapped[str | None] = mapped_column(
        String(66),
        nullable=True,
    )

    # =========================================================
    # Indexes
    # =========================================================

    __table_args__ = (

        # Fast lookup by entity
        Index(
            "ix_audit_entity_lookup",
            "entity_type",
            "entity_id",
            "created_at",
        ),

        # Action timeline scanning
        Index(
            "ix_audit_action_time",
            "action",
            "created_at",
        ),

        # Correlation-based tracing
        Index(
            "ix_audit_correlation_time",
            "correlation_id",
            "created_at",
        ),
    )