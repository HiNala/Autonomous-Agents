"""initial_schema

Revision ID: 1ea1844bd656
Revises: 
Create Date: 2026-02-27 20:30:36.751045

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = '1ea1844bd656'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'analyses',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('analysis_id', sa.String(64), unique=True, nullable=False, index=True),
        sa.Column('repo_url', sa.Text(), nullable=False),
        sa.Column('repo_name', sa.String(255), nullable=False),
        sa.Column('branch', sa.String(255), server_default='main'),
        sa.Column('clone_dir', sa.Text(), nullable=True),
        sa.Column('status', sa.String(32), server_default='queued'),
        sa.Column('detected_stack', sa.JSON(), nullable=True),
        sa.Column('stats', sa.JSON(), nullable=True),
        sa.Column('agent_statuses', sa.JSON(), nullable=True),
        sa.Column('health_score', sa.JSON(), nullable=True),
        sa.Column('findings_summary', sa.JSON(), nullable=True),
        sa.Column('findings', sa.JSON(), nullable=True),
        sa.Column('fixes', sa.JSON(), nullable=True),
        sa.Column('chains', sa.JSON(), nullable=True),
        sa.Column('graph_nodes', sa.JSON(), nullable=True),
        sa.Column('graph_edges', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
    )

    op.create_table(
        'tool_calls',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('analysis_id', sa.String(64), sa.ForeignKey('analyses.analysis_id'), nullable=False, index=True),
        sa.Column('tool_name', sa.String(32), nullable=False, index=True),
        sa.Column('step_name', sa.String(64), nullable=False),
        sa.Column('endpoint', sa.Text(), nullable=False),
        sa.Column('request_payload', sa.JSON(), nullable=True),
        sa.Column('response_payload', sa.JSON(), nullable=True),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(16), server_default='success'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('tool_calls')
    op.drop_table('analyses')
