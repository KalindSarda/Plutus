import uuid
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    hash_token,
)
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.auth import RegisterRequest, LoginRequest

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def register_user(data: RegisterRequest, db: Session) -> User:
    if data.invite_code != settings.INVITE_CODE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid invite code")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(data: LoginRequest, db: Session) -> User:
    user = db.query(User).filter(User.email == data.email, User.is_active == True).first()
    # Use same error for wrong email and wrong password — no user enumeration
    invalid_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )
    if not user:
        raise invalid_error

    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account temporarily locked. Try again later.",
        )

    if not verify_password(data.password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        db.commit()
        raise invalid_error

    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()
    return user


def issue_tokens(user: User, db: Session, request: Request = None) -> tuple[str, str]:
    access_token = create_access_token({"sub": str(user.id)})
    raw_refresh = create_refresh_token({"sub": str(user.id)})
    token_hash = hash_token(raw_refresh)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    device_hint = None
    if request:
        ua = request.headers.get("user-agent", "")
        device_hint = ua[:200] if ua else None

    db_token = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        device_hint=device_hint,
    )
    db.add(db_token)
    db.commit()
    return access_token, raw_refresh


def rotate_refresh_token(raw_token: str, db: Session) -> tuple[str, str, User]:
    from app.core.security import decode_refresh_token

    payload = decode_refresh_token(raw_token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    token_hash = hash_token(raw_token)
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked == False,
    ).first()

    if not db_token or db_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired or revoked")

    user = db.query(User).filter(User.id == db_token.user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Rotate: revoke old, issue new
    db_token.revoked = True
    db.commit()

    access_token = create_access_token({"sub": str(user.id)})
    new_raw_refresh = create_refresh_token({"sub": str(user.id)})
    new_hash = hash_token(new_raw_refresh)
    new_expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    new_db_token = RefreshToken(
        user_id=user.id,
        token_hash=new_hash,
        expires_at=new_expires,
        device_hint=db_token.device_hint,
    )
    db.add(new_db_token)
    db.commit()
    return access_token, new_raw_refresh, user


def revoke_token(raw_token: str, db: Session) -> None:
    token_hash = hash_token(raw_token)
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if db_token:
        db_token.revoked = True
        db.commit()


def revoke_all_tokens(user_id: uuid.UUID, db: Session) -> None:
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked == False,
    ).update({"revoked": True})
    db.commit()
