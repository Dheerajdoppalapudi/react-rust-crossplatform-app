"""
Async database layer — asyncpg-backed pool and all query helpers.

Single source of truth for all database access. psycopg2 is gone; this
module owns the pool, schema init, all query helpers, and the session
filesystem helper (session_output_dir).

Placeholder style: asyncpg uses PostgreSQL-native $1, $2, $3 positional args.

Usage:
    from core.db_async import get_async_db, insert_session, update_session, ...

    async with get_async_db() as conn:
        row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", sid)

    # Or use the named helpers directly — they manage their own connection:
    await update_session(session_id, status="done", render_path="svg")
"""

import json
import uuid
import structlog
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

import asyncpg

from core.config import DATABASE_URL, MAX_REFRESH_TOKENS_PER_USER, OUTPUTS_DIR, REFRESH_TOKEN_EXPIRE_DAYS
from core.db_models import User

logger = structlog.get_logger(__name__)

# ── Pool singleton ─────────────────────────────────────────────────────────────

_pool: Optional[asyncpg.Pool] = None


def _encode_jsonb(value):
    return json.dumps(value)

def _decode_jsonb(value):
    return json.loads(value)

async def _init_connection(conn) -> None:
    """Register Python ↔ PostgreSQL JSONB codec on every new pool connection."""
    await conn.set_type_codec(
        "jsonb",
        encoder=_encode_jsonb,
        decoder=_decode_jsonb,
        schema="pg_catalog",
        format="text",
    )

async def init_pool() -> None:
    global _pool
    _pool = await asyncpg.create_pool(
        DATABASE_URL,
        min_size=3,
        max_size=50,
        command_timeout=30,
        statement_cache_size=100,
        max_inactive_connection_lifetime=240,
        init=_init_connection,
    )
    logger.info("asyncpg_pool_created", min_size=3, max_size=50)


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        logger.info("asyncpg_pool_closed")


def _get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("asyncpg pool not initialised — call init_pool() first")
    return _pool


# ── Connection context manager ─────────────────────────────────────────────────

@asynccontextmanager
async def get_async_db():
    """
    Yield an asyncpg Connection inside an implicit transaction.
    Use for any endpoint that writes to the DB (INSERT/UPDATE/DELETE).
    Commits on success, rolls back on any exception, returns connection to pool.
    """
    async with _get_pool().acquire(timeout=5.0) as conn:
        async with conn.transaction():
            yield conn


@asynccontextmanager
async def get_async_db_read():
    """
    Yield an asyncpg Connection WITHOUT a transaction — for SELECT-only endpoints.

    Skipping BEGIN/COMMIT saves 2 RTTs (~700ms at India→us-east-1 latency)
    per call vs get_async_db(). Never use this for writes.
    """
    async with _get_pool().acquire(timeout=5.0) as conn:
        yield conn


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Allowed columns for update_session ───────────────────────────────────────

_ALLOWED_SESSION_COLUMNS: frozenset[str] = frozenset({
    "status", "intent_type", "render_path", "frame_count", "output_dir",
    "ui_output_file", "api_call_count", "prompt_tokens", "completion_tokens",
    "total_tokens", "model_name", "video_path", "merged_video_path",
    "research_mode", "sources_json", "stages_json", "synthesis_text",
    "frames_meta",
})


# ── Conversation writes ───────────────────────────────────────────────────────

async def insert_conversation(
    conv_id: str, title: str, user_id: Optional[str] = None
) -> None:
    ts = _now()
    async with get_async_db() as conn:
        await conn.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at, user_id) "
            "VALUES ($1, $2, $3, $4, $5)",
            conv_id, title, ts, ts, user_id,
        )


async def touch_conversation(conv_id: str) -> None:
    async with get_async_db() as conn:
        await conn.execute(
            "UPDATE conversations SET updated_at = $1 WHERE id = $2",
            _now(), conv_id,
        )


async def rename_conversation(conv_id: str, user_id: str, new_title: str) -> bool:
    async with get_async_db() as conn:
        result = await conn.execute(
            "UPDATE conversations SET title = $1, updated_at = $2 "
            "WHERE id = $3 AND user_id = $4 AND deleted_at IS NULL",
            new_title, _now(), conv_id, user_id,
        )
    return result == "UPDATE 1"


