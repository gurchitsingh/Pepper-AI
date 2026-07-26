from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    find_or_create_oauth_user,
    hash_password,
    verify_apple_token,
    verify_google_token,
    verify_password,
)
from app.database import get_db
from app.models.models import User
from app.rate_limit import limiter
from app.schemas import OAuthLogin, Token, UserLogin, UserSignup

router = APIRouter(prefix="/auth", tags=["auth"])


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
