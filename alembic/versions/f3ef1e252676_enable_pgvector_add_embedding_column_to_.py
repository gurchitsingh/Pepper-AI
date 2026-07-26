"""enable pgvector, add embedding column to chunks

Revision ID: f3ef1e252676
Revises: dc0c019a15bb
Create Date: 2026-07-24 03:25:48.729666

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import pgvector.sqlalchemy


# revision identifiers, used by Alembic.
revision: str = 'f3ef1e252676'
down_revision: Union[str, Sequence[str], None] = 'dc0c019a15bb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.add_column('chunks', sa.Column('embedding', pgvector.sqlalchemy.Vector(1024), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('chunks', 'embedding')
    op.execute("DROP EXTENSION IF EXISTS vector")
