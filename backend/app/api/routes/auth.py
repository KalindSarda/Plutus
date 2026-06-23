import re
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Cookie, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limiter import limiter
from app.core.security import set_refresh_cookie, revoke_access_token
from app.api.dependencies import get_current_user

_optional_bearer = HTTPBearer(auto_error=False)
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, RefreshResponse
from app.schemas.user import UserResponse, UpdateMeRequest
from app.services import auth_service

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
def register(request: Request, data: RegisterRequest, db: Session = Depends(get_db)):
    return auth_service.register_user(data, db)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = auth_service.authenticate_user(data, db)
    access_token, raw_refresh = auth_service.issue_tokens(user, db, request)
    set_refresh_cookie(response, raw_refresh)
    return {"access_token": access_token}


@router.post("/refresh", response_model=RefreshResponse)
@limiter.limit("10/minute")
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str = Cookie(default=None),
):
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")
    access_token, new_raw_refresh, _ = auth_service.rotate_refresh_token(refresh_token, db)
    set_refresh_cookie(response, new_raw_refresh)
    return {"access_token": access_token}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str = Cookie(default=None),
    credentials: HTTPAuthorizationCredentials = Depends(_optional_bearer),
):
    if credentials:
        revoke_access_token(credentials.credentials)
    if refresh_token:
        auth_service.revoke_token(refresh_token, db)
    response.delete_cookie("refresh_token")


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(
    data: UpdateMeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.name:
        current_user.name = data.name
    if data.new_password:
        if not data.current_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is required.")
        from app.core.security import verify_password, hash_password
        if not verify_password(data.current_password, current_user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
        if len(data.new_password) < 8 or not re.search(r"\d", data.new_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 8 characters and contain a digit.",
            )
        current_user.password_hash = hash_password(data.new_password)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/sessions", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_sessions(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    auth_service.revoke_all_tokens(current_user.id, db)
    response.delete_cookie("refresh_token")
