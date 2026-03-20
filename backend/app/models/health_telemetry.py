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
    BigInteger,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geography

from app.core.database import Base


class HealthTelemetry(Base):
    """
    Append-only high-frequency telemetry table backed by TimescaleDB.

    TimescaleDB requirements
    ────────────────────────
    - The hypertable partition column (recorded_at) MUST be part of the
      primary key. We use a composite PK (id, recorded_at).
    - id uses BigInteger (BIGSERIAL) — at 100k tourists × 1 row/30s that's
      ~10M rows/day; int4 would overflow in ~200 days of operation.
    - Compression is configured via SQL after hypertable creation (see
      database.py → setup_timescaledb() and migration script).

    Query patterns (all served by TimescaleDB chunk pruning + indexes):
    - Latest record per tourist           → ix_health_tourist_time DESC
    - Alerts in time range                → ix_health_critical_alerts
    - Tourist alert history               → ix_health_alert_lookup
    - Spatial queries                     → ix_health_spatial (GIST)
    """

    __tablename__ = "health_telemetry"

    # =========================================================
    # Primary Key — composite to satisfy TimescaleDB hypertable
    # constraint (partition column must be in PK)
    # =========================================================

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        primary_key=True,                          # ← part of composite PK
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    # =========================================================
    # Ownership
    # =========================================================

    tourist_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    device_id: Mapped[str | None] = mapped_column(
        ForeignKey("iot_devices.device_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    tourist = relationship("User",      lazy="selectin")
    device  = relationship("IoTDevice", lazy="selectin")

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
            spatial_index=False,
        ),
        nullable=True,
    )

    # =========================================================
    # Constraints & Indexes
    # =========================================================

    __table_args__ = (

        # ── Check constraints ──────────────────────────────

        CheckConstraint(
            "(heart_rate IS NOT NULL OR spo2 IS NOT NULL OR body_temperature IS NOT NULL)",
            name="ck_health_at_least_one_metric",
        ),
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
        CheckConstraint(
            "recorded_at <= (NOW() + INTERVAL '5 minutes')",
            name="ck_health_no_far_future_records",
        ),

        # ── Indexes ───────────────────────────────────────
        # TimescaleDB automatically creates a per-chunk index on the
        # partition column (recorded_at). All indexes below are on
        # top of that and benefit from chunk pruning automatically.

        # Primary query pattern: tourist history sorted by time
        Index(
            "ix_health_tourist_time",
            "tourist_id",
            "recorded_at",
        ),

        # Alert dashboard: tourist + alert flag + time
        Index(
            "ix_health_alert_lookup",
            "tourist_id",
            "is_alert",
            "recorded_at",
        ),

        # Fast recent-alert scan across all tourists
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