from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.billing import FREE_PLAN_LIMIT_SECONDS, get_usage_seconds
from app.database import get_db
from app.models.models import User
from app.schemas import BillingStatusOut

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/status", response_model=BillingStatusOut)
def billing_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    usage = get_usage_seconds(db, current_user.id)
    limit = FREE_PLAN_LIMIT_SECONDS if current_user.plan == "free" else None
    return BillingStatusOut(
        plan=current_user.plan,
        short_form_seconds=usage["short_form_seconds"],
        long_form_seconds=usage["long_form_seconds"],
        total_seconds=usage["total_seconds"],
        limit_seconds=limit,
        over_limit=limit is not None and usage["total_seconds"] > limit,
    )
