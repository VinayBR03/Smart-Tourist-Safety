# app/models/zone_status.py

from sqlalchemy import (
    ForeignKey,
    Float,
    String,
    Index,
    CheckConstraint,
    UniqueConstraint,
    Enum as SAEnum,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, VersionMixin
from app.core.enums import RiskLevel


class ZoneStatus(Base, TimestampMixin, VersionMixin):
    """
    Current risk snapshot per zone.

    Guarantees:
    - Strict 1:1 with Zone
    - Enum consistency
    - Risk score ↔ level correctness
    - Dashboard optimized queries
    """

    __tablename__ = "zone_status"

    # =========================================================
    # Primary Key
    # =========================================================

    id: Mapped[int] = mapped_column(primary_key=True)

    # =========================================================
    # Zone Reference (Strict 1:1)
    # =========================================================

    zone_id: Mapped[int] = mapped_column(
        ForeignKey("zones.id", ondelete="CASCADE"),
        nullable=False,
    )

    zone = relationship("Zone", lazy="selectin")

    # =========================================================
    # Current Risk Snapshot
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

    source: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'ml'"),
    )

    blockchain_tx_hash: Mapped[str | None] = mapped_column(
        String(66),
        nullable=True,
    )

    # =========================================================
    # Constraints & Indexes
    # =========================================================

    __table_args__ = (

        # Strict 1:1 enforcement
        UniqueConstraint(
            "zone_id",
            name="uq_zone_status_zone_id",
        ),

        # Score bounds
        CheckConstraint(
            "risk_score >= 0 AND risk_score <= 1",
            name="ck_zone_status_score_range",
        ),

        # Risk level ↔ score alignment
        CheckConstraint(
            """
            (risk_level = 'LOW' AND risk_score < 0.4)
            OR
            (risk_level = 'MEDIUM' AND risk_score >= 0.4 AND risk_score < 0.7)
            OR
            (risk_level = 'HIGH' AND risk_score >= 0.7)
            """,
            name="ck_zone_status_level_consistency",
        ),

        # Valid source
        CheckConstraint(
            "source IN ('ml', 'manual', 'system')",
            name="ck_zone_status_source_check",
        ),

        # High-risk dashboard lookup
        Index(
            "ix_zone_status_high_risk",
            "zone_id",
            postgresql_where=text("risk_level = 'HIGH'"),
        ),

        # Risk-level filter index
        Index(
            "ix_zone_status_risk_level",
            "risk_level",
        ),

        # Model version filtering
        Index(
            "ix_zone_status_model_version",
            "model_version",
        ),
    )