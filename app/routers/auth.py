import mimetypes
import os
import shutil

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    find_or_create_oauth_user,
    get_current_user,
    hash_password,
    verify_apple_token,
    verify_google_token,
    verify_password,
)
from app.database import get_db
from app.models.models import User
from app.rate_limit import limiter
from app.schemas import OAuthLogin, PasswordChange, Token, UserLogin, UserOut, UserSignup

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
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(email=payload.email, name=payload.name, hashed_password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    return Token(access_token=create_access_token(user.id))


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    return Token(access_token=create_access_token(user.id))


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
    )
    return Token(access_token=create_access_token(user.id))


@router.post("/apple", response_model=Token)
def apple_login(payload: OAuthLogin, db: Session = Depends(get_db)):
    claims = verify_apple_token(payload.id_token)
    user = find_or_create_oauth_user(
        db,
        provider="apple",
        provider_id=claims["sub"],
        email=claims.get("email"),
    )
    return Token(access_token=create_access_token(user.id))
