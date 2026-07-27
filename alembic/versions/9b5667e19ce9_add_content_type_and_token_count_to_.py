"""add content_type and token_count to chunks

Revision ID: 9b5667e19ce9
Revises: 64ab75896acd
Create Date: 2026-07-26 12:29:33.634877

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b5667e19ce9'
down_revision: Union[str, Sequence[str], None] = '64ab75896acd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('chunks', sa.Column('content_type', sa.String(), nullable=True))
    op.add_column('chunks', sa.Column('token_count', sa.Integer(), nullable=True))

    # Backfill existing rows: content_type from the parent saved_item's source_type,
    # token_count via the same ~4-chars/token heuristic used by chunking.estimate_tokens.
    op.execute(
        """
        UPDATE chunks
        SET content_type = saved_items.source_type
        FROM saved_items
        WHERE chunks.saved_item_id = saved_items.id
        """
    )
    op.execute("UPDATE chunks SET token_count = GREATEST(1, LENGTH(text) / 4) WHERE token_count IS NULL")

    op.alter_column('chunks', 'content_type', nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('chunks', 'token_count')
    op.drop_column('chunks', 'content_type')
