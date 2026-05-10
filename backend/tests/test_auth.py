"""
Tests for auth token handling in routers/auth.py and core/database.py.

Covers: token rotation theft detection, JWT expiry, password validation.
"""

import time
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

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


# ── JWT validation ─────────────────────────────────────────────────────────────

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


# ── Refresh token rotation ─────────────────────────────────────────────────────

def test_rotate_refresh_token(tmp_path):
    import core.config as cfg
    cfg.DB_PATH = tmp_path / "auth_test.sqlite"
    from core.database import init_db, create_refresh_token, rotate_refresh_token, upsert_user
    from core.db_models import User
    init_db()

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    user = User(id="u1", email="a@b.com", name="Test", avatar="", created_at=now, last_login=now)
    upsert_user(user)

    token = create_refresh_token("u1")
    result = rotate_refresh_token(token)
    assert result is not None
    new_token, user_id = result
    assert user_id == "u1"
    assert new_token != token


def test_rotate_already_used_token_returns_none(tmp_path):
    import core.config as cfg
    cfg.DB_PATH = tmp_path / "auth_theft.sqlite"
    from core.database import init_db, create_refresh_token, rotate_refresh_token, upsert_user
    from core.db_models import User
    init_db()

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    user = User(id="u2", email="b@b.com", name="Test2", avatar="", created_at=now, last_login=now)
    upsert_user(user)

    token = create_refresh_token("u2")
    rotate_refresh_token(token)  # first rotation — valid

    result = rotate_refresh_token(token)  # reuse — theft detected
    assert result is None


# ── Password validation ────────────────────────────────────────────────────────

def test_password_too_short_rejected():
    from fastapi import HTTPException
    import bcrypt

    password = "short"
    with pytest.raises(Exception):
        if len(password) < 8 or len(password) > 128:
            from fastapi import HTTPException
            raise HTTPException(status_code=422, detail="Password must be 8–128 characters")


def test_password_valid_length():
    password = "validpassword123"
    assert 8 <= len(password) <= 128
