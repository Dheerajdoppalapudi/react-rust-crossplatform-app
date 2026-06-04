"""Add sessions.cost_usd — per-session LLM dollar cost.

Changes:
  1. sessions.cost_usd  ADD COLUMN DOUBLE PRECISION DEFAULT 0

The value is computed at generation time from the per-call model + token usage
recorded in the lifecycle log (see core/cost.py) and written in the finalise
step of routers/generate.py. Existing rows default to 0 (cost unknown / not
back-computed — the lifecycle logs predate per-call model capture).

Deployment order:
  1. Run `alembic upgrade head` BEFORE deploying new app code.
  2. init_db() also performs this ADD COLUMN IF NOT EXISTS on startup, so a
     fresh deploy is safe even without running this migration first; the
     migration exists to keep Alembic the source of truth for prod schema.

Revision ID: 004
Revises: 003
Create Date: 2026-06-04
"""

from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS cost_usd DOUBLE PRECISION DEFAULT 0"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE sessions DROP COLUMN IF EXISTS cost_usd")
