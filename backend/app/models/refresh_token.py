# app/models/refresh_token.py

from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    CheckConstraint,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import (
    TimestampMixin,
    VersionMixin,
)


class RefreshToken(Base, TimestampMixin, VersionMixin):
    """
    Refresh token persistence model.
    Used for secure session management and token rotation.
    """

    __tablename__ = "refresh_tokens"

    # =========================================================
    # Primary Key
    # =========================================================

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    # =========================================================
    # Ownership
    # =========================================================

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # =========================================================
    # Token Identification
    # =========================================================

    jti: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )

    token_hash: Mapped[str] = mapped_column(
        String(64),  # SHA-256 hex length
        nullable=False,
        unique=True,
        index=True,
    )

    # =========================================================
    # Session Metadata
    # =========================================================

    device_info: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
    )

    # =========================================================
    # Lifecycle
    # =========================================================

    is_revoked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    expires_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    revoked_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # =========================================================
    # Constraints & Indexes
    # =========================================================

    __table_args__ = (

        # Ensure JTI unique per user
        UniqueConstraint(
            "user_id",
            "jti",
            name="uq_refresh_user_jti",
        ),

        # Revocation consistency
        CheckConstraint(
            "(is_revoked = FALSE AND revoked_at IS NULL) OR "
            "(is_revoked = TRUE AND revoked_at IS NOT NULL)",
            name="refresh_revocation_consistency",
        ),

        # Fast active token lookup
        Index(
            "ix_refresh_token_user_active",
            "user_id",
            postgresql_where=text(
                "is_revoked = FALSE"
            ),
        ),

        # Expiry scanning optimization
        Index(
            "ix_refresh_token_expiry",
            "expires_at",
        ),
    )