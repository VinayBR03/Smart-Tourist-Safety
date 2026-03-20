from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    Index,
    CheckConstraint,
    Enum as SAEnum,
    ForeignKey,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, VersionMixin, SoftDeleteMixin
from app.core.enums import UserRole, UserLanguage


class User(Base, TimestampMixin, VersionMixin, SoftDeleteMixin):

    __tablename__ = "users"

    # =========================================================
    # Primary Key
    # =========================================================

    id: Mapped[int] = mapped_column(primary_key=True)

    # =========================================================
    # Authentication & Identity
    # =========================================================

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role_enum"),
        nullable=False,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    # =========================================================
    # Language & Regionalization
    # =========================================================

    preferred_language: Mapped[UserLanguage] = mapped_column(
        SAEnum(UserLanguage, name="user_language_enum"),
        default=UserLanguage.EN,
        nullable=False,
        index=True,
    )

    # =========================================================
    # Security Lifecycle
    # =========================================================

    token_version: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )

    password_changed_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    last_login: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    last_activity: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # =========================================================
    # Relationships
    # =========================================================

    device_assignments = relationship(
        "DeviceAssignment",
        back_populates="tourist",
        lazy="selectin",
    )

    # =========================================================
    # Profile
    # =========================================================

    full_name: Mapped[str | None] = mapped_column(String(150))
    phone: Mapped[str | None] = mapped_column(String(20), index=True)
    emergency_contact: Mapped[str | None] = mapped_column(String(20))
    blood_group: Mapped[str | None] = mapped_column(String(10))
    medical_conditions: Mapped[str | None] = mapped_column(String(500))
    allergies: Mapped[str | None] = mapped_column(String(500))
    date_of_birth: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    gender: Mapped[str | None] = mapped_column(String(20))
    nationality: Mapped[str | None] = mapped_column(String(100))

    # =========================================================
    # Account Deletion Lifecycle
    # =========================================================

    is_pending_deletion: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    deletion_requested_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    deletion_reason: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    deletion_initiated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    deletion_completed_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    deletion_completed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    deletion_initiator = relationship(
        "User",
        foreign_keys=[deletion_initiated_by_user_id],
        remote_side=[id],
        lazy="selectin",
    )

    deletion_completer = relationship(
        "User",
        foreign_keys=[deletion_completed_by_user_id],
        remote_side=[id],
        lazy="selectin",
    )

    # =========================================================
    # Constraints & Indexes
    # =========================================================

    __table_args__ = (

        # Email normalization
        CheckConstraint(
            "email = lower(email)",
            name="ck_user_email_lowercase",
        ),

        # Basic email format
        CheckConstraint(
            "position('@' in email) > 1",
            name="ck_user_email_format",
        ),

        # Password hash length
        CheckConstraint(
            "length(password_hash) >= 20",
            name="ck_user_password_min_length",
        ),

        # Token version non-negative
        CheckConstraint(
            "token_version >= 0",
            name="ck_user_token_version_non_negative",
        ),

        # Soft delete consistency
        CheckConstraint(
            "(is_deleted = FALSE AND deleted_at IS NULL) "
            "OR "
            "(is_deleted = TRUE AND deleted_at IS NOT NULL)",
            name="ck_user_soft_delete_consistency",
        ),

        # Pending deletion consistency
        CheckConstraint(
            "(is_pending_deletion = FALSE AND deletion_requested_at IS NULL) "
            "OR "
            "(is_pending_deletion = TRUE AND deletion_requested_at IS NOT NULL)",
            name="ck_user_deletion_workflow_consistency",
        ),

        # Phone minimum length
        CheckConstraint(
            "phone IS NULL OR length(phone) >= 7",
            name="ck_user_phone_min_length",
        ),

        # Unique active email
        Index(
            "uq_user_email_active",
            "email",
            unique=True,
            postgresql_where=text("is_deleted = FALSE"),
        ),

        # Unique active phone
        Index(
            "uq_user_phone_active",
            "phone",
            unique=True,
            postgresql_where=text("phone IS NOT NULL AND is_deleted = FALSE"),
        ),

        # Active role lookup
        Index(
            "ix_user_active_role",
            "role",
            postgresql_where=text("is_deleted = FALSE"),
        ),

        # Cleanup worker optimization
        Index(
            "ix_user_pending_deletion_scan",
            "is_pending_deletion",
            "deletion_requested_at",
        ),
    )