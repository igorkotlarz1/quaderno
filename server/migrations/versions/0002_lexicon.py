"""M3.5: dictionary tables (lex_lemmas, lex_forms, lex_meta), filled by `python -m app.lexicon.build`

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

Json = sa.JSON().with_variant(JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "lex_lemmas",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("lemma", sa.Text, nullable=False, index=True),
        sa.Column("pos", sa.String(16), nullable=False),
        sa.Column("rank", sa.Integer, nullable=False, index=True),
        sa.Column("freq", sa.Integer, nullable=False),
        sa.Column("senses", Json, nullable=False),
        sa.Column("tags", Json, nullable=False),
    )
    op.create_table(
        "lex_forms",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("form", sa.Text, nullable=False, index=True),
        sa.Column("key", sa.Text, nullable=False, index=True),
        sa.Column(
            "lemma_id",
            sa.Integer,
            sa.ForeignKey("lex_lemmas.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("freq", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_table(
        "lex_meta",
        sa.Column("key", sa.String(32), primary_key=True),
        sa.Column("value", Json, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("lex_forms")
    op.drop_table("lex_lemmas")
    op.drop_table("lex_meta")
