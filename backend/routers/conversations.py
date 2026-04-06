"""
Conversations router — CRUD and video merge for conversation threads.
"""

import logging
import os
import subprocess
import tempfile

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from core.config import OUTPUTS_DIR
from pydantic import BaseModel

from core.database import (
    get_db, update_session,
    get_conversation_notes, upsert_conversation_notes,
    rename_conversation, toggle_star_conversation, soft_delete_conversation,
)
from core.db_models import User
from core.responses import success
from dependencies.auth import get_current_user
from schemas.sessions import (
    ConversationSummary,
    ConversationDetail,
    ConversationTree,
    MergeResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/conversations")
def list_conversations(current_user: User = Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute("""
            SELECT c.id, c.title, c.created_at, c.updated_at,
                   COALESCE(c.starred, 0) AS starred,
                   COUNT(s.id) AS turn_count,
                   MIN(s.intent_type) AS intent_type
            FROM conversations c
            LEFT JOIN sessions s ON s.conversation_id = c.id AND s.status = 'done'
            WHERE c.user_id = ? AND c.deleted_at IS NULL
            GROUP BY c.id
            ORDER BY c.updated_at DESC
        """, (current_user.id,)).fetchall()
    return success([dict(r) for r in rows])


@router.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: str, current_user: User = Depends(get_current_user)):
    with get_db() as conn:
        conv = conn.execute(
            "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
            (conversation_id, current_user.id),
        ).fetchone()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        turns = conn.execute(
            "SELECT id, prompt, created_at, status, intent_type, render_path, "
            "frame_count, video_path, turn_index, parent_session_id, parent_frame_index "
            "FROM sessions WHERE conversation_id = ? ORDER BY turn_index ASC",
            (conversation_id,),
        ).fetchall()
    return success({**dict(conv), "turns": [dict(t) for t in turns]})


@router.get("/api/conversations/{conversation_id}/tree")
def get_conversation_tree(conversation_id: str, current_user: User = Depends(get_current_user)):
    """Lightweight endpoint for the canvas tree view — returns only node/edge fields."""
    with get_db() as conn:
        conv = conn.execute(
            "SELECT id, title FROM conversations WHERE id = ? AND user_id = ?",
            (conversation_id, current_user.id),
        ).fetchone()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        nodes = conn.execute(
            "SELECT id, prompt, status, intent_type, frame_count, video_path, "
            "turn_index, parent_session_id, parent_frame_index "
            "FROM sessions WHERE conversation_id = ? ORDER BY turn_index ASC",
            (conversation_id,),
        ).fetchall()

    return success({
        "conversation_id": conv["id"],
        "title":           conv["title"],
        "nodes": [
            {**dict(n), "video_ready": bool(n["video_path"] and os.path.exists(n["video_path"]))}
            for n in nodes
        ],
    })


@router.post("/api/conversations/{conversation_id}/merge")
def merge_conversation_videos(conversation_id: str, current_user: User = Depends(get_current_user)):
    with get_db() as conn:
        # Verify ownership first
        conv = conn.execute(
            "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
            (conversation_id, current_user.id),
        ).fetchone()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        rows = conn.execute(
            "SELECT id, prompt, video_path, parent_session_id, turn_index "
            "FROM sessions WHERE conversation_id = ? AND status = 'done' ORDER BY turn_index ASC",
            (conversation_id,),
        ).fetchall()

    if not rows:
        raise HTTPException(status_code=400, detail="No completed sessions found for this conversation")

    video_paths, ordered_sessions = _collect_ordered_videos(rows)

    if len(video_paths) < 2:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 2 videos to merge, found {len(video_paths)}",
        )

    output_path = str(OUTPUTS_DIR / f"merged_{conversation_id}.mp4")
    ffmpeg_bin  = _resolve_ffmpeg()

    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        for vp in video_paths:
            f.write(f"file '{vp}'\n")
        concat_file = f.name

    try:
        subprocess.run(
            [ffmpeg_bin, "-y", "-f", "concat", "-safe", "0",
             "-i", concat_file, "-c", "copy", output_path],
            check=True,
            capture_output=True,
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="ffmpeg not found — please install ffmpeg and ensure it is on PATH",
        )
    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode(errors="replace") if e.stderr else str(e)
        logger.error("ffmpeg merge failed  conversation=%s  stderr=%s", conversation_id, stderr)
        raise HTTPException(status_code=500, detail=f"ffmpeg failed: {stderr}")
    finally:
        if os.path.exists(concat_file):
            os.unlink(concat_file)

    with get_db() as conn:
        conn.execute(
            "UPDATE conversations SET merged_video_path = ? WHERE id = ?",
            (output_path, conversation_id),
        )
        conn.commit()

    logger.info(
        "Merge complete  conversation=%s  sessions=%d  output=%s",
        conversation_id, len(video_paths), output_path,
    )
    return success({
        "merged_video_url": f"/api/conversations/{conversation_id}/merged_video",
        "session_count":    len(ordered_sessions),
        "sessions":         ordered_sessions,
    })


