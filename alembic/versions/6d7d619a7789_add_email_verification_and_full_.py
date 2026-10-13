"""add email verification and full profile fields to users

Revision ID: 6d7d619a7789
Revises: 44405fd203af
Create Date: 2026-10-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '6d7d619a7789'
down_revision: Union[str, Sequence[str], None] = '44405fd203af'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # --- new nullable columns first, so we can backfill before tightening constraints ---
    op.add_column('users', sa.Column('username', sa.String(), nullable=True))
    op.add_column('users', sa.Column('auth_provider', sa.String(), nullable=True))
    op.add_column('users', sa.Column('profile_picture_url', sa.String(), nullable=True))
    op.add_column('users', sa.Column('email_verified', sa.Boolean(), nullable=True))
    op.add_column('users', sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('theme_preference', sa.String(), nullable=True))
    op.add_column('users', sa.Column('interests', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('users', sa.Column('referral_source', sa.String(), nullable=True))
    op.add_column('users', sa.Column('onboarding_completed', sa.Boolean(), nullable=True))
    op.add_column('users', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True))

    # --- backfill existing rows ---
    # Mark every existing user as verified so nobody already using the app gets locked out.
    op.execute("UPDATE users SET email_verified = TRUE, email_verified_at = COALESCE(email_verified_at, created_at) WHERE email_verified IS NULL")
    op.execute("UPDATE users SET auth_provider = COALESCE(oauth_provider, 'password') WHERE auth_provider IS NULL")
    op.execute("UPDATE users SET onboarding_completed = FALSE WHERE onboarding_completed IS NULL")
    op.execute("UPDATE users SET updated_at = created_at WHERE updated_at IS NULL")

    # Derive a username from the email local-part for existing rows, stripping characters
    # that aren't allowed, then de-duplicate any collisions deterministically.
    op.execute(
        r"""
        UPDATE users
        SET username = NULLIF(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_.]', '', 'g'), '')
        WHERE username IS NULL
        """
    )
    op.execute("UPDATE users SET username = 'user' || substr(id::text, 1, 8) WHERE username IS NULL")
    op.execute(
        """
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY lower(username) ORDER BY created_at, id) AS rn
            FROM users
        )
        UPDATE users u
        SET username = u.username || '_' || substr(u.id::text, 1, 6)
        FROM ranked r
        WHERE u.id = r.id AND r.rn > 1
        """
    )

    # --- tighten constraints now that every row has a value ---
    op.alter_column('users', 'username', existing_type=sa.String(), nullable=False)
    op.alter_column('users', 'auth_provider', existing_type=sa.String(), nullable=False, server_default='password')
    op.alter_column('users', 'email_verified', existing_type=sa.Boolean(), nullable=False, server_default='false')
    op.alter_column('users', 'onboarding_completed', existing_type=sa.Boolean(), nullable=False, server_default='false')
    op.alter_column('users', 'updated_at', existing_type=sa.DateTime(timezone=True), nullable=False)

    op.create_index('ix_users_username_lower', 'users', [sa.text('lower(username)')], unique=True)

    op.create_table(
        'email_verification_codes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False, unique=True),
        sa.Column('code_hash', sa.String(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_sent_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_email_verification_codes_user_id', 'email_verification_codes', ['user_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_email_verification_codes_user_id', table_name='email_verification_codes')
    op.drop_table('email_verification_codes')

    op.drop_index('ix_users_username_lower', table_name='users')

    op.drop_column('users', 'last_login_at')
    op.drop_column('users', 'updated_at')
    op.drop_column('users', 'onboarding_completed')
    op.drop_column('users', 'referral_source')
    op.drop_column('users', 'interests')
    op.drop_column('users', 'theme_preference')
    op.drop_column('users', 'email_verified_at')
    op.drop_column('users', 'email_verified')
    op.drop_column('users', 'profile_picture_url')
    op.drop_column('users', 'auth_provider')
    op.drop_column('users', 'username')
