from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.models import SavedItem, User

SHORT_FORM_MAX_SECONDS = 180  # under ~3 min counts as short-form (reels/shorts)
FREE_PLAN_LIMIT_SECONDS = 20 * 60


def get_usage_seconds(db: Session, user_id) -> dict:
    """Cumulative duration of a user's successfully-ingested content, split
    short-form (<3min) vs long-form (everything else).

    Only counts saved_items with a known duration_seconds -- articles/notes/
    documents have no duration concept and are excluded entirely rather than
    counted as zero. Only status == "ready" items count: a failed item's
    duration (if any) doesn't represent real stored content.
    """
    short_sum, long_sum = (
        db.query(
            func.coalesce(
                func.sum(case((SavedItem.duration_seconds < SHORT_FORM_MAX_SECONDS, SavedItem.duration_seconds), else_=0)), 0
            ),
            func.coalesce(
                func.sum(case((SavedItem.duration_seconds >= SHORT_FORM_MAX_SECONDS, SavedItem.duration_seconds), else_=0)), 0
            ),
        )
        .filter(
            SavedItem.user_id == user_id,
            SavedItem.status == "ready",
            SavedItem.duration_seconds.isnot(None),
        )
        .one()
    )
    short_sum, long_sum = float(short_sum), float(long_sum)
    return {
        "short_form_seconds": short_sum,
        "long_form_seconds": long_sum,
        "total_seconds": short_sum + long_sum,
    }


def check_usage_allowed(db: Session, user: User) -> None:
    """Raises 402 if a free-plan user has already hit the threshold. Paid plan is unlimited."""
    if user.plan != "free":
        return
    usage = get_usage_seconds(db, user.id)
    if usage["total_seconds"] > FREE_PLAN_LIMIT_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Free plan limit of {FREE_PLAN_LIMIT_SECONDS // 60} minutes of submitted "
                "content reached. Upgrade to a paid plan to continue."
            ),
        )
