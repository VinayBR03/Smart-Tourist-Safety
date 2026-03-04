# app/models/location.py

from sqlalchemy import (
    ForeignKey,
    Float,
    Index,
    CheckConstraint,
    text,
    DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geography

from app.core.database import Base
from app.models.base import VersionMixin


class Location(Base, VersionMixin):
    """
    Snapshot table.

    Holds latest known location per tourist.
    Exactly 1 row per tourist.
    Optimized for real-time queries.
    """

    __tablename__ = "locations"

    # =========================================================
    # Primary Key
    # =========================================================

    id: Mapped[int] = mapped_column(primary_key=True)

    # =========================================================
    # Ownership (1 snapshot per tourist)
    # =========================================================

    tourist_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # critical invariant
        index=True,
    )

    tourist = relationship("User", lazy="selectin")

    # =========================================================
    # Spatial Coordinates (PostGIS)
    # =========================================================

    coordinates: Mapped[str] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=False,
    )

    # =========================================================
    # Optional Metadata
    # =========================================================

    accuracy_meters: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    battery_percentage: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    # =========================================================
    # Timestamp (Server Controlled)
    # =========================================================

    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False,
        index=True,
    )

    # =========================================================
    # Constraints & Indexing
    # =========================================================

    __table_args__ = (

        # Battery range
        CheckConstraint(
            "battery_percentage IS NULL OR battery_percentage BETWEEN 0 AND 100",
            name="ck_location_battery_range",
        ),

        # Accuracy must be positive
        CheckConstraint(
            "accuracy_meters IS NULL OR accuracy_meters >= 0",
            name="ck_location_accuracy_positive",
        ),

        # Prevent future timestamps
        CheckConstraint(
            "updated_at <= NOW() + INTERVAL '5 minutes'",
            name="ck_location_no_future_update",
        ),

        # Validate GPS bounds (WGS84)
        CheckConstraint(
            """
            ST_Y(coordinates::geometry) BETWEEN -90 AND 90
            AND
            ST_X(coordinates::geometry) BETWEEN -180 AND 180
            """,
            name="ck_location_valid_coordinates",
        ),

        # Spatial index
        Index(
            "ix_locations_coordinates_gist",
            "coordinates",
            postgresql_using="gist",
        ),

        # Freshness lookup
        Index(
            "ix_location_freshness",
            "updated_at",
        ),
    )