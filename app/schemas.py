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


class SavedItemCreate(BaseModel):
    source_type: str
    source_url: str | None = None


class SavedItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_type: str
    source_url: str | None
    title: str | None
    status: str
    created_at: datetime
