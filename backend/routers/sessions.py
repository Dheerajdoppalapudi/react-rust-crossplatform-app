"""
Sessions router — read-only access to individual session data.

Fixes applied:
  CRIT-3: All file paths from the database are validated against OUTPUTS_DIR
          before any open() / FileResponse() call.
  M-1   : List endpoint serializes rows through SessionSummary schema.
"""

import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.config import OUTPUTS_DIR
from core.database import get_db
from core.db_models import User
from core.responses import success
from dependencies.auth import get_current_user, resolve_media_user
from schemas.sessions import SessionSummary, SessionOutputResponse

_bearer = HTTPBearer(auto_error=False)

logger = logging.getLogger(__name__)

router = APIRouter()

_OUTPUTS_DIR_RESOLVED = Path(OUTPUTS_DIR).resolve()


def _safe_path(raw_path: str, label: str = "file") -> Path:
    """
    Resolve raw_path and assert it is inside OUTPUTS_DIR.

    CRIT-3: Prevents path traversal attacks where a crafted DB entry could
    point to arbitrary filesystem locations (e.g. /etc/passwd, ../secrets).
    Raises HTTP 403 if the resolved path escapes the outputs directory.
    """
    resolved = Path(raw_path).resolve()
    if not str(resolved).startswith(str(_OUTPUTS_DIR_RESOLVED)):
        logger.warning(
            "path_traversal_blocked  label=%s  raw=%r  resolved=%s",
            label, raw_path, resolved,
        )
        raise HTTPException(status_code=403, detail="Access denied")
    return resolved


@router.get("/api/sessions")
def list_sessions(current_user: User = Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, prompt, created_at, status, intent_type, render_path, frame_count, "
            "api_call_count, prompt_tokens, completion_tokens, total_tokens, model_name "
            "FROM sessions WHERE user_id = ? ORDER BY created_at DESC",
            (current_user.id,),
        ).fetchall()
    # M-1: Serialize through schema so the response shape is contract-enforced.
    return success([SessionSummary(**dict(r)).model_dump() for r in rows])


@router.get("/api/sessions/{session_id}/output")
def get_session_output(session_id: str, current_user: User = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT ui_output_file, status FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user.id),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    if row["status"] != "done" or not row["ui_output_file"]:
        raise HTTPException(status_code=404, detail="Output not available")

    # CRIT-3: validate before opening
    safe = _safe_path(row["ui_output_file"], "ui_output_file")
    if not safe.exists():
        raise HTTPException(status_code=404, detail="Output file missing")

    file_type = "python" if safe.suffix == ".py" else "json"
    content   = safe.read_text()
    return success(SessionOutputResponse(file_type=file_type, content=content).model_dump())


@router.get("/api/sessions/{session_id}/log")
def get_session_log(session_id: str, current_user: User = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT output_dir FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user.id),
        ).fetchone()

    if not row or not row["output_dir"]:
        raise HTTPException(status_code=404, detail="Session not found")

    # CRIT-3: validate the directory, then build a child path
    safe_dir  = _safe_path(row["output_dir"], "output_dir")
    log_path  = safe_dir / "activity_log.json"
    if not log_path.exists():
        raise HTTPException(status_code=404, detail="Log not available")

    return success({"log": json.loads(log_path.read_text())})


@router.get("/api/sessions/{session_id}/frames-meta")
def get_session_frames_meta(session_id: str, current_user: User = Depends(get_current_user)):
    """Return the frames metadata for a session.

    For video/text sessions this is frames.json.
    For interactive sessions this is scene_ir.json (saved by interactive_service).
    """
    with get_db() as conn:
        row = conn.execute(
            "SELECT output_dir, render_path FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user.id),
        ).fetchone()

    if not row or not row["output_dir"]:
        raise HTTPException(status_code=404, detail="Session not found")

    safe_dir = _safe_path(row["output_dir"], "output_dir")

    if row["render_path"] == "interactive":
        scene_path = safe_dir / "scene_ir.json"
        if not scene_path.exists():
            raise HTTPException(status_code=404, detail="scene_ir.json not found")
        return success(json.loads(scene_path.read_text()))

    frames_path = safe_dir / "frames.json"
    if not frames_path.exists():
        raise HTTPException(status_code=404, detail="frames.json not found")

    return success(json.loads(frames_path.read_text()))


@router.get("/api/sessions/{session_id}/frame/{frame_index}")
def get_session_frame(
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
    current_user = resolve_media_user(token, session_id, credentials)

    with get_db() as conn:
        row = conn.execute(
            "SELECT output_dir FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user.id),
        ).fetchone()

    if not row or not row["output_dir"]:
        raise HTTPException(status_code=404, detail="Session not found")

    # CRIT-3: validate the session output directory first
    safe_dir    = _safe_path(row["output_dir"], "output_dir")
    frames_path = safe_dir / "frames.json"
    if not frames_path.exists():
        raise HTTPException(status_code=404, detail="frames.json not found")

    images = json.loads(frames_path.read_text()).get("images", [])

    if frame_index >= len(images):
        raise HTTPException(status_code=404, detail="Frame index out of range")

    raw_image_path = images[frame_index]
    if not raw_image_path:
        raise HTTPException(status_code=404, detail="Frame image not available")

    # CRIT-3: validate the individual frame path too — it may be an absolute path
    # written by the generator; it must still reside inside OUTPUTS_DIR.
    safe_image = _safe_path(raw_image_path, "frame_image")
    if not safe_image.exists() or safe_image.suffix.lower() != ".png":
        raise HTTPException(
            status_code=404,
            detail="Frame image not available (non-PNG or missing)",
        )

    return FileResponse(str(safe_image), media_type="image/png")
