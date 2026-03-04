# app/models/incident.py

from datetime import datetime

from sqlalchemy import (
    ForeignKey,
    String,
    Boolean,
    Index,
    CheckConstraint,
    text,
    Enum as SAEnum,
    DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geography

from app.core.database import Base
from app.models.base import (
    TimestampMixin,
    VersionMixin,
    SoftDeleteMixin,
)
from app.core.enums import IncidentStatus, IncidentSource


class Incident(Base, TimestampMixin, VersionMixin, SoftDeleteMixin):
    """
    Core Incident aggregate root.

    Guarantees:
    - Status integrity
    - Resolution timestamp correctness
    - Spatial index for geo queries
    - Soft delete protection
    """

    __tablename__ = "incidents"

    # =========================================================
    # Primary Key
    # =========================================================

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    # =========================================================
    # Ownership
    # =========================================================

    tourist_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    zone_id: Mapped[int | None] = mapped_column(
        ForeignKey("zones.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    tourist = relationship("User", lazy="selectin")
    zone = relationship("Zone", lazy="selectin")

    # =========================================================
    # Spatial Location (PostGIS)
    # =========================================================

    location: Mapped[str | None] = mapped_column(
        Geography(
            geometry_type="POINT",
              srid=4326,
              spatial_index=False,
              ),
        nullable=True,
    )

    # =========================================================
    # Core Incident Data
    # =========================================================

    description: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    status: Mapped[IncidentStatus] = mapped_column(
        SAEnum(IncidentStatus, name="incident_status_enum"),
        nullable=False,
        index=True,
    )

    source: Mapped[IncidentSource] = mapped_column(
        SAEnum(IncidentSource, name="incident_source_enum"),
        nullable=False,
        index=True,
    )

    is_auto_generated: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # =========================================================
    # Constraints & Indexes
    # =========================================================

    __table_args__ = (

        # Resolution timestamp must exist if resolved/closed
        CheckConstraint(
            """
            (status NOT IN ('RESOLVED', 'CLOSED'))
            OR (resolved_at IS NOT NULL)
            """,
            name="ck_incident_resolution_required",
        ),

        # Resolution timestamp must be NULL if not resolved
        CheckConstraint(
            """
            (status IN ('RESOLVED', 'CLOSED'))
            OR (resolved_at IS NULL)
            """,
            name="ck_incident_resolution_only_when_resolved",
        ),

        # Prevent future resolution timestamps
        CheckConstraint(
            "resolved_at IS NULL OR resolved_at <= NOW() + INTERVAL '5 minutes'",
            name="ck_incident_no_future_resolution",
        ),

        # Active incidents by zone
        Index(
            "ix_incident_zone_active",
            "zone_id",
            "status",
            postgresql_where=text("is_deleted = FALSE"),
        ),

        # Active incidents by tourist
        Index(
            "ix_incident_tourist_active",
            "tourist_id",
            "status",
            postgresql_where=text("is_deleted = FALSE"),
        ),

        # Spatial index
        Index(
            "ix_incident_spatial",
            "location",
            postgresql_using="gist",
        ),

        # Status + time scan (analytics)
        Index(
            "ix_incident_status_created",
            "status",
            "created_at",
        ),
    )