@router.get("/api/conversations/{conversation_id}/merged_video")
def get_merged_video(conversation_id: str, current_user: User = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT merged_video_path FROM conversations WHERE id = ? AND user_id = ?",
            (conversation_id, current_user.id),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")

    path = row["merged_video_path"]
    if path and os.path.exists(path):
        return FileResponse(path, media_type="video/mp4",
                            filename=f"merged_{conversation_id[:8]}.mp4")

    raise HTTPException(status_code=404, detail="Merged video not found")


# ── Rename / Star / Delete ────────────────────────────────────────────────────

class RenameBody(BaseModel):
    title: str


@router.patch("/api/conversations/{conversation_id}")
def rename_conv(
    conversation_id: str,
    body: RenameBody,
    current_user: User = Depends(get_current_user),
):
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    updated = rename_conversation(conversation_id, current_user.id, title)
    if not updated:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return success({"title": title})


@router.post("/api/conversations/{conversation_id}/star")
def star_conv(conversation_id: str, current_user: User = Depends(get_current_user)):
    new_starred = toggle_star_conversation(conversation_id, current_user.id)
    if new_starred is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return success({"starred": new_starred})


@router.delete("/api/conversations/{conversation_id}")
def delete_conv(conversation_id: str, current_user: User = Depends(get_current_user)):
    deleted = soft_delete_conversation(conversation_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return success({"deleted": True})


# ── User notes ────────────────────────────────────────────────────────────────

class NotesUpdateBody(BaseModel):
    content: str  # TipTap JSONContent serialized as a string by the client


@router.get("/api/conversations/{conversation_id}/notes")
def get_notes(conversation_id: str, current_user: User = Depends(get_current_user)):
    with get_db() as conn:
        conv = conn.execute(
            "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
            (conversation_id, current_user.id),
        ).fetchone()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    notes = get_conversation_notes(conversation_id, current_user.id)
    if notes is None:
        return success({"content": None, "updated_at": None})
    return success(notes)


@router.put("/api/conversations/{conversation_id}/notes")
def update_notes(
    conversation_id: str,
    body: NotesUpdateBody,
    current_user: User = Depends(get_current_user),
):
    with get_db() as conn:
        conv = conn.execute(
            "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
            (conversation_id, current_user.id),
        ).fetchone()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    updated_at = upsert_conversation_notes(conversation_id, current_user.id, body.content)
    return success({"updated_at": updated_at})


# ── Helpers ───────────────────────────────────────────────────────────────────

def _topological_video_order(rows) -> tuple[list[str], dict]:
    """BFS topological sort of sessions within a conversation. Returns (ordered_ids, session_map)."""
    session_ids = {r["id"] for r in rows}
    session_map = {r["id"]: dict(r) for r in rows}

    children: dict = {}
    for r in rows:
        pid = r["parent_session_id"]
        if pid and pid in session_ids:
            children.setdefault(pid, []).append(r["id"])

    roots = [
        r["id"] for r in rows
        if not r["parent_session_id"] or r["parent_session_id"] not in session_ids
    ]

    ordered_ids: list[str] = []
    queue   = list(roots)
    visited: set = set()
    while queue:
        sid = queue.pop(0)
        if sid in visited:
            continue
        visited.add(sid)
        ordered_ids.append(sid)
        queue.extend(children.get(sid, []))

    return ordered_ids, session_map


def _collect_ordered_videos(rows) -> tuple[list[str], list[dict]]:
    """Return (video_path_list, session_summary_list) in topological order, skipping missing files."""
    ordered_ids, session_map = _topological_video_order(rows)
    video_paths: list[str]  = []
    sessions: list[dict]    = []
    for sid in ordered_ids:
        s  = session_map[sid]
        vp = s.get("video_path")
        if vp and os.path.exists(vp):
            video_paths.append(vp)
            sessions.append({"id": sid, "prompt": s["prompt"]})
    return video_paths, sessions


def _resolve_ffmpeg() -> str:
    """Return the ffmpeg binary path — prefer imageio_ffmpeg bundled binary, fall back to PATH."""
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"
