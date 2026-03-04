"""update user and notification

Revision ID: e200614098db
Revises: 22e522051210
Create Date: 2026-02-27 00:46:53.053375
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision: str = "e200614098db"
down_revision: Union[str, Sequence[str], None] = "22e522051210"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # =========================================================
    # 1️⃣ Create ENUM type first (Postgres requirement)
    # =========================================================

    notification_status_enum = postgresql.ENUM(
        "PENDING",
        "SENT",
        "FAILED",
        "CANCELLED",
        name="notification_status_enum",
    )

    notification_status_enum.create(op.get_bind(), checkfirst=True)

    # =========================================================
    # 2️⃣ Update notifications table
    # =========================================================

    op.add_column(
        "notifications",
        sa.Column("event_type", sa.String(100), nullable=False),
    )

    op.add_column(
        "notifications",
        sa.Column("payload", sa.JSON(), nullable=False),
    )

    op.add_column(
        "notifications",
        sa.Column("template_version", sa.String(20), nullable=False),
    )

    op.add_column(
        "notifications",
        sa.Column("language", sa.String(10), nullable=False),
    )

    op.add_column(
        "notifications",
        sa.Column("status", notification_status_enum, nullable=False),
    )

    op.add_column(
        "notifications",
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Alter existing column sizes
    op.alter_column(
        "notifications",
        "idempotency_key",
        existing_type=sa.VARCHAR(length=100),
        type_=sa.String(length=150),
        existing_nullable=True,
    )

    op.alter_column(
        "notifications",
        "last_error",
        existing_type=sa.VARCHAR(length=500),
        type_=sa.String(length=1000),
        existing_nullable=True,
    )

    # Drop old columns (legacy notification structure)
    op.drop_column("notifications", "title")
    op.drop_column("notifications", "message")
    op.drop_column("notifications", "is_read")
    op.drop_column("notifications", "is_sent")
    op.drop_column("notifications", "related_entity_id")
    op.drop_column("notifications", "related_entity_type")

    # =========================================================
    # 3️⃣ Update users table (deletion lifecycle hardening)
    # =========================================================

    op.add_column(
        "users",
        sa.Column("deletion_reason", sa.String(500), nullable=True),
    )

    op.add_column(
        "users",
        sa.Column("deletion_initiated_by_user_id", sa.Integer(), nullable=True),
    )

    op.add_column(
        "users",
        sa.Column("deletion_completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.add_column(
        "users",
        sa.Column("deletion_completed_by_user_id", sa.Integer(), nullable=True),
    )

    # Add foreign keys with explicit names
    op.create_foreign_key(
        "fk_users_deletion_initiated_by",
        "users",
        "users",
        ["deletion_initiated_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_foreign_key(
        "fk_users_deletion_completed_by",
        "users",
        "users",
        ["deletion_completed_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Optimized scan index for deletion worker
    op.create_index(
        "ix_user_pending_deletion_scan",
        "users",
        ["is_pending_deletion", "deletion_requested_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""

    notification_status_enum = postgresql.ENUM(
        "PENDING",
        "SENT",
        "FAILED",
        "CANCELLED",
        name="notification_status_enum",
    )

    # =========================================================
    # 1️⃣ Users rollback
    # =========================================================

    op.drop_constraint("fk_users_deletion_completed_by", "users", type_="foreignkey")
    op.drop_constraint("fk_users_deletion_initiated_by", "users", type_="foreignkey")

    op.drop_index("ix_user_pending_deletion_scan", table_name="users")

    op.drop_column("users", "deletion_completed_by_user_id")
    op.drop_column("users", "deletion_completed_at")
    op.drop_column("users", "deletion_initiated_by_user_id")
    op.drop_column("users", "deletion_reason")

    # =========================================================
    # 2️⃣ Notifications rollback
    # =========================================================

    op.drop_column("notifications", "next_retry_at")
    op.drop_column("notifications", "status")
    op.drop_column("notifications", "language")
    op.drop_column("notifications", "template_version")
    op.drop_column("notifications", "payload")
    op.drop_column("notifications", "event_type")

    notification_status_enum.drop(op.get_bind(), checkfirst=True)