"""add iot devices, location events and zone status tables

Revision ID: add_iot_zone_tables
Revises: <PUT_PREVIOUS_REVISION_ID>
Create Date: 2026-01-27
"""

from alembic import op
import sqlalchemy as sa


# ---- Alembic identifiers ----
revision = "add_iot_zone_tables"
down_revision = "add_incident_status_created_at"
branch_labels = None
depends_on = None


def upgrade():
    # -----------------------------
    # iot_devices table
    # -----------------------------
    op.create_table(
        "iot_devices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("device_id", sa.String(length=50), nullable=False, unique=True),
        sa.Column("location_name", sa.String(length=100), nullable=True),
        sa.Column("device_type", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("last_seen", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_iot_devices_device_id", "iot_devices", ["device_id"])

    # -----------------------------
    # location_events table
    # -----------------------------
    op.create_table(
        "location_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tourist_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("device_id", sa.String(length=50), nullable=False),
        sa.Column("zone_id", sa.Integer(), nullable=True),
        sa.Column("rssi", sa.Float(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("sos_flag", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
    )

    op.create_index("ix_location_events_tourist_id", "location_events", ["tourist_id"])
    op.create_index("ix_location_events_device_id", "location_events", ["device_id"])
    op.create_index("ix_location_events_zone_id", "location_events", ["zone_id"])
    op.create_index("ix_location_events_timestamp", "location_events", ["timestamp"])

    # -----------------------------
    # zone_status table
    # -----------------------------
    op.create_table(
        "zone_status",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("zone_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("risk_level", sa.String(length=20), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_zone_status_zone_id", "zone_status", ["zone_id"])


def downgrade():
    # Drop tables in reverse dependency order
    op.drop_table("zone_status")
    op.drop_table("location_events")
    op.drop_table("iot_devices")
