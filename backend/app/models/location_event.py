# app/models/location_event.py

from sqlalchemy import (
    ForeignKey,
    Boolean,
    Float,
    Index,
    CheckConstraint,
    Enum as SAEnum,
    text,
    DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geography

from app.core.database import Base
from app.core.enums import EventSource


class LocationEvent(Base):
    """
    Immutable location event table.

    Guarantees:
    - Append-only integrity
    - No future timestamps
    - Valid RSSI values
    - At least one identity source
    - Optimized for time-series and geo queries
    """

    __tablename__ = "location_events"

    # =========================================================
    # Primary Key
    # =========================================================

    id: Mapped[int] = mapped_column(primary_key=True)

    # =========================================================
    # Ownership
    # =========================================================

    tourist_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    device_id: Mapped[str | None] = mapped_column(
        ForeignKey("iot_devices.device_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    zone_id: Mapped[int | None] = mapped_column(
        ForeignKey("zones.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Optional relationships for efficient loading
    tourist = relationship("User", lazy="selectin")
    device = relationship("IoTDevice", lazy="selectin")
    zone = relationship("Zone", lazy="selectin")

    # =========================================================
    # Spatial Location
    # =========================================================

    location: Mapped[str | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=True,
    )

    # =========================================================
    # Signal & Context
    # =========================================================

    rssi: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    source: Mapped[EventSource] = mapped_column(
        SAEnum(EventSource, name="location_event_source_enum"),
        nullable=False,
        index=True,
    )

    sos_flag: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    timestamp: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
        index=True,
    )

    # =========================================================
    # Constraints & Indexing
    # =========================================================

    __table_args__ = (

        # Must originate from either tourist or device
        CheckConstraint(
            "(tourist_id IS NOT NULL OR device_id IS NOT NULL)",
            name="ck_location_event_identity_required",
        ),

        # RSSI realistic bounds
        CheckConstraint(
            "rssi IS NULL OR rssi BETWEEN -150 AND 0",
            name="ck_location_event_rssi_range",
        ),

        # Prevent future timestamps (allow slight drift)
        CheckConstraint(
            "timestamp <= NOW() + INTERVAL '5 minutes'",
            name="ck_location_event_no_future",
        ),

        # Zone timeline lookup
        Index(
            "ix_location_zone_time",
            "zone_id",
            "timestamp",
        ),

        # SOS optimized lookup
        Index(
            "ix_location_zone_sos_time",
            "zone_id",
            "sos_flag",
            "timestamp",
        ),

        # Tourist timeline lookup
        Index(
            "ix_location_tourist_time",
            "tourist_id",
            "timestamp",
        ),

        # Device timeline lookup
        Index(
            "ix_location_device_time",
            "device_id",
            "timestamp",
        ),

        # Spatial index
        Index(
            "ix_location_spatial",
            "location",
            postgresql_using="gist",
        ),

        # High-priority SOS scan
        Index(
            "ix_location_sos_priority",
            "timestamp",
            postgresql_where=text("sos_flag = TRUE"),
        ),
    )