async def toggle_star_conversation(conv_id: str, user_id: str) -> Optional[bool]:
    """Atomic toggle — fixes the TOCTOU SELECT+UPDATE race of the old sync version."""
    async with get_async_db() as conn:
        row = await conn.fetchrow(
            "UPDATE conversations "
            "SET starred = 1 - COALESCE(starred, 0), updated_at = $1 "
            "WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL "
            "RETURNING starred",
            _now(), conv_id, user_id,
        )
    if row is None:
        return None
    return bool(row["starred"])


async def soft_delete_conversation(conv_id: str, user_id: str) -> bool:
    async with get_async_db() as conn:
        result = await conn.execute(
            "UPDATE conversations SET deleted_at = $1 "
            "WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL",
            _now(), conv_id, user_id,
        )
    return result == "UPDATE 1"


# ── Conversation notes ─────────────────────────────────────────────────────────

async def get_conversation_notes(
    conversation_id: str, user_id: str
) -> Optional[dict]:
    async with get_async_db() as conn:
        row = await conn.fetchrow(
            "SELECT content, updated_at FROM conversation_notes "
            "WHERE conversation_id = $1 AND user_id = $2",
            conversation_id, user_id,
        )
    if not row:
        return None
    return {"content": row["content"], "updated_at": row["updated_at"]}


async def upsert_conversation_notes(
    conversation_id: str, user_id: str, content: str
) -> str:
    ts = _now()
    async with get_async_db() as conn:
        await conn.execute(
            "INSERT INTO conversation_notes (conversation_id, user_id, content, updated_at) "
            "VALUES ($1, $2, $3, $4) "
            "ON CONFLICT (conversation_id, user_id) DO UPDATE SET "
            "content = EXCLUDED.content, updated_at = EXCLUDED.updated_at",
            conversation_id, user_id, content, ts,
        )
    return ts.isoformat()


# ── Session writes ─────────────────────────────────────────────────────────────

async def insert_session(
    session_id:         str,
    prompt:             str,
    conversation_id:    Optional[str] = None,
    turn_index:         Optional[int] = None,
    parent_session_id:  Optional[str] = None,
    parent_frame_index: Optional[int] = None,
    user_id:            Optional[str] = None,
) -> int:
    """Insert a new session and return the assigned turn_index."""
    ts = _now()
    async with get_async_db() as conn:
        if turn_index is not None:
            await conn.execute(
                "INSERT INTO sessions "
                "(id, prompt, created_at, status, conversation_id, turn_index, "
                "parent_session_id, parent_frame_index, user_id) "
                "VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8)",
                session_id, prompt, ts, conversation_id, turn_index,
                parent_session_id, parent_frame_index, user_id,
            )
        else:
            row = await conn.fetchrow(
                "INSERT INTO sessions "
                "(id, prompt, created_at, status, conversation_id, turn_index, "
                "parent_session_id, parent_frame_index, user_id) "
                "VALUES ($1, $2, $3, 'pending', $4, "
                "COALESCE((SELECT MAX(turn_index) FROM sessions "
                "          WHERE conversation_id = $5 AND user_id = $6), 0) + 1, "
                "$7, $8, $9) RETURNING turn_index",
                session_id, prompt, ts, conversation_id,
                conversation_id, user_id,
                parent_session_id, parent_frame_index, user_id,
            )
            turn_index = row["turn_index"] if row else 1
    return turn_index or 1


async def update_session(session_id: str, **fields) -> None:
    """
    Update arbitrary columns on a session row.
    Column names are validated against an explicit allowlist before interpolation.
    """
    if not fields:
        return
    invalid = set(fields.keys()) - _ALLOWED_SESSION_COLUMNS
    if invalid:
        raise ValueError(
            f"update_session() received disallowed column(s): {invalid}. "
            f"Allowed: {_ALLOWED_SESSION_COLUMNS}"
        )
    cols = list(fields.keys())
    vals = list(fields.values())
    sets = ", ".join(f"{col} = ${i + 1}" for i, col in enumerate(cols))
    query = f"UPDATE sessions SET {sets} WHERE id = ${len(cols) + 1}"
    async with get_async_db() as conn:
        await conn.execute(query, *vals, session_id)


# ── Auth helpers ───────────────────────────────────────────────────────────────

