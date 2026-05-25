"""
Sessions router — read-only access to individual session data.

Fixes applied:
  CRIT-3: All file paths from the database are validated against OUTPUTS_DIR
          before any open() / FileResponse() call.
  M-1   : List endpoint serializes rows through SessionSummary schema.
"""

import asyncio
import json
import structlog
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.db_async import get_async_db_read as get_async_db
from core.db_models import User
from core.responses import success
from core.s3 import meta_key, download_json as _s3_download_json
from core.utils import safe_resolve, read_json_file
from dependencies.auth import get_current_user, resolve_media_user
from schemas.sessions import SessionSummary, SessionOutputResponse

_bearer = HTTPBearer(auto_error=False)

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.get("/api/sessions")
async def list_sessions(current_user: User = Depends(get_current_user)):
    async with get_async_db() as conn:
        rows = await conn.fetch(
            "SELECT id, prompt, created_at, status, intent_type, render_path, frame_count, "
            "api_call_count, prompt_tokens, completion_tokens, total_tokens, model_name "
            "FROM sessions WHERE user_id = $1 ORDER BY created_at DESC",
            current_user.id,
        )
    # M-1: Serialize through schema so the response shape is contract-enforced.
    return success([SessionSummary(**dict(r)).model_dump() for r in rows])


@router.get("/api/sessions/{session_id}/output")
async def get_session_output(session_id: str, current_user: User = Depends(get_current_user)):
    async with get_async_db() as conn:
        row = await conn.fetchrow(
            "SELECT ui_output_file, status FROM sessions WHERE id = $1 AND user_id = $2",
            session_id, current_user.id,
        )

    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    if row["status"] != "done" or not row["ui_output_file"]:
        raise HTTPException(status_code=404, detail="Output not available")

    # CRIT-3: validate before opening
    safe = safe_resolve(row["ui_output_file"], label="ui_output_file")
    if not safe.exists():
        raise HTTPException(status_code=404, detail="Output file missing")

    file_type = "python" if safe.suffix == ".py" else "json"
    content   = safe.read_text()
    return success(SessionOutputResponse(file_type=file_type, content=content).model_dump())


@router.get("/api/sessions/{session_id}/log")
async def get_session_log(session_id: str, current_user: User = Depends(get_current_user)):
    async with get_async_db() as conn:
        row = await conn.fetchrow(
            "SELECT output_dir FROM sessions WHERE id = $1 AND user_id = $2",
            session_id, current_user.id,
        )

    if not row or not row["output_dir"]:
        raise HTTPException(status_code=404, detail="Session not found")

    # CRIT-3: validate the directory, then build a child path
    safe_dir  = safe_resolve(row["output_dir"], label="output_dir")
    log_path  = safe_dir / "activity_log.json"
    if not log_path.exists():
        raise HTTPException(status_code=404, detail="Log not available")

    return success({"log": json.loads(log_path.read_text())})


@router.get("/api/sessions/{session_id}/frames-meta")
async def get_session_frames_meta(session_id: str, current_user: User = Depends(get_current_user)):
    """Return the frames metadata for a session.

    Read priority:
      1. DB  — frames_meta JSONB column (zero file I/O, fastest path)
      2. Local disk — output_dir/frames.json or scene_ir.json
      3. S3  — meta/<session_id>/frames.json or scene_ir.json
      4. 404
    """
    async with get_async_db() as conn:
        row = await conn.fetchrow(
            "SELECT output_dir, render_path, frames_meta "
            "FROM sessions WHERE id = $1 AND user_id = $2",
            session_id, current_user.id,
        )

    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    # 1. DB fast path — already stored inline, no file I/O needed.
    if row["frames_meta"] is not None:
        return success(row["frames_meta"])

    is_interactive = row["render_path"] == "interactive"
    filename       = "scene_ir.json" if is_interactive else "frames.json"

    # 2. Local disk fallback.
    output_dir = row["output_dir"] or ""
    if output_dir:
        safe_dir   = safe_resolve(output_dir, label="output_dir")
        local_path = safe_dir / filename
        if local_path.exists():
            return success(read_json_file(local_path))

    # 3. S3 fallback.
    try:
        data = await asyncio.to_thread(_s3_download_json, meta_key(session_id, filename))
        if data:
            return success(data)
    except Exception as exc:
        logger.warning("frames_meta_s3_fallback_failed", session=session_id[:8], error=str(exc))

    raise HTTPException(status_code=404, detail="frames-meta not available")


@router.get("/api/sessions/{session_id}/frame/{frame_index}")
async def get_session_frame(
    session_id:  str,
    frame_index: int,
    token:       str = Query(default=""),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
):
    """
    Serve a rendered frame as a PNG image.

    CRIT-2: Accepts either ?token=<media_token> (for browser <img src> elements
    that cannot set Authorization headers) or Authorization: Bearer <jwt>.
    """
    # Resolve user from media token or Bearer JWT.
    current_user = await resolve_media_user(token, session_id, credentials)

    async with get_async_db() as conn:
        row = await conn.fetchrow(
            "SELECT output_dir FROM sessions WHERE id = $1 AND user_id = $2",
            session_id, current_user.id,
        )

    if not row or not row["output_dir"]:
        raise HTTPException(status_code=404, detail="Session not found")

    # CRIT-3: validate the session output directory first
    safe_dir    = safe_resolve(row["output_dir"], label="output_dir")
    frames_path = safe_dir / "frames.json"
    if not frames_path.exists():
        raise HTTPException(status_code=404, detail="frames.json not found")

    images = read_json_file(frames_path).get("images", [])

    if frame_index >= len(images):
        raise HTTPException(status_code=404, detail="Frame index out of range")

    raw_image_path = images[frame_index]
    if not raw_image_path:
        raise HTTPException(status_code=404, detail="Frame image not available")

    if raw_image_path.startswith("https://"):
        return RedirectResponse(url=raw_image_path, status_code=302)

    # CRIT-3: validate the individual frame path too — it may be an absolute path
    # written by the generator; it must still reside inside OUTPUTS_DIR.
    safe_image = safe_resolve(raw_image_path, label="frame_image")
    if not safe_image.exists() or safe_image.suffix.lower() != ".png":
        raise HTTPException(
            status_code=404,
            detail="Frame image not available (non-PNG or missing)",
        )

    return FileResponse(str(safe_image), media_type="image/png")
