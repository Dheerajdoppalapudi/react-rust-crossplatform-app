"""
Alembic migration environment.

Uses SQLAlchemy's create_async_engine with asyncpg — the same driver as the
app. No psycopg2 needed anywhere in the stack. All migration files are raw SQL.

Run migrations:
    cd backend/
    source env/bin/activate
    alembic upgrade head          # apply all pending
    alembic downgrade -1          # roll back one revision
    alembic revision -m "add foo column"   # draft a new migration
"""

import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# ── Path setup so `from core.config import ...` works ────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Alembic Config ────────────────────────────────────────────────────────────
config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

# No target_metadata — we write raw SQL, not auto-generate from ORM models.
target_metadata = None


def _get_url() -> str:
    """Read DATABASE_URL from env and ensure the asyncpg dialect is set."""
    from core.config import DATABASE_URL
    # Normalise both postgresql:// and postgres:// to postgresql+asyncpg://
    for prefix in ("postgresql://", "postgres://"):
        if DATABASE_URL.startswith(prefix):
            return DATABASE_URL.replace(prefix, "postgresql+asyncpg://", 1)
    return DATABASE_URL


def run_migrations_offline() -> None:
    """
    Emit SQL to stdout without a live DB connection.
    Useful for generating migration scripts to review before applying.
    """
    context.configure(
        url=_get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations against a live database connection via asyncpg."""
    engine = create_async_engine(_get_url(), poolclass=pool.NullPool)
    async with engine.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
