from alembic import op
import sqlalchemy as sa

revision = "add_incident_status_created_at"
down_revision = "add_tourist_profile_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "incidents",
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="open",
        ),
    )
    op.add_column(
        "incidents",
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade():
    op.drop_column("incidents", "created_at")
    op.drop_column("incidents", "status")
