"""Initial schema snapshot — baseline for Alembic migrations.

This revision captures the state of the database when Alembic was introduced.
All CREATE statements use IF NOT EXISTS so it is safe to run against an existing
database. A fresh database will have the full schema created here.

Revision ID: 001
Revises:
Create Date: 2026-05-24
"""

from alembic import op

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
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

    op.execute("""
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            token      TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    op.execute("""
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

    op.execute("""
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
            user_id            TEXT,
            research_mode      TEXT DEFAULT 'instant',
            sources_json       TEXT,
            stages_json        TEXT,
            synthesis_text     TEXT
        )
    """)

    op.execute("""
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

    # Indexes — all IF NOT EXISTS so safe on existing databases
    op.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_id         ON sessions(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sessions_conversation_id  ON sessions(conversation_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sessions_status           ON sessions(status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sessions_created_at       ON sessions(created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_conversations_user_id     ON conversations(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_conversations_updated_at  ON conversations(updated_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id    ON refresh_tokens(user_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_conversations_deleted "
        "ON conversations(deleted_at) WHERE deleted_at IS NOT NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_conv_turn_user "
        "ON sessions(conversation_id, turn_index, user_id) "
        "WHERE conversation_id IS NOT NULL"
    )


def downgrade() -> None:
    # Drop in reverse dependency order
    op.execute("DROP TABLE IF EXISTS conversation_notes")
    op.execute("DROP TABLE IF EXISTS sessions")
    op.execute("DROP TABLE IF EXISTS conversations")
    op.execute("DROP TABLE IF EXISTS refresh_tokens")
    op.execute("DROP TABLE IF EXISTS users")