async def upsert_user(user: User) -> None:
    async with get_async_db() as conn:
        await conn.execute(
            "INSERT INTO users (id, email, name, avatar, created_at, last_login) "
            "VALUES ($1, $2, $3, $4, $5, $6) "
            "ON CONFLICT (id) DO UPDATE SET "
            "email = EXCLUDED.email, name = EXCLUDED.name, "
            "avatar = EXCLUDED.avatar, last_login = EXCLUDED.last_login",
            user.id, user.email, user.name, user.avatar,
            user.created_at, user.last_login,
        )


async def get_user_by_id(user_id: str) -> Optional[User]:
    async with get_async_db() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM users WHERE id = $1", user_id
        )
    if not row:
        return None
    return User(**dict(row))


async def get_user_by_email(email: str) -> Optional[User]:
    async with get_async_db() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM users WHERE email = $1", email
        )
    if not row:
        return None
    return User(**dict(row))


async def get_user_password_hash(email: str) -> Optional[str]:
    async with get_async_db() as conn:
        row = await conn.fetchrow(
            "SELECT password_hash FROM users WHERE email = $1", email
        )
    if not row:
        return None
    return row["password_hash"]


async def create_password_user(
    user_id: str, name: str, email: str, password_hash: str
) -> User:
    ts = _now()
    user = User(
        id=user_id, email=email, name=name, avatar="",
        created_at=ts, last_login=ts,
        password_hash=password_hash, auth_provider="password",
    )
    async with get_async_db() as conn:
        await conn.execute(
            "INSERT INTO users "
            "(id, email, name, avatar, created_at, last_login, password_hash, auth_provider) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            user.id, user.email, user.name, user.avatar,
            user.created_at, user.last_login, user.password_hash, user.auth_provider,
        )
    return user


async def create_refresh_token(user_id: str) -> str:
    token      = uuid.uuid4().hex
    now        = _now()
    expires_at = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    async with get_async_db() as conn:
        await conn.execute(
            "INSERT INTO refresh_tokens (token, user_id, expires_at, created_at) "
            "VALUES ($1, $2, $3, $4)",
            token, user_id, expires_at, now,
        )
        # Prune oldest tokens beyond limit — prevents unbounded growth per user.
        await conn.execute(
            "DELETE FROM refresh_tokens WHERE user_id = $1 AND token NOT IN ("
            "  SELECT token FROM refresh_tokens WHERE user_id = $1 "
            "  ORDER BY created_at DESC LIMIT $2"
            ")",
            user_id, MAX_REFRESH_TOKENS_PER_USER,
        )
    return token


async def rotate_refresh_token(old_token: str) -> Optional[tuple[str, str]]:
    """
    Atomically delete old_token and insert a new one.
    Returns (new_token, user_id) on success, None if token is missing/expired.
    All inside a single transaction — no race window.
    """
    now        = _now()
    new_token  = uuid.uuid4().hex
    expires_at = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    async with get_async_db() as conn:
        row = await conn.fetchrow(
            "DELETE FROM refresh_tokens "
            "WHERE token = $1 AND expires_at > $2 RETURNING user_id",
            old_token, now,
        )
        if not row:
            return None
        await conn.execute(
            "INSERT INTO refresh_tokens (token, user_id, expires_at, created_at) "
            "VALUES ($1, $2, $3, $4)",
            new_token, row["user_id"], expires_at, now,
        )
    return new_token, row["user_id"]


async def delete_refresh_token(token: str) -> None:
    async with get_async_db() as conn:
        await conn.execute(
            "DELETE FROM refresh_tokens WHERE token = $1", token
        )


async def delete_user_refresh_tokens(user_id: str) -> None:
    async with get_async_db() as conn:
        await conn.execute(
            "DELETE FROM refresh_tokens WHERE user_id = $1", user_id
        )


# ── Filesystem helpers ─────────────────────────────────────────────────────────

def session_output_dir(session_id: str) -> str:
    """Return (and create if needed) the local output directory for a session."""
    path = OUTPUTS_DIR / session_id
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


# ── Context builder helpers ────────────────────────────────────────────────────

