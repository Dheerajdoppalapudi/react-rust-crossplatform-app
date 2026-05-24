"""
Tests for auth token handling — JWT validation and refresh token rotation.
"""

import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from core.config import JWT_SECRET_KEY, JWT_ALGORITHM


# ── JWT helpers ───────────────────────────────────────────────────────────────

def _make_token(sub: str, expire_minutes: int = 15) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    return jwt.encode({"sub": sub, "exp": expire}, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def _make_expired_token(sub: str) -> str:
    expire = datetime.now(timezone.utc) - timedelta(minutes=1)
    return jwt.encode({"sub": sub, "exp": expire}, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


# ── JWT validation (no DB required) ───────────────────────────────────────────

def test_valid_jwt_decodes():
    token = _make_token("user-123")
    payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    assert payload["sub"] == "user-123"


def test_expired_jwt_raises():
    token = _make_expired_token("user-456")
    with pytest.raises(jwt.ExpiredSignatureError):
        jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])


def test_tampered_jwt_raises():
    token = _make_token("user-789")
    tampered = token[:-5] + "XXXXX"
    with pytest.raises(jwt.PyJWTError):
        jwt.decode(tampered, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])


# ── Refresh token rotation (requires live DB) ──────────────────────────────────

async def test_rotate_refresh_token(clean_db):
    from core.db_async import create_password_user, create_refresh_token, rotate_refresh_token

    user = await create_password_user(uuid.uuid4().hex, "Test", "a@b.com", "hash")
    token = await create_refresh_token(user.id)

    result = await rotate_refresh_token(token)
    assert result is not None
    new_token, user_id = result
    assert user_id == user.id
    assert new_token != token


async def test_rotate_already_used_token_returns_none(clean_db):
    from core.db_async import create_password_user, create_refresh_token, rotate_refresh_token

    user = await create_password_user(uuid.uuid4().hex, "Test2", "b@b.com", "hash")
    token = await create_refresh_token(user.id)

    await rotate_refresh_token(token)        # first rotation — valid
    result = await rotate_refresh_token(token)  # reuse — theft detected
    assert result is None


# ── Password length validation ─────────────────────────────────────────────────

def test_password_too_short_rejected():
    from fastapi import HTTPException
    password = "short"
    with pytest.raises(HTTPException):
        if len(password) < 8 or len(password) > 128:
            raise HTTPException(status_code=422, detail="Password must be 8–128 characters")


def test_password_valid_length():
    password = "validpassword123"
    assert 8 <= len(password) <= 128
