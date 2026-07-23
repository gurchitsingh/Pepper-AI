import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.models import SavedItem, User
from app.schemas import SavedItemCreate, SavedItemOut

router = APIRouter(prefix="/saved-items", tags=["saved-items"])


@router.post("", response_model=SavedItemOut, status_code=status.HTTP_201_CREATED)
def create_saved_item(
    payload: SavedItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = SavedItem(user_id=current_user.id, source_type=payload.source_type, source_url=payload.source_url)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("", response_model=list[SavedItemOut])
def list_saved_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(SavedItem)
        .filter(SavedItem.user_id == current_user.id)
        .order_by(SavedItem.created_at.desc())
        .all()
    )


@router.get("/{item_id}", response_model=SavedItemOut)
def get_saved_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = (
        db.query(SavedItem)
        .filter(SavedItem.id == item_id, SavedItem.user_id == current_user.id)
        .first()
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved item not found")
    return item
