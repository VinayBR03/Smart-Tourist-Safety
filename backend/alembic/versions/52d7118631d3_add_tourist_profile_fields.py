from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "add_tourist_profile_fields"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("full_name", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(length=20), nullable=True))
    op.add_column(
        "users",
        sa.Column("emergency_contact", sa.String(length=20), nullable=True),
    )


def downgrade():
    op.drop_column("users", "emergency_contact")
    op.drop_column("users", "phone")
    op.drop_column("users", "full_name")
