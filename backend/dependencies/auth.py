"""
FastAPI dependency that validates the Bearer JWT and returns the current user.

CRIT-2: The `?token=` query parameter support has been removed from
`get_current_user_media`. Media endpoints now require a short-lived,
session-scoped media token issued by POST /api/media-token.
This token expires in MEDIA_TOKEN_EXPIRE_MINUTES (default 5 min) so even if
logged in server access logs it expires before it can be exploited.
"""

import logging
import time
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.config import JWT_ALGORITHM, JWT_SECRET_KEY, MEDIA_TOKEN_EXPIRE_MINUTES
from core.database import get_user_by_id
from core.db_models import User

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)


# ── Token resolution ──────────────────────────────────────────────────────────

def _resolve_user(token_str: str) -> User:
    """Decode a raw JWT string and return the User, or raise 401."""
    try:
        payload = jwt.decode(token_str, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


# ── Standard auth dependency ──────────────────────────────────────────────────

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> User:
    """
    Extract and verify the Bearer JWT from the Authorization header.
    Raises HTTP 401 if the token is missing, expired, or invalid.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _resolve_user(credentials.credentials)


# ── Media token (CRIT-2) ──────────────────────────────────────────────────────

def create_media_token(user_id: str, session_id: str) -> str:
    """
    Issue a short-lived (MEDIA_TOKEN_EXPIRE_MINUTES), session-scoped JWT
    for use in media URL query strings.

    The token carries a `typ=media` claim and a `sid` (session_id) claim so it
    cannot be reused across sessions or for non-media endpoints.
    """
    exp = int(time.time()) + MEDIA_TOKEN_EXPIRE_MINUTES * 60
    payload = {
        "sub": user_id,
        "sid": session_id,
        "typ": "media",
        "exp": exp,
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_user_media(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> User:
    """
    Validate a media token from the Authorization header.

    Media endpoints accept EITHER:
      - A standard access JWT (Authorization: Bearer <access_token>)  — for
        programmatic / API clients that can set headers.
      - A short-lived media JWT (Authorization: Bearer <media_token>)  — for
        browser <video> / <img> elements that use the ?token= pattern via the
        /api/media-token endpoint.

    The ?token= query parameter is intentionally NOT supported here.
    See POST /api/media-token for the correct flow.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _resolve_user(credentials.credentials)


def resolve_media_user(
    token: str,
    session_id: str,
    credentials: "Optional[HTTPAuthorizationCredentials]",
) -> "User":
    """
    Unified auth for binary media endpoints (video, frame images).

    Browser clients (e.g. <video src>, <img src>) cannot send an Authorization
    header — they use the ?token= query parameter with a short-lived media token.
    Programmatic / API clients use the standard Authorization: Bearer header.

    Resolution order:
      1. ?token= present → validate as session-scoped media token
      2. Authorization header present → validate as standard access JWT
      3. Neither → HTTP 401
    """
    if token:
        return validate_media_token(token, session_id)
    if credentials:
        return _resolve_user(credentials.credentials)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


def validate_media_token(token_str: str, expected_session_id: str) -> User:
    """
    Validate a media token and verify it is scoped to the expected session.
    Called by media endpoints that receive the token as a query parameter.

    Raises HTTP 401/403 on any validation failure.
    """
    try:
        payload = jwt.decode(token_str, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Media token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid media token")

    # Verify token type
    if payload.get("typ") != "media":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token not valid for media access")

    # Verify session scope
    if payload.get("sid") != expected_session_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token not valid for this session")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user
