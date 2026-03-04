# app/models/zone_risk_history.py

from sqlalchemy import (
    ForeignKey,
    Float,
    String,
    DateTime,
    Index,
    CheckConstraint,
    text,
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.enums import RiskLevel


class ZoneRiskHistory(Base):
    """
    Immutable ML risk snapshot history.

    Enterprise guarantees:
    - Append-only (no updates allowed at service layer)
    - Enum consistency
    - Risk score ↔ level correctness
    - Drift-tolerant timestamps
    - High-performance time-series querying
    """

    __tablename__ = "zone_risk_history"

    # =========================================================
    # Primary Key
    # =========================================================

    id: Mapped[int] = mapped_column(primary_key=True)

    # =========================================================
    # Zone Reference
    # =========================================================

    zone_id: Mapped[int] = mapped_column(
        ForeignKey("zones.id", ondelete="CASCADE"),
        nullable=False,
    )

    zone = relationship("Zone", lazy="selectin")

    # =========================================================
    # ML Output Snapshot
    # =========================================================

    risk_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    risk_level: Mapped[RiskLevel] = mapped_column(
        SAEnum(RiskLevel, name="risk_level_enum"),
        nullable=False,
    )

    model_version: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    # Who generated it
    source: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'ml'"),
    )

    # Optional correlation for ML job traceability
    correlation_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    recorded_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    # =========================================================
    # Constraints & Indexes
    # =========================================================

    __table_args__ = (

        # Score bounds
        CheckConstraint(
            "risk_score >= 0 AND risk_score <= 1",
            name="ck_zone_risk_score_range",
        ),

        # Risk level ↔ score integrity
        CheckConstraint(
            """
            (risk_level = 'LOW' AND risk_score < 0.4)
            OR
            (risk_level = 'MEDIUM' AND risk_score >= 0.4 AND risk_score < 0.7)
            OR
            (risk_level = 'HIGH' AND risk_score >= 0.7)
            """,
            name="ck_zone_risk_level_consistency",
        ),

        # Valid source
        CheckConstraint(
            "source IN ('ml', 'manual', 'system')",
            name="ck_zone_risk_source_check",
        ),

        # Allow slight clock drift
        CheckConstraint(
            "recorded_at <= NOW() + INTERVAL '5 minutes'",
            name="ck_zone_risk_no_future_records",
        ),

        # Zone timeline lookup
        Index(
            "ix_zone_risk_history_zone_time",
            "zone_id",
            "recorded_at",
        ),

        # Model analytics lookup
        Index(
            "ix_zone_risk_history_model_version",
            "model_version",
            "recorded_at",
        ),

        # High-risk optimized scan
        Index(
            "ix_zone_risk_history_high_risk",
            "zone_id",
            "recorded_at",
            postgresql_where=text("risk_level = 'HIGH'"),
        ),

        # Time-series BRIN index for massive scale
        Index(
            "ix_zone_risk_history_brin_time",
            "recorded_at",
            postgresql_using="brin",
        ),
    )