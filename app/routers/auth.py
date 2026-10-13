import mimetypes
import os
import shutil

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    find_or_create_oauth_user,
    get_current_user,
    hash_password,
    validate_and_normalize_email,
    verify_apple_token,
    verify_google_token,
    verify_password,
)
from app.database import get_db
from app.email_service import send_verification_code_email
from app.models.models import User, utcnow
from app.rate_limit import limiter
from app.schemas import (
    OAuthLogin,
    PasswordChange,
    ResendCodeRequest,
    Token,
    UserLogin,
    UserOut,
    UserSignup,
    UserUpdate,
    VerifyEmailRequest,
)
from app.verification import issue_verification_code, verify_code

router = APIRouter(prefix="/auth", tags=["auth"])

AVATAR_DIR = os.getenv("AVATAR_DIR", "./uploads/avatars")
AVATAR_CONTENT_TYPE_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

os.makedirs(AVATAR_DIR, exist_ok=True)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updates = payload.model_dump(exclude_unset=True)
    needs_reverification = False

    if "email" in updates and updates["email"] is not None:
        new_email = validate_and_normalize_email(updates["email"])
        if new_email != current_user.email:
            if db.query(User).filter(User.email == new_email, User.id != current_user.id).first():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
            current_user.email = new_email
            current_user.email_verified = False
            current_user.email_verified_at = None
            needs_reverification = True

    if "username" in updates and updates["username"] is not None:
        new_username = updates["username"]
        if new_username.lower() != current_user.username.lower():
            if db.query(User).filter(func.lower(User.username) == new_username.lower(), User.id != current_user.id).first():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
            current_user.username = new_username

    if "name" in updates:
        current_user.name = updates["name"]
    if "theme" in updates:
        current_user.theme_preference = updates["theme"]
    if "interests" in updates:
        current_user.interests = updates["interests"]
    if "referral_source" in updates:
        current_user.referral_source = updates["referral_source"]
    if "onboarding_completed" in updates and updates["onboarding_completed"] is not None:
        current_user.onboarding_completed = updates["onboarding_completed"]

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email or username already registered")
    db.refresh(current_user)

    if needs_reverification:
        code = issue_verification_code(db, current_user)
        send_verification_code_email(current_user.email, code)

    return current_user


@router.post("/avatar", response_model=UserOut)
def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = AVATAR_CONTENT_TYPE_EXT.get(file.content_type or "")
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar must be a JPEG, PNG, or WebP image",
        )

    old_path = current_user.avatar_path
    dest_path = os.path.join(AVATAR_DIR, f"{current_user.id}{ext}")
    with open(dest_path, "wb") as out:
        shutil.copyfileobj(file.file, out)

    if old_path and old_path != dest_path and os.path.exists(old_path):
        os.remove(old_path)

    current_user.avatar_path = dest_path
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/avatar")
def get_avatar(current_user: User = Depends(get_current_user)):
    if not current_user.avatar_path or not os.path.exists(current_user.avatar_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No avatar set")

    media_type = mimetypes.guess_type(current_user.avatar_path)[0] or "application/octet-stream"
    return FileResponse(current_user.avatar_path, media_type=media_type)


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def signup(request: Request, payload: UserSignup, db: Session = Depends(get_db)):
    email = validate_and_normalize_email(payload.email)

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    if db.query(User).filter(func.lower(User.username) == payload.username.lower()).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

    user = User(
        email=email,
        username=payload.username,
        name=payload.name,
        hashed_password=hash_password(payload.password),
        auth_provider="password",
        email_verified=False,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email or username already registered")
    db.refresh(user)

    code = issue_verification_code(db, user)
    send_verification_code_email(user.email, code)

    return Token(
        access_token=create_access_token(user.id),
        email_verified=user.email_verified,
        onboarding_completed=user.onboarding_completed,
    )


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, payload: UserLogin, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    user.last_login_at = utcnow()
    db.commit()

    return Token(
        access_token=create_access_token(user.id),
        email_verified=user.email_verified,
        onboarding_completed=user.onboarding_completed,
    )


@router.post("/verify-email", response_model=Token)
@limiter.limit("10/minute")
def verify_email(request: Request, payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect code.")

    verify_code(db, user, payload.code)

    return Token(
        access_token=create_access_token(user.id),
        email_verified=user.email_verified,
        onboarding_completed=user.onboarding_completed,
    )


@router.post("/resend-verification", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/minute")
def resend_verification(request: Request, payload: ResendCodeRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or user.email_verified:
        return

    code = issue_verification_code(db, user)
    send_verification_code_email(user.email, code)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
def change_password(
    request: Request,
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.hashed_password or not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()


@router.post("/google", response_model=Token)
def google_login(payload: OAuthLogin, db: Session = Depends(get_db)):
    claims = verify_google_token(payload.id_token)
    user = find_or_create_oauth_user(
        db,
        provider="google",
        provider_id=claims["sub"],
        email=claims.get("email"),
        name=claims.get("name"),
        picture=claims.get("picture"),
    )
    return Token(
        access_token=create_access_token(user.id),
        email_verified=user.email_verified,
        onboarding_completed=user.onboarding_completed,
    )


@router.post("/apple", response_model=Token)
def apple_login(payload: OAuthLogin, db: Session = Depends(get_db)):
    claims = verify_apple_token(payload.id_token)
    user = find_or_create_oauth_user(
        db,
        provider="apple",
        provider_id=claims["sub"],
        email=claims.get("email"),
    )
    return Token(
        access_token=create_access_token(user.id),
        email_verified=user.email_verified,
        onboarding_completed=user.onboarding_completed,
    )
