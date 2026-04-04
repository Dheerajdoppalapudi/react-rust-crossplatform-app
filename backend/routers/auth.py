"""
Auth router — Google OAuth, token refresh, logout, and /me.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr

from core.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from core.database import (
    create_password_user,
    create_refresh_token,
    delete_refresh_token,
    get_user_by_email,
    get_user_by_id,
    get_user_password_hash,
    rotate_refresh_token,
    upsert_user,
)
from core.db_models import User
from core.responses import success
from dependencies.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class GoogleLoginRequest(BaseModel):
    access_token: str

class RegisterRequest(BaseModel):
    name:     str
    email:    EmailStr
    password: str

class PasswordLoginRequest(BaseModel):
    email:    EmailStr
    password: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _create_access_token(user_id: str) -> str:
    expire  = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86_400,
        path="/auth/refresh",   # Only sent to the refresh endpoint
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key="refresh_token",
        path="/auth/refresh",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
    )


def _get_google_user_info(access_token: str) -> dict:
    """
    Fetch the authenticated user's profile from Google's userinfo endpoint.

    This verifies the access_token by presenting it to Google — any invalid or
    expired token results in a non-200 response which we surface as a 401.
    """
    import urllib.request
    import json as _json

    try:
        req = urllib.request.Request(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return _json.loads(resp.read())
    except Exception as exc:
        logger.warning("Google userinfo request failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Google access token",
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/google")
def login_with_google(body: GoogleLoginRequest, response: Response):
    """
    Verify a Google OAuth access token via Google's userinfo endpoint.
    Upserts the user, issues an access JWT + sets a refresh token cookie.
    """
    info = _get_google_user_info(body.access_token)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    user = User(
        id=info["sub"],
        email=info.get("email", ""),
        name=info.get("name", ""),
        avatar=info.get("picture", ""),
        created_at=now,
        last_login=now,
    )
    upsert_user(user)

    access_token  = _create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    _set_refresh_cookie(response, refresh_token)

    logger.info("User logged in  user_id=%s  email=%s", user.id, user.email)
    return success({
        "access_token": access_token,
        "user": {
            "id":     user.id,
            "name":   user.name,
            "email":  user.email,
            "avatar": user.avatar,
        },
    })


@router.post("/refresh")
def refresh_token(response: Response, refresh_token: str = Cookie(default=None)):
    """
    Rotate the refresh token and issue a new access token.

    The browser sends the refresh_token cookie automatically.
    On reuse of an old token (theft detected), forces a full logout.
    """
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token",
        )

    result = rotate_refresh_token(refresh_token)
    if result is None:
        # Token was not found — possible theft; clear the cookie
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalid or already used",
        )

    new_refresh_token, user_id = result

    user = get_user_by_id(user_id)
    if not user:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    access_token = _create_access_token(user_id)
    _set_refresh_cookie(response, new_refresh_token)

    return success({
        "access_token": access_token,
        "user": {
            "id":     user.id,
            "name":   user.name,
            "email":  user.email,
            "avatar": user.avatar,
        },
    })


@router.post("/logout")
def logout(
    response: Response,
    refresh_token: str = Cookie(default=None),
    current_user: User = Depends(get_current_user),
):
    """Delete the refresh token and clear the cookie."""
    if refresh_token:
        delete_refresh_token(refresh_token)
    _clear_refresh_cookie(response)
    logger.info("User logged out  user_id=%s", current_user.id)
    return success({"message": "Logged out"})


@router.post("/register")
def register(body: RegisterRequest, response: Response):
    """
    Register a new user with name, email, and password.
    Returns an access token and sets a refresh cookie — same as Google login.
    """
    if len(body.password) < 8 or len(body.password) > 128:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be 8–128 characters",
        )

    existing = get_user_by_email(body.email)
    if existing:
        if existing.auth_provider == "google":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email is linked to a Google account. Sign in with Google instead.",
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    user_id = uuid.uuid4().hex

    user = create_password_user(
        user_id=user_id,
        name=body.name.strip(),
        email=body.email,
        password_hash=password_hash,
    )

    access_token  = _create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    _set_refresh_cookie(response, refresh_token)

    logger.info("User registered  user_id=%s  email=%s", user.id, user.email)
    return success({
        "access_token": access_token,
        "user": {
            "id":     user.id,
            "name":   user.name,
            "email":  user.email,
            "avatar": user.avatar,
        },
    })


@router.post("/login")
def login_with_password(body: PasswordLoginRequest, response: Response):
    """
    Authenticate with email + password.
    Returns an access token and sets a refresh cookie.
    """
    existing = get_user_by_email(body.email)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if existing.auth_provider == "google":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is linked to a Google account. Sign in with Google instead.",
        )

    if len(body.password) > 128:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    stored_hash = get_user_password_hash(body.email)
    if not stored_hash or not bcrypt.checkpw(body.password.encode(), stored_hash.encode()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token  = _create_access_token(existing.id)
    refresh_token = create_refresh_token(existing.id)
    _set_refresh_cookie(response, refresh_token)

    logger.info("User logged in (password)  user_id=%s  email=%s", existing.id, existing.email)
    return success({
        "access_token": access_token,
        "user": {
            "id":     existing.id,
            "name":   existing.name,
            "email":  existing.email,
            "avatar": existing.avatar,
        },
    })


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return success({
        "id":     current_user.id,
        "name":   current_user.name,
        "email":  current_user.email,
        "avatar": current_user.avatar,
    })
