from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.models import Folder, SavedItem, User
from app.schemas import InsightsFolderBreakdown, InsightsOut, InsightsTrendPoint, InsightsTypeBreakdown

router = APIRouter(prefix="/insights", tags=["insights"])

TREND_DAYS = 14


@router.get("", response_model=InsightsOut)
def get_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = db.query(SavedItem).filter(SavedItem.user_id == current_user.id).all()

    ready_items = sum(1 for i in items if i.status == "ready")
    processing_items = sum(1 for i in items if i.status in ("pending", "processing"))
    failed_items = sum(1 for i in items if i.status == "failed")

    type_counts: dict[str, int] = {}
    for item in items:
        type_counts[item.source_type] = type_counts.get(item.source_type, 0) + 1
    by_type = [
        InsightsTypeBreakdown(source_type=source_type, count=count)
        for source_type, count in sorted(type_counts.items(), key=lambda kv: kv[1], reverse=True)
    ]

    folders = db.query(Folder).filter(Folder.user_id == current_user.id).all()
    folder_name_by_id = {folder.id: folder.name for folder in folders}
    folder_counts: dict = {}
    for item in items:
        folder_counts[item.folder_id] = folder_counts.get(item.folder_id, 0) + 1
    by_folder = [
        InsightsFolderBreakdown(
            folder_id=folder_id,
            folder_name=folder_name_by_id.get(folder_id, "Unsorted") if folder_id else "Unsorted",
            count=count,
        )
        for folder_id, count in sorted(folder_counts.items(), key=lambda kv: kv[1], reverse=True)
    ]

    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=TREND_DAYS - 1)
    daily_counts: dict[date, int] = {start + timedelta(days=i): 0 for i in range(TREND_DAYS)}
    for item in items:
        item_date = item.created_at.astimezone(timezone.utc).date()
        if item_date in daily_counts:
            daily_counts[item_date] += 1
    trend = [InsightsTrendPoint(date=d, count=c) for d, c in sorted(daily_counts.items())]

    first_saved_at = min((item.created_at for item in items), default=None)

    return InsightsOut(
        total_items=len(items),
        ready_items=ready_items,
        processing_items=processing_items,
        failed_items=failed_items,
        by_type=by_type,
        by_folder=by_folder,
        trend=trend,
        first_saved_at=first_saved_at,
    )
