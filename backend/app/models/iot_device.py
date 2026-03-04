# app/models/iot_device.py

from sqlalchemy import (
    String,
    Boolean,
    Float,
    DateTime,
    Index,
    CheckConstraint,
    Enum as SAEnum,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import (
    TimestampMixin,
    VersionMixin,
    SoftDeleteMixin,
)
from app.core.enums import DeviceType, DeviceStatus


class IoTDevice(Base, TimestampMixin, VersionMixin, SoftDeleteMixin):
    """
    Secure device registry model.

    Guarantees:
    - API keys are never stored in plaintext
    - Enum integrity
    - Lifecycle consistency
    - Battery sanity
    - Safe decommissioning
    """

    __tablename__ = "iot_devices"

    # =========================================================
    # Primary Key
    # =========================================================

    id: Mapped[int] = mapped_column(primary_key=True)

    # =========================================================
    # Device Identity
    # =========================================================

    device_id: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    # Store SHA-256 hash of API key (never plaintext)
    api_key_hash: Mapped[str] = mapped_column(
        String(64),  # SHA-256 hex = 64 chars
        unique=True,
        nullable=False,
        index=True,
    )

    device_type: Mapped[DeviceType] = mapped_column(
        SAEnum(DeviceType, name="device_type_enum"),
        nullable=False,
        index=True,
    )

    status: Mapped[DeviceStatus] = mapped_column(
        SAEnum(DeviceStatus, name="device_status_enum"),
        nullable=False,
        default=DeviceStatus.ACTIVE,
        index=True,
    )

    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    # =========================================================
    # Battery Monitoring
    # =========================================================

    battery_percentage: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    battery_voltage: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    battery_updated_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    low_battery_alerted_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # =========================================================
    # Firmware / Heartbeat
    # =========================================================

    firmware_version: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    last_seen: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # =========================================================
    # Lifecycle
    # =========================================================

    suspended_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    decommissioned_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # Optional ORM backref (used in DeviceAssignment)
    assignments = relationship(
        "DeviceAssignment",
        back_populates="device",
        lazy="selectin",
    )

    # =========================================================
    # Constraints & Indexes
    # =========================================================

    __table_args__ = (

        # Battery range
        CheckConstraint(
            "battery_percentage IS NULL OR battery_percentage BETWEEN 0 AND 100",
            name="ck_device_battery_range",
        ),

        # Prevent ACTIVE if decommissioned
        CheckConstraint(
            "(decommissioned_at IS NULL) OR (status != 'ACTIVE')",
            name="ck_device_no_active_if_decommissioned",
        ),

        # Suspended must match status
        CheckConstraint(
            """
            (status != 'SUSPENDED')
            OR (suspended_at IS NOT NULL)
            """,
            name="ck_device_suspended_requires_timestamp",
        ),

        # Decommissioned must match status
        CheckConstraint(
            """
            (status != 'DECOMMISSIONED')
            OR (decommissioned_at IS NOT NULL)
            """,
            name="ck_device_decommission_requires_timestamp",
        ),

        # Prevent future heartbeat
        CheckConstraint(
            "last_seen IS NULL OR last_seen <= NOW() + INTERVAL '5 minutes'",
            name="ck_device_no_future_heartbeat",
        ),

        # Active device lookup
        Index(
            "ix_device_active_lookup",
            "status",
            postgresql_where=text("is_deleted = FALSE"),
        ),

        # Heartbeat monitoring
        Index(
            "ix_device_last_seen_status",
            "last_seen",
            "status",
        ),

        # Type dashboards
        Index(
            "ix_device_type_status",
            "device_type",
            "status",
        ),

        # Low battery scan
        Index(
            "ix_device_low_battery_scan",
            "battery_percentage",
            postgresql_where=text(
                "battery_percentage IS NOT NULL AND battery_percentage < 20"
            ),
        ),
    )