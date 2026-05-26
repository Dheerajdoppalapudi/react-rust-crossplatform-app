"""Schema improvements: JSONB columns, BOOLEAN starred, turn_count, FK constraints, indexes.

Changes:
  1. sessions.sources_json  TEXT  → JSONB
  2. sessions.stages_json   TEXT  → JSONB
  3. conversations.starred  INTEGER → BOOLEAN
  4. conversations.turn_count  ADD COLUMN INTEGER DEFAULT 0, backfilled from sessions
  5. FK: sessions.conversation_id → conversations.id ON DELETE SET NULL
  6. FK: sessions.user_id         → users.id          ON DELETE CASCADE
  7. New indexes:
       idx_sessions_user_created  ON sessions(user_id, created_at DESC)
       idx_sessions_parent        ON sessions(parent_session_id)
       idx_refresh_expires        ON refresh_tokens(expires_at)

Deployment order (CRITICAL):
  1. Run `alembic upgrade head` BEFORE deploying new app code.
  2. New code omits json.dumps() for sources_json / stages_json — it passes raw
     Python objects; asyncpg's JSONB codec serialises them automatically.
  3. Never deploy new code against an un-migrated DB.

Revision ID: 003
Revises: 002
Create Date: 2026-05-25
"""

from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1 & 2. TEXT → JSONB for JSON columns
    # NULL values pass through unchanged; valid JSON strings cast cleanly.
    op.execute(
        "ALTER TABLE sessions "
        "ALTER COLUMN sources_json TYPE JSONB "
        "USING CASE WHEN sources_json IS NULL THEN NULL "
        "           ELSE sources_json::jsonb END"
    )
    op.execute(
        "ALTER TABLE sessions "
        "ALTER COLUMN stages_json TYPE JSONB "
        "USING CASE WHEN stages_json IS NULL THEN NULL "
        "           ELSE stages_json::jsonb END"
    )

    # 3. starred INTEGER → BOOLEAN (0 → false, non-zero → true)
    # Drop the integer default first — PostgreSQL cannot auto-cast DEFAULT 0 → boolean.
    op.execute(
        "ALTER TABLE conversations ALTER COLUMN starred DROP DEFAULT"
    )
    op.execute(
        "ALTER TABLE conversations "
        "ALTER COLUMN starred TYPE BOOLEAN "
        "USING COALESCE(starred != 0, false)"
    )
    op.execute(
        "ALTER TABLE conversations ALTER COLUMN starred SET DEFAULT false"
    )

    # 4. turn_count column + backfill from done sessions
    op.execute(
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS turn_count INTEGER DEFAULT 0"
    )
    op.execute("""
        UPDATE conversations c
        SET turn_count = (
            SELECT COUNT(*)
            FROM sessions s
            WHERE s.conversation_id = c.id
              AND s.status = 'done'
        )
    """)

    # 5 & 6. FK constraints (nullable columns — NULLs are exempt from FK checks)
    op.execute(
        "ALTER TABLE sessions ADD CONSTRAINT fk_sessions_conversation "
        "FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL"
        " NOT VALID"
    )
    op.execute(
        "ALTER TABLE sessions VALIDATE CONSTRAINT fk_sessions_conversation"
    )
    op.execute(
        "ALTER TABLE sessions ADD CONSTRAINT fk_sessions_user "
        "FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
        " NOT VALID"
    )
    op.execute(
        "ALTER TABLE sessions VALIDATE CONSTRAINT fk_sessions_user"
    )

    # 7. New indexes
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_sessions_user_created "
        "ON sessions(user_id, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_sessions_parent "
        "ON sessions(parent_session_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_refresh_expires "
        "ON refresh_tokens(expires_at)"
    )


def downgrade() -> None:
    # Drop new indexes
    op.execute("DROP INDEX IF EXISTS idx_sessions_user_created")
    op.execute("DROP INDEX IF EXISTS idx_sessions_parent")
    op.execute("DROP INDEX IF EXISTS idx_refresh_expires")

    # Drop FK constraints
    op.execute(
        "ALTER TABLE sessions DROP CONSTRAINT IF EXISTS fk_sessions_conversation"
    )
    op.execute(
        "ALTER TABLE sessions DROP CONSTRAINT IF EXISTS fk_sessions_user"
    )

    # Drop turn_count
    op.execute(
        "ALTER TABLE conversations DROP COLUMN IF EXISTS turn_count"
    )

    # BOOLEAN → INTEGER
    op.execute(
        "ALTER TABLE conversations ALTER COLUMN starred DROP DEFAULT"
    )
    op.execute(
        "ALTER TABLE conversations "
        "ALTER COLUMN starred TYPE INTEGER "
        "USING CASE WHEN starred THEN 1 ELSE 0 END"
    )
    op.execute(
        "ALTER TABLE conversations ALTER COLUMN starred SET DEFAULT 0"
    )

    # JSONB → TEXT
    op.execute(
        "ALTER TABLE sessions "
        "ALTER COLUMN sources_json TYPE TEXT "
        "USING CASE WHEN sources_json IS NULL THEN NULL "
        "           ELSE sources_json::text END"
    )
    op.execute(
        "ALTER TABLE sessions "
        "ALTER COLUMN stages_json TYPE TEXT "
        "USING CASE WHEN stages_json IS NULL THEN NULL "
        "           ELSE stages_json::text END"
    )
