"""
Sessions router — read-only access to individual session data.
"""

import json
import logging
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from core.database import get_db
from schemas.sessions import (
    SessionSummary,
    ConversationDetail,
    SessionOutputResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/sessions", response_model=list[SessionSummary])
def list_sessions():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, prompt, created_at, status, intent_type, render_path, frame_count, "
            "api_call_count, prompt_tokens, completion_tokens, total_tokens, model_name "
            "FROM sessions ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/api/sessions/{session_id}/output", response_model=SessionOutputResponse)
def get_session_output(session_id: str):
    with get_db() as conn:
        row = conn.execute(
            "SELECT ui_output_file, status FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    if row["status"] != "done" or not row["ui_output_file"]:
        raise HTTPException(status_code=404, detail="Output not available")

    path = row["ui_output_file"]
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Output file missing")

    file_type = "python" if path.endswith(".py") else "json"
    with open(path) as f:
        content = f.read()
    return {"file_type": file_type, "content": content}


@router.get("/api/sessions/{session_id}/log")
def get_session_log(session_id: str):
    with get_db() as conn:
        row = conn.execute(
            "SELECT output_dir FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()

    if not row or not row["output_dir"]:
        raise HTTPException(status_code=404, detail="Session not found")

    log_path = os.path.join(row["output_dir"], "activity_log.json")
    if not os.path.exists(log_path):
        raise HTTPException(status_code=404, detail="Log not available")

    with open(log_path) as f:
        return {"log": json.load(f)}


@router.get("/api/sessions/{session_id}/frames-meta")
def get_session_frames_meta(session_id: str):
    """Return the frames.json content (image paths, captions, render_path)."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT output_dir FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()

    if not row or not row["output_dir"]:
        raise HTTPException(status_code=404, detail="Session not found")

    frames_path = os.path.join(row["output_dir"], "frames.json")
    if not os.path.exists(frames_path):
        raise HTTPException(status_code=404, detail="frames.json not found")

    with open(frames_path) as f:
        return json.load(f)


@router.get("/api/sessions/{session_id}/frame/{frame_index}")
def get_session_frame(session_id: str, frame_index: int):
    """Serve a rendered frame as a PNG image."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT output_dir FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()

    if not row or not row["output_dir"]:
        raise HTTPException(status_code=404, detail="Session not found")

    frames_path = os.path.join(row["output_dir"], "frames.json")
    if not os.path.exists(frames_path):
        raise HTTPException(status_code=404, detail="frames.json not found")

    with open(frames_path) as f:
        images = json.load(f).get("images", [])

    if frame_index >= len(images):
        raise HTTPException(status_code=404, detail="Frame index out of range")

    image_path = images[frame_index]
    if image_path and image_path.lower().endswith(".png") and os.path.exists(image_path):
        return FileResponse(image_path, media_type="image/png")

    raise HTTPException(status_code=404, detail="Frame image not available (non-PNG or missing)")
