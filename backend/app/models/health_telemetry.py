# app/models/health_telemetry.py

from datetime import datetime, timezone

from sqlalchemy import (
    ForeignKey,
    Float,
    Boolean,
    String,
    Index,
    CheckConstraint,
    DateTime,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geography

from app.core.database import Base


class HealthTelemetry(Base):
    """
    Append-only high-frequency telemetry table.

    Designed for:
    - Alert detection
    - ML ingestion
    - Time-series analytics
    - Horizontal scaling
    """

    __tablename__ = "health_telemetry"

    # =========================================================
    # Primary Key
    # =========================================================

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    # =========================================================
    # Ownership
    # =========================================================

    tourist_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),  # protect historical data
        nullable=False,
        index=True,
    )

    device_id: Mapped[str | None] = mapped_column(
        ForeignKey("iot_devices.device_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Optional ORM navigation
    tourist = relationship("User", lazy="selectin")
    device = relationship("IoTDevice", lazy="selectin")

    # =========================================================
    # Health Metrics
    # =========================================================

    heart_rate: Mapped[float | None] = mapped_column(
        Float(precision=4),
        nullable=True,
    )

    spo2: Mapped[float | None] = mapped_column(
        Float(precision=3),
        nullable=True,
    )

    body_temperature: Mapped[float | None] = mapped_column(
        Float(precision=4),
        nullable=True,
    )

    fall_detected: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    # =========================================================
    # Alert Classification
    # =========================================================

    is_alert: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    alert_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )

    # =========================================================
    # Optional Location
    # =========================================================

    location: Mapped[str | None] = mapped_column(
    Geography(
        geometry_type="POINT",
        srid=4326,
        spatial_index=False
    ),
    nullable=True,
)

    # =========================================================
    # Timestamp (Immutable)
    # =========================================================

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
        index=True,
    )

    # =========================================================
    # Constraints & Indexing
    # =========================================================

    __table_args__ = (

        # At least one health metric must exist
        CheckConstraint(
            "(heart_rate IS NOT NULL OR spo2 IS NOT NULL OR body_temperature IS NOT NULL)",
            name="ck_health_at_least_one_metric",
        ),

        # Physiological realistic bounds
        CheckConstraint(
            "heart_rate IS NULL OR heart_rate BETWEEN 20 AND 250",
            name="ck_health_heart_rate_realistic_range",
        ),

        CheckConstraint(
            "spo2 IS NULL OR spo2 BETWEEN 50 AND 100",
            name="ck_health_spo2_realistic_range",
        ),

        CheckConstraint(
            "body_temperature IS NULL OR body_temperature BETWEEN 30 AND 45",
            name="ck_health_temp_realistic_range",
        ),

        # Prevent corrupted time ingestion (allow slight clock drift)
        CheckConstraint(
            "recorded_at <= (NOW() + INTERVAL '5 minutes')",
            name="ck_health_no_far_future_records",
        ),

        # Time-series lookup (primary query pattern)
        Index(
            "ix_health_tourist_time",
            "tourist_id",
            "recorded_at",
        ),

        # Alert-based query optimization
        Index(
            "ix_health_alert_lookup",
            "tourist_id",
            "is_alert",
            "recorded_at",
        ),

        # Critical alert scanning
        Index(
            "ix_health_critical_alerts",
            "recorded_at",
            postgresql_where=text("is_alert = TRUE"),
        ),

        # Spatial analytics
        Index(
            "ix_health_spatial",
            "location",
            postgresql_using="gist",
        ),
    )