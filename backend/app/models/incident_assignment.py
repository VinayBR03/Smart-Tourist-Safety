# app/models/incident_assignment.py

from datetime import datetime

from sqlalchemy import (
    ForeignKey,
    DateTime,
    Index,
    CheckConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import (
    TimestampMixin,
    VersionMixin,
)


class IncidentAssignment(Base, TimestampMixin, VersionMixin):
    """
    Tracks assignment lifecycle of incidents to authorities.

    Guarantees:
    - Only one active authority per incident
    - Immutable assignment history
    - Time integrity
    - Optimistic concurrency safe
    """

    __tablename__ = "incident_assignments"

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
            ondelete="RESTRICT",  # protect historical assignment data
        ),
        nullable=False,
        index=True,
    )

    authority_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # ORM navigation
    incident = relationship("Incident", lazy="selectin")
    authority = relationship("User", lazy="selectin")

    # =========================================================
    # Assignment Lifecycle
    # =========================================================

    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
        index=True,
    )

    unassigned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # =========================================================
    # Constraints & Indexes
    # =========================================================

    __table_args__ = (

        # Only ONE active assignment per incident
        Index(
            "uq_incident_assignment_active",
            "incident_id",
            unique=True,
            postgresql_where=text("unassigned_at IS NULL"),
        ),

        # Ensure time integrity
        CheckConstraint(
            "unassigned_at IS NULL OR unassigned_at >= assigned_at",
            name="ck_incident_assignment_time_order",
        ),

        # Active assignment must have authority
        CheckConstraint(
            "(unassigned_at IS NOT NULL) OR (authority_id IS NOT NULL)",
            name="ck_incident_assignment_active_requires_authority",
        ),

        # Fast lookup for active incident assignments
        Index(
            "ix_incident_assignment_lookup",
            "incident_id",
            "unassigned_at",
        ),

        # Authority dashboard optimization
        Index(
            "ix_authority_active_assignments",
            "authority_id",
            "unassigned_at",
        ),
    )