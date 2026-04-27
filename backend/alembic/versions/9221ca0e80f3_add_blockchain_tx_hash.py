"""add_blockchain_tx_hash

Revision ID: 9221ca0e80f3
Revises: c047779bc3d7
Create Date: 2026-04-27 12:59:45.146979

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '9221ca0e80f3'
down_revision: Union[str, Sequence[str], None] = 'c047779bc3d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('audit_logs', sa.Column('blockchain_tx_hash', sa.String(length=66), nullable=True))
    op.add_column('incident_assignments', sa.Column('blockchain_tx_hash', sa.String(length=66), nullable=True))
    op.add_column('incident_status_history', sa.Column('blockchain_tx_hash', sa.String(length=66), nullable=True))
    op.add_column('media', sa.Column('blockchain_tx_hash', sa.String(length=66), nullable=True))
    op.add_column('zone_risk_history', sa.Column('blockchain_tx_hash', sa.String(length=66), nullable=True))
    op.add_column('zone_status', sa.Column('blockchain_tx_hash', sa.String(length=66), nullable=True))


def downgrade() -> None:
    op.drop_column('zone_status', 'blockchain_tx_hash')
    op.drop_column('zone_risk_history', 'blockchain_tx_hash')
    op.drop_column('media', 'blockchain_tx_hash')
    op.drop_column('incident_status_history', 'blockchain_tx_hash')
    op.drop_column('incident_assignments', 'blockchain_tx_hash')
    op.drop_column('audit_logs', 'blockchain_tx_hash')