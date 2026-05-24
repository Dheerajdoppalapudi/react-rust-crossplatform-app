"""Migrate all TEXT timestamp columns to TIMESTAMPTZ.

ISO-8601 UTC strings stored as TEXT cast cleanly to TIMESTAMPTZ via the
PostgreSQL `::timestamptz` operator. No data is lost; the DB gains native
date arithmetic, proper indexing, and correct timezone semantics.

Deployment order (CRITICAL):
  1. Run this migration BEFORE deploying the new app code.
  2. `alembic upgrade head` converts existing TEXT values to TIMESTAMPTZ.
  3. Then deploy app code — which now passes datetime objects, not strings.

Revision ID: 002
Revises: 001
Create Date: 2026-05-25
"""

from alembic import op

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None

# (table, [columns_to_convert]) — all nullable columns are handled by the
# USING cast; non-nullable ones are also safe because _now() always produced
# valid ISO-8601 UTC strings.
_TIMESTAMP_COLUMNS: list[tuple[str, list[str]]] = [
    ("users",              ["created_at", "last_login"]),
    ("refresh_tokens",     ["expires_at", "created_at"]),
    ("conversations",      ["created_at", "updated_at", "deleted_at"]),
    ("sessions",           ["created_at"]),
    ("conversation_notes", ["updated_at"]),
]


def upgrade() -> None:
    for table, columns in _TIMESTAMP_COLUMNS:
        for col in columns:
            # USING cast: empty string '' would raise — but _now() never
            # produced an empty string, so this is safe on real data.
            op.execute(
                f"ALTER TABLE {table} "
                f"ALTER COLUMN {col} TYPE TIMESTAMPTZ "
                f"USING {col}::timestamptz"
            )

    # Rebuild the partial index on conversations.deleted_at — partial indexes
    # referencing a type-changed column must be dropped and recreated explicitly.
    # (Regular indexes are rebuilt automatically by ALTER TABLE … ALTER COLUMN TYPE.)
    op.execute("DROP INDEX IF EXISTS idx_conversations_deleted")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_conversations_deleted "
        "ON conversations(deleted_at) WHERE deleted_at IS NOT NULL"
    )


def downgrade() -> None:
    for table, columns in _TIMESTAMP_COLUMNS:
        for col in columns:
            op.execute(
                f"ALTER TABLE {table} "
                f"ALTER COLUMN {col} TYPE TEXT "
                f"USING to_char({col} AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')"
            )
    # Rebuild partial index with TEXT column type
    op.execute("DROP INDEX IF EXISTS idx_conversations_deleted")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_conversations_deleted "
        "ON conversations(deleted_at) WHERE deleted_at IS NOT NULL"
    )
