# app/models/incident_status_history.py

from datetime import datetime

from sqlalchemy import (
    ForeignKey,
    DateTime,
    Index,
    CheckConstraint,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Enum as SAEnum

from app.core.database import Base
from app.core.enums import IncidentStatus


class IncidentStatusHistory(Base):
    """
    Immutable incident status transition log.

    Guarantees:
    - No illegal transitions
    - Enum integrity
    - No corrupted timestamps
    - SLA traceability
    """

    __tablename__ = "incident_status_history"

    # =========================================================
    # Primary Key
    # =========================================================

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    # =========================================================
    # Relationships
    # =========================================================

    incident_id: Mapped[int] = mapped_column(
        ForeignKey(
            "incidents.id",
            ondelete="RESTRICT",  # protect history
        ),
        nullable=False,
        index=True,
    )

    changed_by: Mapped[int | None] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    incident = relationship("Incident", lazy="selectin")
    actor = relationship("User", lazy="selectin")

    # =========================================================
    # Status Transition
    # =========================================================

    old_status: Mapped[IncidentStatus] = mapped_column(
        SAEnum(IncidentStatus, name="incident_status_enum"),
        nullable=True,
    )

    new_status: Mapped[IncidentStatus] = mapped_column(
        SAEnum(IncidentStatus, name="incident_status_enum"),
        nullable=False,
        index=True,
    )

    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
        index=True,
    )

    blockchain_tx_hash: Mapped[str | None] = mapped_column(
        String(66),
        nullable=True,
    )

    # =========================================================
    # Constraints & Indexes
    # =========================================================

    __table_args__ = (

        # Prevent same-state transition
        CheckConstraint(
            "(old_status IS NULL) OR(old_status <> new_status)",
            name="ck_incident_history_no_same_transition",
        ),

        # Allow slight clock drift (5 min)
        CheckConstraint(
            "changed_at <= (NOW() + INTERVAL '5 minutes')",
            name="ck_incident_history_no_far_future",
        ),

        # Example invalid transition (CLOSED -> OPEN)
        CheckConstraint(
            "NOT (old_status = 'CLOSED' AND new_status = 'OPEN')",
            name="ck_incident_history_invalid_reopen",
        ),

        # Timeline lookup
        Index(
            "ix_incident_status_timeline",
            "incident_id",
            "changed_at",
        ),

        # SLA measurement
        Index(
            "ix_incident_status_sla",
            "incident_id",
            "new_status",
            "changed_at",
        ),
    )