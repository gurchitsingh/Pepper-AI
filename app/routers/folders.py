from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.folders import recompute_folders
from app.models.models import Folder, SavedItem, User
from app.schemas import FolderOut

router = APIRouter(prefix="/folders", tags=["folders"])


@router.get("", response_model=list[FolderOut])
def list_folders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(Folder, func.count(SavedItem.id))
        .outerjoin(SavedItem, SavedItem.folder_id == Folder.id)
        .filter(Folder.user_id == current_user.id)
        .group_by(Folder.id)
        .order_by(Folder.created_at.desc())
        .all()
    )
    return [
        FolderOut(id=folder.id, name=folder.name, item_count=count, created_at=folder.created_at)
        for folder, count in rows
    ]


@router.post("/recompute", response_model=list[FolderOut])
def recompute(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rebuilds the current user's auto-folders from scratch, synchronously.
    Clustering + one batched Gemini naming call is fast enough at
    personal-library scale to run inline rather than through the job queue."""
    folders = recompute_folders(db, current_user.id)
    counts: dict = {}
    for folder in folders:
        counts[folder.id] = db.query(SavedItem).filter(SavedItem.folder_id == folder.id).count()
    return [
        FolderOut(id=f.id, name=f.name, item_count=counts.get(f.id, 0), created_at=f.created_at)
        for f in folders
    ]
