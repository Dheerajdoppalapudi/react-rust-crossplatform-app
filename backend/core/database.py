"""
Database layer — SQLite helpers shared across all routers.

All direct sqlite3 usage is confined to this module.

Fixes applied:
  CRIT-5 : update_session() whitelists allowed column names — no SQL injection surface.
  HIGH-9  : CREATE INDEX statements added in init_db() for hot query columns.
  M-4     : Migrations tracked in a schema_version table; ALTER TABLE runs are idempotent
            via version gating rather than bare except-pass.
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


# ── Allowed columns for update_session (CRIT-5) ───────────────────────────────

_ALLOWED_SESSION_COLUMNS: frozenset[str] = frozenset({
    "status",
    "intent_type",
    "render_path",
    "frame_count",
    "output_dir",
    "ui_output_file",
    "api_call_count",
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
    "model_name",
    "video_path",
    "merged_video_path",
    "research_mode",
    "sources_json",
    "stages_json",
})


# ── Connection ────────────────────────────────────────────────────────────────

def get_db() -> sqlite3.Connection:
    """
    Open a SQLite connection with production-safe pragmas:
      - WAL mode: readers never block writers; reduces lock contention.
      - busy_timeout: wait up to 5 s before raising OperationalError on lock.
      - foreign_keys: enforce FK constraints.
    """
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# ── Migration helpers (M-4) ───────────────────────────────────────────────────

def _current_schema_version(conn: sqlite3.Connection) -> int:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)"
    )
    row = conn.execute("SELECT MAX(version) AS v FROM schema_version").fetchone()
    return row["v"] if row["v"] is not None else 0


def _apply_migration(conn: sqlite3.Connection, version: int, sql: str) -> None:
    """Run sql and record the version. Idempotent — skipped if already applied."""
    conn.execute(sql)
    conn.execute("INSERT INTO schema_version (version) VALUES (?)", (version,))
    logger.info("schema_migration_applied  version=%d", version)


# ── Schema + migrations ───────────────────────────────────────────────────────

def init_db() -> None:
    """
    Create tables, run incremental migrations, and ensure indexes exist.

    Migrations are tracked in `schema_version`. Each migration is applied
    exactly once, in order, and only if the DB is below the required version.
    Adding a new migration: append to _MIGRATIONS with the next integer key.
    """
    with get_db() as conn:
        # ── Core tables ───────────────────────────────────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY,
                email         TEXT UNIQUE NOT NULL,
                name          TEXT,
                avatar        TEXT,
                created_at    TEXT NOT NULL,
                last_login    TEXT NOT NULL,
                password_hash TEXT,
                auth_provider TEXT DEFAULT 'google'
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
                merged_video_path TEXT,
                user_id           TEXT,
                starred           INTEGER DEFAULT 0,
                deleted_at        TEXT
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
                parent_frame_index INTEGER,
                user_id            TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS conversation_notes (
                conversation_id  TEXT NOT NULL,
                user_id          TEXT NOT NULL,
                content          TEXT NOT NULL DEFAULT '{}',
                updated_at       TEXT NOT NULL,
                PRIMARY KEY (conversation_id, user_id),
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
            )
        """)

        # ── Incremental migrations (M-4) ──────────────────────────────────────
        # Each entry: (version_int, sql_statement)
        # New migrations go at the bottom with the next integer.
        _MIGRATIONS: list[tuple[int, str]] = [
            # v1–v9: legacy columns now included in CREATE TABLE above.
            # Kept as no-ops for databases that were created before the schema
            # was consolidated; the version table ensures they only run once.
            (1,  "SELECT 1"),  # video_path on sessions
            (2,  "SELECT 1"),  # conversation_id on sessions
            (3,  "SELECT 1"),  # turn_index on sessions
            (4,  "SELECT 1"),  # parent_* on sessions
            (5,  "SELECT 1"),  # token columns on sessions
            (6,  "SELECT 1"),  # model_name on sessions
            (7,  "SELECT 1"),  # user_id on sessions
            (8,  "SELECT 1"),  # merged_video_path, user_id, starred, deleted_at on conversations
            (9,  "SELECT 1"),  # password_hash, auth_provider on users
            (10, "SELECT 1"),  # previously used for a different column
            (11, "SELECT 1"),  # previously used for a different column
            (12, "ALTER TABLE sessions ADD COLUMN research_mode TEXT DEFAULT 'instant'"),
            (13, "ALTER TABLE sessions ADD COLUMN sources_json TEXT"),
            (14, "ALTER TABLE sessions ADD COLUMN stages_json TEXT"),
        ]

        current = _current_schema_version(conn)
        for version, sql in _MIGRATIONS:
            if version > current:
                _apply_migration(conn, version, sql)

        # ── Indexes (HIGH-9) ──────────────────────────────────────────────────
        # IF NOT EXISTS makes these idempotent — safe to run on every startup.
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_user_id "
            "ON sessions(user_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_conversation_id "
            "ON sessions(conversation_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_conversations_user_id "
            "ON conversations(user_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_conversations_updated_at "
            "ON conversations(updated_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id "
            "ON refresh_tokens(user_id)"
        )

        conn.commit()
    logger.info("database_initialised  path=%s", DB_PATH)


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


