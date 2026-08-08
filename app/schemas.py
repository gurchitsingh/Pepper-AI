import re
import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator


class UserSignup(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str | None = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        if not re.search(r"[A-Z]", value) or not re.search(r"[0-9]", value):
            raise ValueError("Password must contain at least one uppercase letter and one number")
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OAuthLogin(BaseModel):
    id_token: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None
    plan: str


class SavedItemCreate(BaseModel):
    source_type: str
    source_url: str | None = None
    content: str | None = None  # required when source_type == "note": the note text itself
    title: str | None = None  # optional, only used when source_type == "note"


class SavedItemUpdate(BaseModel):
    title: str | None = None
    content: str | None = None  # only allowed when the item's source_type == "note"


class SavedItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_type: str
    source_url: str | None
    title: str | None
    status: str
    failure_reason: str | None = None
    transcript: str | None = None
    duration_seconds: float | None = None
    folder_id: uuid.UUID | None = None
    folder_name: str | None = None
    created_at: datetime


class FolderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    item_count: int
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


class WebSource(BaseModel):
    title: str | None
    url: str
    content: str | None = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[ChatSource] = Field(default_factory=list)
    web_sources: list[WebSource] = Field(default_factory=list)
    answer_source: Literal["saved_content", "web_search"]


class InsightsTypeBreakdown(BaseModel):
    source_type: str
    count: int


class InsightsFolderBreakdown(BaseModel):
    folder_id: uuid.UUID | None
    folder_name: str
    count: int


class InsightsTrendPoint(BaseModel):
    date: date
    count: int


class InsightsOut(BaseModel):
    total_items: int
    ready_items: int
    processing_items: int
    failed_items: int
    by_type: list[InsightsTypeBreakdown]
    by_folder: list[InsightsFolderBreakdown]
    trend: list[InsightsTrendPoint]
    first_saved_at: datetime | None


class BillingStatusOut(BaseModel):
    plan: str
    short_form_seconds: float
    long_form_seconds: float
    total_seconds: float
    limit_seconds: float | None
    over_limit: bool
