# app/models/device_assignment.py

from datetime import datetime

from sqlalchemy import (
    ForeignKey,
    DateTime,
    Index,
    CheckConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Integer

from app.core.database import Base
from app.models.base import (
    TimestampMixin,
    VersionMixin,
)


class DeviceAssignment(Base, TimestampMixin, VersionMixin):
    __tablename__ = "device_assignments"

    # =========================================================
    # Primary Key
    # =========================================================

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    # =========================================================
    # Relationships (Foreign Keys)
    # =========================================================

    device_id: Mapped[str] = mapped_column(
        ForeignKey(
            "iot_devices.device_id",
            ondelete="RESTRICT",  # prevent historical data loss
        ),
        nullable=False,
        index=True,
    )

    tourist_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",  # protect assignment history
        ),
        nullable=False,
        index=True,
    )

    # Optional ORM navigation
    device = relationship(
        "IoTDevice",
        back_populates="assignments",
        lazy="selectin",
    )

    tourist = relationship(
        "User",
        back_populates="device_assignments",
        lazy="selectin",
    )

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
    # Integrity Constraints
    # =========================================================

    __table_args__ = (

        # Only one ACTIVE assignment per device
        Index(
            "uq_device_assignment_active_device",
            "device_id",
            unique=True,
            postgresql_where=text("unassigned_at IS NULL"),
        ),

        # Ensure time consistency
        CheckConstraint(
            "unassigned_at IS NULL OR unassigned_at >= assigned_at",
            name="ck_device_assignment_time_order",
        ),

        # Fast lookup for active device assignments
        Index(
            "ix_device_assignment_device_active",
            "device_id",
            "unassigned_at",
        ),

        # Tourist assignment history
        Index(
            "ix_device_assignment_tourist_history",
            "tourist_id",
            "assigned_at",
        ),
    )