# ── Conversation mutation helpers ─────────────────────────────────────────────

def rename_conversation(conv_id: str, user_id: str, new_title: str) -> bool:
    """Rename a conversation. Returns True if a row was updated."""
    with get_db() as conn:
        cur = conn.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
            (new_title, now_iso(), conv_id, user_id),
        )
        conn.commit()
    return cur.rowcount > 0


def toggle_star_conversation(conv_id: str, user_id: str) -> Optional[bool]:
    """Toggle starred state. Returns the new starred bool, or None if not found."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT starred FROM conversations WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
            (conv_id, user_id),
        ).fetchone()
        if not row:
            return None
        new_val = 0 if row["starred"] else 1
        conn.execute(
            "UPDATE conversations SET starred = ? WHERE id = ? AND user_id = ?",
            (new_val, conv_id, user_id),
        )
        conn.commit()
    return bool(new_val)


def soft_delete_conversation(conv_id: str, user_id: str) -> bool:
    """Soft-delete a conversation. Returns True if a row was updated."""
    with get_db() as conn:
        cur = conn.execute(
            "UPDATE conversations SET deleted_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
            (now_iso(), conv_id, user_id),
        )
        conn.commit()
    return cur.rowcount > 0


# ── User notes helpers ────────────────────────────────────────────────────────

def get_conversation_notes(conversation_id: str, user_id: str) -> Optional[dict]:
    """Return the user's notes for a conversation, or None if none exist yet."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT content, updated_at FROM conversation_notes "
            "WHERE conversation_id = ? AND user_id = ?",
            (conversation_id, user_id),
        ).fetchone()
    if not row:
        return None
    return {"content": row["content"], "updated_at": row["updated_at"]}


def upsert_conversation_notes(conversation_id: str, user_id: str, content: str) -> str:
    """Insert or update the user's notes for a conversation. Returns the updated_at timestamp."""
    ts = now_iso()
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO conversation_notes (conversation_id, user_id, content, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(conversation_id, user_id) DO UPDATE SET
                content    = excluded.content,
                updated_at = excluded.updated_at
            """,
            (conversation_id, user_id, content, ts),
        )
        conn.commit()
    return ts


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
    """
    Update arbitrary columns on a session row.

    CRIT-5: Column names are validated against an explicit whitelist before
    being interpolated into the SQL string. Values are always parameterized.
    """
    if not fields:
        return

    invalid = set(fields.keys()) - _ALLOWED_SESSION_COLUMNS
    if invalid:
        raise ValueError(
            f"update_session() received disallowed column(s): {invalid}. "
            f"Allowed columns: {_ALLOWED_SESSION_COLUMNS}"
        )

    sets   = ", ".join(f"{k} = ?" for k in fields)
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

        conn.execute("DELETE FROM refresh_tokens WHERE token = ?", (old_token,))

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
