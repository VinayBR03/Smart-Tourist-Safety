from datetime import datetime
from sqlalchemy import (
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LocationEvent(Base):
    __tablename__ = "location_events"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    # Tourist being tracked (nullable because some RFID/BLE pings
    # may be anonymous initially)
    tourist_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # ESP32 / Gateway device ID
    device_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )

    # Optional zone / geofence ID
    zone_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True
    )

    # BLE signal strength
    rssi: Mapped[float | None] = mapped_column(
        Float,
        nullable=True
    )

    # GNSS coordinates (nullable for BLE / RFID-only events)
    latitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True
    )

    longitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True
    )

    # Data source type
    source: Mapped[str] = mapped_column(
        String(20),  # BLE / RFID / GNSS
        nullable=False,
        index=True
    )

    # SOS triggered by device or wristband
    sos_flag: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    # Event timestamp (important for ML)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )
