"""add preferred_language to user

Revision ID: 22e522051210
Revises: 9c8f8cb4f488
Create Date: 2026-02-26 20:34:51.945510
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = "22e522051210"
down_revision: Union[str, Sequence[str], None] = "9c8f8cb4f488"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # -------------------------------
    # Existing auto-generated changes
    # -------------------------------

    op.alter_column(
        "health_telemetry",
        "heart_rate",
        existing_type=sa.REAL(),
        type_=sa.Float(precision=4),
        existing_nullable=True,
    )

    op.alter_column(
        "health_telemetry",
        "spo2",
        existing_type=sa.REAL(),
        type_=sa.Float(precision=3),
        existing_nullable=True,
    )

    op.alter_column(
        "health_telemetry",
        "body_temperature",
        existing_type=sa.REAL(),
        type_=sa.Float(precision=4),
        existing_nullable=True,
    )

    # -------------------------------
    # 1️⃣ Create ENUM type first
    # -------------------------------

    user_language_enum = sa.Enum(
        "en",
        "hi",
        "kn",
        "ta",
        "te",
        "ml",
        name="user_language_enum",
    )

    user_language_enum.create(op.get_bind(), checkfirst=True)

    # -------------------------------
    # 2️⃣ Add column with temporary default
    # -------------------------------

    op.add_column(
        "users",
        sa.Column(
            "preferred_language",
            user_language_enum,
            nullable=False,
            server_default="en",
        ),
    )

    # -------------------------------
    # 3️⃣ Remove server default (clean schema)
    # -------------------------------

    op.alter_column(
        "users",
        "preferred_language",
        server_default=None,
    )

    # -------------------------------
    # 4️⃣ Create index
    # -------------------------------

    op.create_index(
        op.f("ix_users_preferred_language"),
        "users",
        ["preferred_language"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""

    # -------------------------------
    # Drop index
    # -------------------------------

    op.drop_index(op.f("ix_users_preferred_language"), table_name="users")

    # -------------------------------
    # Drop column first
    # -------------------------------

    op.drop_column("users", "preferred_language")

    # -------------------------------
    # Drop ENUM type
    # -------------------------------

    user_language_enum = sa.Enum(
        "en",
        "hi",
        "kn",
        "ta",
        "te",
        "ml",
        name="user_language_enum",
    )

    user_language_enum.drop(op.get_bind(), checkfirst=True)

    # -------------------------------
    # Revert previous telemetry changes
    # -------------------------------

    op.alter_column(
        "health_telemetry",
        "body_temperature",
        existing_type=sa.Float(precision=4),
        type_=sa.REAL(),
        existing_nullable=True,
    )

    op.alter_column(
        "health_telemetry",
        "spo2",
        existing_type=sa.Float(precision=3),
        type_=sa.REAL(),
        existing_nullable=True,
    )

    op.alter_column(
        "health_telemetry",
        "heart_rate",
        existing_type=sa.Float(precision=4),
        type_=sa.REAL(),
        existing_nullable=True,
    )