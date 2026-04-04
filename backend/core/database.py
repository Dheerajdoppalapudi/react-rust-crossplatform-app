"""
Database layer — SQLite helpers shared across all routers.

All direct sqlite3 usage is confined to this module.
"""

import logging
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from core.config import DB_PATH, OUTPUTS_DIR, REFRESH_TOKEN_EXPIRE_DAYS
from core.db_models import User

logger = logging.getLogger(__name__)


# ── Connection ────────────────────────────────────────────────────────────────

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


# ── Schema + migrations ───────────────────────────────────────────────────────

def init_db() -> None:
    """Create tables and run safe ALTER TABLE migrations on every startup."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id         TEXT PRIMARY KEY,
                email      TEXT UNIQUE NOT NULL,
                name       TEXT,
                avatar     TEXT,
                created_at TEXT NOT NULL,
                last_login TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                token      TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id                TEXT PRIMARY KEY,
                title             TEXT NOT NULL,
                created_at        TEXT NOT NULL,
                updated_at        TEXT NOT NULL,
                merged_video_path TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id                 TEXT PRIMARY KEY,
                prompt             TEXT NOT NULL,
                created_at         TEXT NOT NULL,
                status             TEXT NOT NULL DEFAULT 'pending',
                intent_type        TEXT,
                render_path        TEXT,
                frame_count        INTEGER,
                output_dir         TEXT,
                ui_output_file     TEXT,
                api_call_count     INTEGER DEFAULT 0,
                prompt_tokens      INTEGER DEFAULT 0,
                completion_tokens  INTEGER DEFAULT 0,
                total_tokens       INTEGER DEFAULT 0,
                model_name         TEXT,
                video_path         TEXT,
                conversation_id    TEXT,
                turn_index         INTEGER DEFAULT 1,
                parent_session_id  TEXT,
                parent_frame_index INTEGER
            )
        """)

        # Safe migrations — "column already exists" errors are silently swallowed
        # (SQLite has no IF NOT EXISTS for ALTER TABLE).
        for col, typedef in [
            ("video_path",          "TEXT"),
            ("conversation_id",     "TEXT"),
            ("turn_index",          "INTEGER DEFAULT 1"),
            ("parent_session_id",   "TEXT"),
            ("parent_frame_index",  "INTEGER"),
            ("prompt_tokens",       "INTEGER DEFAULT 0"),
            ("completion_tokens",   "INTEGER DEFAULT 0"),
            ("total_tokens",        "INTEGER DEFAULT 0"),
            ("model_name",          "TEXT"),
            ("user_id",             "TEXT"),
        ]:
            try:
                conn.execute(f"ALTER TABLE sessions ADD COLUMN {col} {typedef}")
            except Exception:
                pass

        for col, typedef in [
            ("merged_video_path", "TEXT"),
            ("user_id",           "TEXT"),
        ]:
            try:
                conn.execute(f"ALTER TABLE conversations ADD COLUMN {col} {typedef}")
            except Exception:
                pass

        # Password auth columns on users
        for col, typedef in [
            ("password_hash", "TEXT"),
            ("auth_provider", "TEXT DEFAULT 'google'"),
        ]:
            try:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col} {typedef}")
            except Exception:
                pass

        conn.commit()


# ── Helpers ───────────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def session_output_dir(session_id: str) -> str:
    """Return (and create if needed) the output directory for a session."""
    path = OUTPUTS_DIR / session_id
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


# ── Conversation writes ───────────────────────────────────────────────────────

def insert_conversation(conv_id: str, title: str, user_id: Optional[str] = None) -> None:
    ts = now_iso()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?)",
            (conv_id, title, ts, ts, user_id),
        )
        conn.commit()


def touch_conversation(conv_id: str) -> None:
    with get_db() as conn:
        conn.execute(
            "UPDATE conversations SET updated_at = ? WHERE id = ?",
            (now_iso(), conv_id),
        )
        conn.commit()


# ── Session writes ────────────────────────────────────────────────────────────

