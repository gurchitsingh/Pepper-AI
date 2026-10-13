import secrets
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth import hash_password, verify_password
from app.models.models import EmailVerificationCode, User, utcnow

CODE_EXPIRY_MINUTES = 10
MAX_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60


def _generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def issue_verification_code(db: Session, user: User) -> str:
    """Create (or replace) the user's active verification code, enforcing the resend cooldown."""
    now = utcnow()
    record = db.query(EmailVerificationCode).filter(EmailVerificationCode.user_id == user.id).first()

    if record and (now - record.last_sent_at).total_seconds() < RESEND_COOLDOWN_SECONDS:
        wait = RESEND_COOLDOWN_SECONDS - int((now - record.last_sent_at).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {wait}s before requesting another code.",
        )

    code = _generate_code()
    code_hash = hash_password(code)
    expires_at = now + timedelta(minutes=CODE_EXPIRY_MINUTES)

    if record:
        record.code_hash = code_hash
        record.attempts = 0
        record.last_sent_at = now
        record.expires_at = expires_at
    else:
        record = EmailVerificationCode(
            user_id=user.id,
            code_hash=code_hash,
            attempts=0,
            last_sent_at=now,
            expires_at=expires_at,
        )
        db.add(record)

    db.commit()
    return code


def verify_code(db: Session, user: User, code: str) -> None:
    record = db.query(EmailVerificationCode).filter(EmailVerificationCode.user_id == user.id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect code.")

    if record.expires_at < utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This code has expired. Request a new one.")

    if record.attempts >= MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many incorrect attempts. Request a new code.",
        )

    if not verify_password(code, record.code_hash):
        record.attempts += 1
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect code.")

    user.email_verified = True
    user.email_verified_at = utcnow()
    db.delete(record)
    db.commit()
