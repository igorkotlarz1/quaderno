"""initial tables: lessons, entries, verbs, assessments

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

Json = sa.JSON().with_variant(JSONB(), "postgresql")


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        # Not used yet; enabled now so M8 (embeddings) needs no superuser step on the Optiplex.
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "lessons",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("date", sa.String(10), index=True),
        sa.Column("title", sa.Text, nullable=False, server_default=""),
        sa.Column("source", sa.String(16), nullable=False, server_default="live"),
        sa.Column("created_at", sa.String(40), nullable=False),
        sa.Column("updated_at", sa.String(40), nullable=False, index=True),
        sa.Column("deleted_at", sa.String(40)),
        sa.Column("summary", Json),
        sa.Column("notes", Json),
    )
    op.create_table(
        "entries",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("lesson_id", sa.String(64), sa.ForeignKey("lessons.id", ondelete="CASCADE"), index=True),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("it", sa.Text),
        sa.Column("pl", sa.Text),
        sa.Column("kind", sa.String(8), nullable=False, server_default="word"),
        sa.Column("pl_source", sa.String(8)),
        sa.Column("pos", sa.String(16)),
        sa.Column("lemma", sa.Text),
        sa.Column("it_original", sa.Text),
        sa.Column("it_suggestion", sa.Text),
        sa.Column("created_at", sa.String(40)),
        sa.Column("extra", Json, nullable=False),
    )
    op.create_table(
        "verbs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("lesson_id", sa.String(64), sa.ForeignKey("lessons.id", ondelete="CASCADE"), index=True),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("it", sa.Text, nullable=False),
        sa.Column("pl", sa.Text),
        sa.Column("tense", sa.String(16), nullable=False, server_default="presente"),
        sa.Column("forms", Json),
        sa.Column("forms_source", sa.String(8)),
        sa.Column("confidence", sa.String(8)),
        sa.Column("revealed", Json, nullable=False),
        sa.Column("created_at", sa.String(40)),
        sa.Column("extra", Json, nullable=False),
    )
    op.create_table(
        "assessments",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("week_end", sa.String(10), nullable=False, index=True),
        sa.Column("level", sa.String(4), nullable=False),
        sa.Column("progress", sa.Integer, nullable=False),
        sa.Column("assessed_at", sa.String(40)),
        sa.Column("data", Json, nullable=False),
        sa.Column("updated_at", sa.DateTime),
    )


def downgrade() -> None:
    for name in ("assessments", "verbs", "entries", "lessons"):
        op.drop_table(name)