def insert_session(
    session_id:         str,
    prompt:             str,
    conversation_id:    Optional[str] = None,
    turn_index:         int           = 1,
    parent_session_id:  Optional[str] = None,
    parent_frame_index: Optional[int] = None,
    user_id:            Optional[str] = None,
) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT INTO sessions "
            "(id, prompt, created_at, status, conversation_id, turn_index, "
            "parent_session_id, parent_frame_index, user_id) "
            "VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)",
            (session_id, prompt, now_iso(), conversation_id, turn_index,
             parent_session_id, parent_frame_index, user_id),
        )
        conn.commit()


def update_session(session_id: str, **fields) -> None:
    if not fields:
        return
    sets = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [session_id]
    with get_db() as conn:
        conn.execute(f"UPDATE sessions SET {sets} WHERE id = ?", values)
        conn.commit()


# ── Auth helpers ──────────────────────────────────────────────────────────────

def upsert_user(user: User) -> None:
    """Insert or update a user row (keyed on Google sub)."""
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO users (id, email, name, avatar, created_at, last_login)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                email      = excluded.email,
                name       = excluded.name,
                avatar     = excluded.avatar,
                last_login = excluded.last_login
            """,
            (user.id, user.email, user.name, user.avatar, user.created_at, user.last_login),
        )
        conn.commit()


def get_user_by_id(user_id: str) -> Optional[User]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        return None
    return User(**dict(row))


def create_refresh_token(user_id: str) -> str:
    """Insert a new refresh token and return the token string."""
    token      = uuid.uuid4().hex
    ts         = now_iso()
    expires_at = (
        datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")
    with get_db() as conn:
        conn.execute(
            "INSERT INTO refresh_tokens (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (token, user_id, expires_at, ts),
        )
        conn.commit()
    return token


def rotate_refresh_token(old_token: str) -> Optional[tuple[str, str]]:
    """
    Atomically replace old_token with a new one.

    Returns (new_token, user_id) on success, or None if old_token was not found
    (indicates token theft — caller should force logout).
    """
    with get_db() as conn:
        row = conn.execute(
            "SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?", (old_token,)
        ).fetchone()
        if not row:
            return None

        # Delete old token
        conn.execute("DELETE FROM refresh_tokens WHERE token = ?", (old_token,))

        # Issue new token
        new_token  = uuid.uuid4().hex
        expires_at = (
            datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        ).strftime("%Y-%m-%dT%H:%M:%SZ")
        conn.execute(
            "INSERT INTO refresh_tokens (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (new_token, row["user_id"], expires_at, now_iso()),
        )
        conn.commit()

    return new_token, row["user_id"]


def delete_refresh_token(token: str) -> None:
    with get_db() as conn:
        conn.execute("DELETE FROM refresh_tokens WHERE token = ?", (token,))
        conn.commit()


def delete_user_refresh_tokens(user_id: str) -> None:
    """Log out from all devices."""
    with get_db() as conn:
        conn.execute("DELETE FROM refresh_tokens WHERE user_id = ?", (user_id,))
        conn.commit()


def get_user_by_email(email: str) -> Optional[User]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not row:
        return None
    return User(**dict(row))


def create_password_user(user_id: str, name: str, email: str, password_hash: str) -> User:
    """Insert a new user registered with email + password."""
    ts = now_iso()
    user = User(
        id=user_id,
        email=email,
        name=name,
        avatar="",
        created_at=ts,
        last_login=ts,
        password_hash=password_hash,
        auth_provider="password",
    )
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO users (id, email, name, avatar, created_at, last_login, password_hash, auth_provider)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user.id, user.email, user.name, user.avatar,
             user.created_at, user.last_login, user.password_hash, user.auth_provider),
        )
        conn.commit()
    return user


def get_user_password_hash(email: str) -> Optional[str]:
    """Return the stored password hash for an email, or None if not found."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT password_hash FROM users WHERE email = ?", (email,)
        ).fetchone()
    if not row:
        return None
    return row["password_hash"]