async def collect_ancestor_chain(
    parent_session_id: Optional[str],
    limit: int,
) -> list:
    """Fetch the ancestor chain in one asyncpg round-trip using a recursive CTE."""
    if not parent_session_id:
        return []

    async with get_async_db() as conn:
        rows = await conn.fetch(
            """
            WITH RECURSIVE chain AS (
                SELECT id, prompt, turn_index, output_dir, parent_session_id,
                       synthesis_text, 1 AS depth
                FROM sessions
                WHERE id = $1 AND status = 'done'

                UNION ALL

                SELECT s.id, s.prompt, s.turn_index, s.output_dir,
                       s.parent_session_id, s.synthesis_text, c.depth + 1
                FROM sessions s
                JOIN chain c ON s.id = c.parent_session_id
                WHERE s.status = 'done' AND c.depth < $2
            )
            SELECT id, prompt, turn_index, output_dir, parent_session_id, synthesis_text
            FROM chain
            ORDER BY turn_index ASC
            """,
            parent_session_id, limit,
        )
    return list(rows)


# ── Schema init ────────────────────────────────────────────────────────────────

async def init_db() -> None:
    """
    Create all tables and indexes if they don't exist.
    Safe to call on every startup — all statements use IF NOT EXISTS.

    All DDL is batched into a single conn.execute() call so startup only
    pays 1 round-trip to RDS instead of 14 (saves ~4.5s at India→us-east-1 latency).
    """
    async with get_async_db() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY,
                email         TEXT UNIQUE NOT NULL,
                name          TEXT,
                avatar        TEXT,
                created_at    TIMESTAMPTZ NOT NULL,
                last_login    TIMESTAMPTZ NOT NULL,
                password_hash TEXT,
                auth_provider TEXT DEFAULT 'google'
            );

            CREATE TABLE IF NOT EXISTS refresh_tokens (
                token      TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id                TEXT PRIMARY KEY,
                title             TEXT NOT NULL,
                created_at        TIMESTAMPTZ NOT NULL,
                updated_at        TIMESTAMPTZ NOT NULL,
                merged_video_path TEXT,
                user_id           TEXT,
                starred           INTEGER DEFAULT 0,
                deleted_at        TIMESTAMPTZ
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id                 TEXT PRIMARY KEY,
                prompt             TEXT NOT NULL,
                created_at         TIMESTAMPTZ NOT NULL,
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
                user_id            TEXT,
                research_mode      TEXT DEFAULT 'instant',
                sources_json       TEXT,
                stages_json        TEXT,
                synthesis_text     TEXT,
                frames_meta        JSONB
            );

            -- Idempotent column addition for databases created before frames_meta existed.
            ALTER TABLE sessions ADD COLUMN IF NOT EXISTS frames_meta JSONB;

            CREATE TABLE IF NOT EXISTS conversation_notes (
                conversation_id  TEXT NOT NULL,
                user_id          TEXT NOT NULL,
                content          TEXT NOT NULL DEFAULT '{}',
                updated_at       TIMESTAMPTZ NOT NULL,
                PRIMARY KEY (conversation_id, user_id),
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_user_id          ON sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_conversation_id  ON sessions(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_conversations_user_id     ON conversations(user_id);
            CREATE INDEX IF NOT EXISTS idx_conversations_updated_at  ON conversations(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id    ON refresh_tokens(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_status           ON sessions(status);
            CREATE INDEX IF NOT EXISTS idx_sessions_created_at       ON sessions(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_conversations_deleted
                ON conversations(deleted_at) WHERE deleted_at IS NOT NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_conv_turn_user
                ON sessions(conversation_id, turn_index, user_id)
                WHERE conversation_id IS NOT NULL;
        """)

    logger.info("database_initialised", backend="asyncpg")


# ── Maintenance helpers ────────────────────────────────────────────────────────

async def mark_stale_pending_sessions(older_than_minutes: int = 10) -> int:
    """
    Mark sessions stuck in 'pending' for longer than `older_than_minutes` as 'error'.

    Called once on startup so that sessions orphaned by a previous crash or
    pod restart don't stay in 'pending' forever. Returns the number of rows updated.
    """
    threshold = datetime.now(timezone.utc) - timedelta(minutes=older_than_minutes)
    async with get_async_db() as conn:
        result = await conn.execute(
            "UPDATE sessions SET status = 'error' "
            "WHERE status = 'pending' AND created_at < $1",
            threshold,
        )
    # asyncpg returns a status string like "UPDATE 3"
    try:
        return int(result.split()[-1])
    except (ValueError, IndexError):
        return 0
