"""add api_key to iot_devices for secure device authentication

Revision ID: add_iot_device_api_key
Revises: add_iot_zone_tables
Create Date: 2026-01-27
"""

from alembic import op
import sqlalchemy as sa


# ---- Alembic identifiers ----
revision = "add_iot_device_api_key"
down_revision = "add_iot_zone_tables"
branch_labels = None
depends_on = None


def upgrade():
    # Add api_key column
    op.add_column(
        "iot_devices",
        sa.Column(
            "api_key",
            sa.String(length=128),
            nullable=False,
            unique=True
        )
    )

    # Create index for fast authentication lookup
    op.create_index(
        "ix_iot_devices_api_key",
        "iot_devices",
        ["api_key"]
    )


def downgrade():
    # Remove index and column
    op.drop_index("ix_iot_devices_api_key", table_name="iot_devices")
    op.drop_column("iot_devices", "api_key")
