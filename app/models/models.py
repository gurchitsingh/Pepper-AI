import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, String, DateTime, Float, ForeignKey, Index, Integer, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from pgvector.sqlalchemy import Vector
from app.database import Base

EMBEDDING_DIM = 1024  # voyage-4-large default output dimension


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, nullable=False)
    name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    oauth_provider = Column(String, nullable=True)
    oauth_provider_id = Column(String, nullable=True)
    auth_provider = Column(String, nullable=False, default="password", server_default="password")
    plan = Column(String, nullable=False, default="free", server_default="free")
    avatar_path = Column(String, nullable=True)
    profile_picture_url = Column(String, nullable=True)
    email_verified = Column(Boolean, nullable=False, default=False, server_default="false")
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    theme_preference = Column(String, nullable=True)
    interests = Column(ARRAY(String), nullable=True)
    referral_source = Column(String, nullable=True)
    onboarding_completed = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index(
            "ix_users_oauth_provider_oauth_provider_id",
            "oauth_provider",
            "oauth_provider_id",
            unique=True,
        ),
        Index("ix_users_username_lower", func.lower(username), unique=True),
    )

    @property
    def has_avatar(self) -> bool:
        return self.avatar_path is not None


class EmailVerificationCode(Base):
    __tablename__ = "email_verification_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    code_hash = Column(String, nullable=False)
    attempts = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_sent_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=False)


class Folder(Base):
    __tablename__ = "folders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    __table_args__ = (
        Index("ix_folders_user_id_created_at", "user_id", "created_at"),
    )


class SavedItem(Base):
    __tablename__ = "saved_items"

    # status flow: pending -> processing -> ready (or failed, with failure_reason set)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    source_type = Column(String, nullable=False)
    source_url = Column(String, nullable=True)
    uploaded_file_path = Column(String, nullable=True)
    title = Column(String, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    status = Column(String, nullable=False, default="pending")
    failure_reason = Column(String, nullable=True)
    # mean-pooled from this item's chunk embeddings once ingestion finishes;
    # NULL until then (or if embedding was unavailable). Used for folder clustering.
    embedding = Column(Vector(EMBEDDING_DIM), nullable=True)
    folder_id = Column(UUID(as_uuid=True), ForeignKey("folders.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    __table_args__ = (
        Index("ix_saved_items_user_id_created_at", "user_id", "created_at"),
    )


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    saved_item_id = Column(UUID(as_uuid=True), ForeignKey("saved_items.id"), nullable=False, index=True)
    raw_text = Column(Text, nullable=True)
    language = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transcript_id = Column(UUID(as_uuid=True), ForeignKey("transcripts.id"), nullable=False, index=True)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    text = Column(Text, nullable=False)


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    saved_item_id = Column(UUID(as_uuid=True), ForeignKey("saved_items.id"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    start_time = Column(Float, nullable=True)
    end_time = Column(Float, nullable=True)
    chunk_index = Column(Integer, nullable=False)
    content_type = Column(String, nullable=False)
    token_count = Column(Integer, nullable=True)
    embedding = Column(Vector(EMBEDDING_DIM), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)