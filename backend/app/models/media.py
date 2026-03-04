# app/models/media.py

from sqlalchemy import (
    ForeignKey,
    String,
    Boolean,
    Index,
    CheckConstraint,
    Enum as SAEnum,
    Integer,
    text,
    DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import (
    TimestampMixin,
    VersionMixin,
    SoftDeleteMixin,
)
from app.core.enums import MediaType


class Media(Base, TimestampMixin, VersionMixin, SoftDeleteMixin):
    """
    Media storage reference table.

    Guarantees:
    - Exactly one owner (user OR incident)
    - Valid file metadata
    - No oversized uploads
    - One active profile photo per user
    - Immutable S3 reference
    """

    __tablename__ = "media"

    # =========================================================
    # Primary Key
    # =========================================================

    id: Mapped[int] = mapped_column(primary_key=True)

    # =========================================================
    # Ownership
    # =========================================================

    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    incident_id: Mapped[int | None] = mapped_column(
        ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    uploaded_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
    incident = relationship("Incident", lazy="selectin")
    uploader = relationship("User", foreign_keys=[uploaded_by], lazy="selectin")

    # =========================================================
    # Media Metadata
    # =========================================================

    media_type: Mapped[MediaType] = mapped_column(
        SAEnum(MediaType, name="media_type_enum"),
        nullable=False,
        index=True,
    )

    s3_key: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        unique=True,
        index=True,
    )

    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    uploaded_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
        index=True,
    )

    # =========================================================
    # Constraints & Indexes
    # =========================================================

    __table_args__ = (

        # Must belong to exactly ONE owner
        CheckConstraint(
            """
            (user_id IS NOT NULL AND incident_id IS NULL)
            OR
            (user_id IS NULL AND incident_id IS NOT NULL)
            """,
            name="ck_media_exactly_one_owner",
        ),

        # File size must be positive
        CheckConstraint(
            "file_size_bytes > 0",
            name="ck_media_file_size_positive",
        ),

        # Optional: limit max file size (example: 50MB)
        CheckConstraint(
            "file_size_bytes <= 52428800",
            name="ck_media_max_file_size",
        ),

        # Restrict allowed content types
        CheckConstraint(
            "content_type IN ('image/jpeg', 'image/png', 'video/mp4')",
            name="ck_media_content_type_check",
        ),

        # Prevent future uploads
        CheckConstraint(
            "uploaded_at <= NOW() + INTERVAL '5 minutes'",
            name="ck_media_no_future_upload",
        ),

        # Only ONE active profile photo per user
        Index(
            "uq_active_profile_photo",
            "user_id",
            unique=True,
            postgresql_where=text(
                "media_type = 'PROFILE_PHOTO' AND is_deleted = FALSE"
            ),
        ),

        # Incident media lookup
        Index(
            "ix_media_incident_active",
            "incident_id",
            "is_deleted",
        ),

        # User media lookup
        Index(
            "ix_media_user_type_active",
            "user_id",
            "media_type",
            "is_deleted",
        ),
    )