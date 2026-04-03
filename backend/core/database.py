"""
Database layer — SQLite helpers shared across all routers.

All direct sqlite3 usage is confined to this module.
"""

import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from core.config import DB_PATH, OUTPUTS_DIR

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
        ]:
            try:
                conn.execute(f"ALTER TABLE sessions ADD COLUMN {col} {typedef}")
            except Exception:
                pass

        for col, typedef in [
            ("merged_video_path", "TEXT"),
        ]:
            try:
                conn.execute(f"ALTER TABLE conversations ADD COLUMN {col} {typedef}")
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

def insert_conversation(conv_id: str, title: str) -> None:
    ts = now_iso()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (conv_id, title, ts, ts),
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
) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT INTO sessions "
            "(id, prompt, created_at, status, conversation_id, turn_index, "
            "parent_session_id, parent_frame_index) "
            "VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)",
            (session_id, prompt, now_iso(), conversation_id, turn_index,
             parent_session_id, parent_frame_index),
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
