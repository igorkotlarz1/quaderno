"""M4: llm_calls, one row per Claude API call with tokens and estimated cost

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_calls",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.String(40), nullable=False, index=True),
        sa.Column("purpose", sa.String(16), nullable=False),
        sa.Column("model", sa.String(48), nullable=False),
        sa.Column("lesson_id", sa.String(64)),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("input_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("cache_read_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("cache_write_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Float, nullable=False, server_default="0"),
        sa.Column("duration_ms", sa.Integer, nullable=False, server_default="0"),
        sa.Column("request_id", sa.String(64)),
        sa.Column("error", sa.Text),
    )


def downgrade() -> None:
    op.drop_table("llm_calls")
