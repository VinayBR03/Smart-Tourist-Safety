# app/models/zone.py

from sqlalchemy import (
    String,
    Boolean,
    Index,
    CheckConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geometry

from app.core.database import Base
from app.models.base import (
    TimestampMixin,
    VersionMixin,
    SoftDeleteMixin,
)


class Zone(Base, TimestampMixin, VersionMixin, SoftDeleteMixin):
    """
    Spatial zone definition model.

    Enterprise guarantees:
    - Valid PostGIS geometry
    - Enforced SRID (4326)
    - Polygon/MultiPolygon only
    - Case-insensitive unique active name
    - Soft-delete consistency
    - Dashboard-optimized queries
    """

    __tablename__ = "zones"

    # =========================================================
    # Primary Key
    # =========================================================

    id: Mapped[int] = mapped_column(primary_key=True)

    # =========================================================
    # Basic Info
    # =========================================================

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    zone_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # =========================================================
    # Spatial Geometry (Strict)
    # =========================================================

    geometry: Mapped[str] = mapped_column(
        Geometry(
            geometry_type="MULTIPOLYGON",
            srid=4326,
            spatial_index=False,  # we define custom index
        ),
        nullable=False,
    )

    # =========================================================
    # Constraints & Indexing
    # =========================================================

    __table_args__ = (

        # Case-insensitive unique name among non-deleted zones
        Index(
            "uq_zone_name_active",
            text("LOWER(name)"),
            unique=True,
            postgresql_where=text("is_deleted = FALSE"),
        ),

        # Geometry must be valid
        CheckConstraint(
            "ST_IsValid(geometry)",
            name="ck_zone_geometry_valid",
        ),

        # Enforce SRID
        CheckConstraint(
            "ST_SRID(geometry) = 4326",
            name="ck_zone_geometry_srid",
        ),

        # Enforce non-empty geometry
        CheckConstraint(
            "NOT ST_IsEmpty(geometry)",
            name="ck_zone_geometry_not_empty",
        ),

        # Soft-delete consistency
        CheckConstraint(
            "(is_deleted = FALSE AND deleted_at IS NULL) OR "
            "(is_deleted = TRUE AND deleted_at IS NOT NULL)",
            name="ck_zone_soft_delete_consistency",
        ),

        # Active zone lookup
        Index(
            "ix_zone_active_lookup",
            "is_active",
            postgresql_where=text("is_deleted = FALSE"),
        ),

        # Type-based dashboard lookup
        Index(
            "ix_zone_type_active",
            "zone_type",
            postgresql_where=text("is_deleted = FALSE"),
        ),

        # Spatial GIST index
        Index(
            "ix_zone_geometry_gist",
            "geometry",
            postgresql_using="gist",
        ),
    )