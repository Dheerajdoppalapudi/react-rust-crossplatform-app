"""
Backfill frames_meta for sessions that completed before the column was added.

Run once after deploying the frames_meta migration:
    cd backend
    python scripts/backfill_frames_meta.py

Read priority per session:
  1. Local disk  (outputs/<session_id>/frames.json or scene_ir.json)
  2. S3 fallback (meta/<session_id>/frames.json or scene_ir.json)
  3. Skip        (log a warning, move on)

Safe to re-run — only processes rows where frames_meta IS NULL.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

# Ensure backend/ is on the path when run from the repo root.
sys.path.insert(0, str(Path(__file__).parent.parent))

import structlog
from dotenv import load_dotenv

load_dotenv()

from core.db_async import init_pool, close_pool, _get_pool
from core.config import OUTPUTS_DIR
from core.s3 import meta_key, download_json as _s3_download_json

logger = structlog.get_logger(__name__)


async def _fetch_frames_meta(session_id: str, output_dir: str, render_path: str) -> dict | None:
    """Return the frames_meta dict for a session, or None if unavailable."""
    is_interactive = render_path == "interactive"
    filename = "scene_ir.json" if is_interactive else "frames.json"

    # 1. Local disk
    if output_dir:
        local_path = Path(output_dir) / filename
        if local_path.exists():
            try:
                return json.loads(local_path.read_text())
            except Exception as exc:
                logger.warning("backfill_local_read_failed", session=session_id, error=str(exc))

    # 2. S3 fallback
    try:
        data = await asyncio.to_thread(_s3_download_json, meta_key(session_id, filename))
        if data:
            return data
    except Exception as exc:
        logger.warning("backfill_s3_read_failed", session=session_id, error=str(exc))

    return None


async def backfill(batch_size: int = 50) -> None:
    await init_pool()
    pool = _get_pool()

    try:
        # Count how many need backfilling.
        total = await pool.fetchval(
            "SELECT COUNT(*) FROM sessions WHERE frames_meta IS NULL AND status = 'done'"
        )
        logger.info("backfill_start", total_to_process=total)

        processed = updated = skipped = 0

        while True:
            rows = await pool.fetch(
                """
                SELECT id, output_dir, render_path
                FROM sessions
                WHERE frames_meta IS NULL AND status = 'done'
                LIMIT $1
                """,
                batch_size,
            )
            if not rows:
                break

            for row in rows:
                session_id  = row["id"]
                output_dir  = row["output_dir"] or ""
                render_path = row["render_path"] or ""

                meta = await _fetch_frames_meta(session_id, output_dir, render_path)
                if meta:
                    await pool.execute(
                        "UPDATE sessions SET frames_meta = $1 WHERE id = $2",
                        json.dumps(meta), session_id,
                    )
                    updated += 1
                    logger.info("backfill_session_updated", session=session_id[:8])
                else:
                    skipped += 1
                    logger.warning("backfill_session_skipped", session=session_id[:8],
                                   output_dir=output_dir)

                processed += 1

            logger.info("backfill_progress", processed=processed, updated=updated, skipped=skipped)

        logger.info("backfill_complete", total=processed, updated=updated, skipped=skipped)

    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(backfill())
