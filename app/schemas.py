import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict


class UserSignup(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OAuthLogin(BaseModel):
    id_token: str


class SavedItemCreate(BaseModel):
    source_type: str
    source_url: str | None = None
    content: str | None = None  # required when source_type == "note": the note text itself


class SavedItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_type: str
    source_url: str | None
    title: str | None
    status: str
    failure_reason: str | None = None
    transcript: str | None = None
    created_at: datetime


class SegmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    start_time: float
    end_time: float
    text: str


class ChatRequest(BaseModel):
    question: str


class ChatSource(BaseModel):
    saved_item_id: uuid.UUID
    title: str | None
    source_type: str
    chunk_text: str
    start_time: float | None
    end_time: float | None


class ChatResponse(BaseModel):
    answer: str
    sources: list[ChatSource]
