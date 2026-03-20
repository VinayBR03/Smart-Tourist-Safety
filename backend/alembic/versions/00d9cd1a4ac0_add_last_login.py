"""add_last_login

Revision ID: 00d9cd1a4ac0
Revises: 49f4b1b2f0dd
Create Date: 2026-03-12 20:39:10.523924

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '00d9cd1a4ac0'
down_revision: Union[str, Sequence[str], None] = '49f4b1b2f0dd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "last_activity",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_users_last_activity",
        "users",
        ["last_activity"],
    )
    pass


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_users_last_activity", table_name="users")
    op.drop_column("users", "last_activity")
    pass
