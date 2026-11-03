"""merge email verification and chat sessions heads

Revision ID: 42575f1e1047
Revises: 6d7d619a7789, a7c3e91d2b54
Create Date: 2026-11-04 02:34:27.992068

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '42575f1e1047'
down_revision: Union[str, Sequence[str], None] = ('6d7d619a7789', 'a7c3e91d2b54')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
