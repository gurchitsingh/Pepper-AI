import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.models import ChatMessage, ChatSession, User, utcnow
from app.schemas import ChatMessageCreate, ChatMessageOut, ChatSessionDetailOut, ChatSessionOut
from app.titles import fallback_title

router = APIRouter(prefix="/chat/sessions", tags=["chat"])


def fetch_owned_session(db: Session, session_id: uuid.UUID, current_user: User) -> ChatSession:
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    return session


def add_message(
    db: Session,
    session: ChatSession,
    role: str,
    content: str,
    sources: list[dict] | None = None,
    web_sources: list[dict] | None = None,
    answer_source: str | None = None,
) -> ChatMessage:
    """Single place that appends a message: bumps updated_at and, on the first
    user message of an untitled session, sets the deterministic fallback title
    (deliberately not generate_title() -- no extra Groq round-trip)."""
    message = ChatMessage(
        session_id=session.id,
        role=role,
        content=content,
        sources=sources,
        web_sources=web_sources,
        answer_source=answer_source,
    )
    db.add(message)
    session.updated_at = utcnow()
    if role == "user" and session.title is None:
        session.title = fallback_title(content)
    db.commit()
    db.refresh(message)
    return message


@router.get("", response_model=list[ChatSessionOut])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ChatSession)
        .filter(
            ChatSession.user_id == current_user.id,
            db.query(ChatMessage.id).filter(ChatMessage.session_id == ChatSession.id).exists(),
        )
        .order_by(ChatSession.updated_at.desc())
        .all()
    )


@router.post("", response_model=ChatSessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = ChatSession(user_id=current_user.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_id}", response_model=ChatSessionDetailOut)
def get_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = fetch_owned_session(db, session_id, current_user)
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    return ChatSessionDetailOut(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[ChatMessageOut.model_validate(m) for m in messages],
    )


@router.post("/{session_id}/messages", response_model=ChatMessageOut, status_code=status.HTTP_201_CREATED)
def append_message(
    session_id: uuid.UUID,
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = fetch_owned_session(db, session_id, current_user)
    return add_message(
        db,
        session,
        payload.role,
        payload.content,
        sources=[s.model_dump(mode="json") for s in payload.sources] if payload.sources is not None else None,
        web_sources=[s.model_dump(mode="json") for s in payload.web_sources] if payload.web_sources is not None else None,
        answer_source=payload.answer_source,
    )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = fetch_owned_session(db, session_id, current_user)
    db.delete(session)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
