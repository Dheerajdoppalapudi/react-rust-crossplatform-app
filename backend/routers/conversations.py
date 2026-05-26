"""
Conversations router — CRUD and video merge for conversation threads.

Fixes applied:
  M-1  : List and detail endpoints now serialize through schema classes so the
         response shape is contract-enforced and IDE-discoverable.
  CRIT-3: merged_video_path from DB is validated against OUTPUTS_DIR before serving.
  CRIT-6: ffmpeg stderr is logged server-side only; client receives a generic message.
"""

import asyncio
import structlog
import os
import subprocess
import tempfile
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.config import OUTPUTS_DIR
from core.s3 import upload_merged_video as _s3_upload_merged_video
from core.utils import safe_resolve
from pydantic import BaseModel

from core.db_async import (
    get_async_db,
    get_async_db_read,
    rename_conversation,
    toggle_star_conversation,
    soft_delete_conversation,
    upsert_conversation_notes,
)
from core.db_models import User
from core.responses import success
from dependencies.auth import get_current_user, create_media_token, resolve_media_user
from schemas.sessions import (
    ConversationSummary,
    ConversationDetail,
    SessionTurn,
    ConversationTree,
    TreeNode,
    MergeResponse,
)

logger = structlog.get_logger(__name__)

router = APIRouter()

# Used by media endpoints that accept ?token= without Authorization header.
_bearer = HTTPBearer(auto_error=False)


@router.post("/conversations/{conversation_id}/media-token")
async def get_conversation_media_token(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Issue a short-lived media token scoped to this conversation.
    Used by the browser to authenticate <video src> for the merged video.
    The token expires in MEDIA_TOKEN_EXPIRE_MINUTES (default 5 min).
    """
    async with get_async_db_read() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
            conversation_id, current_user.id,
        )
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Reuse the media token mechanism, scoped to conversation_id as the "session".
    token = create_media_token(current_user.id, conversation_id)
    return success({"media_token": token})


@router.get("/conversations")
async def list_conversations(
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=30, ge=1, le=100),
    cursor: Optional[str] = Query(
        default=None,
        description="Opaque cursor from previous page's next_cursor field",
    ),
):
    """
    Paginated conversation list, ordered by (updated_at DESC, id DESC).

    The composite cursor encodes both updated_at and id so that conversations
    updated in the same second are never skipped or duplicated across pages.
    Pass `cursor=<next_cursor from previous response>` to fetch the next page.
    Returns { items, next_cursor, has_more }.
    """
    cursor_dt: Optional[datetime] = None
    cursor_id: Optional[str] = None
    if cursor:
        try:
            cursor_ts, cursor_id = cursor.split("|", 1)
        except ValueError:
            cursor_ts = cursor
            cursor_id = None
        try:
            cursor_dt = datetime.fromisoformat(cursor_ts).replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError):
            cursor_dt = None

    _BASE_SELECT = """
        SELECT c.id, c.title, c.created_at, c.updated_at,
               COALESCE(c.starred, false) AS starred,
               COALESCE(c.turn_count, 0) AS turn_count,
               (SELECT MIN(s.intent_type) FROM sessions s
                WHERE s.conversation_id = c.id AND s.status = 'done') AS intent_type
        FROM conversations c
    """

    async with get_async_db_read() as conn:
        if cursor_dt and cursor_id:
            rows = await conn.fetch(
                _BASE_SELECT + """
                WHERE c.user_id = $1 AND c.deleted_at IS NULL
                  AND (c.updated_at < $2 OR (c.updated_at = $2 AND c.id < $3))
                ORDER BY c.updated_at DESC, c.id DESC
                LIMIT $4
                """,
                current_user.id, cursor_dt, cursor_id, limit + 1,
            )
        elif cursor_dt:
            # Backwards-compatible path for old single-field cursors
            rows = await conn.fetch(
                _BASE_SELECT + """
                WHERE c.user_id = $1 AND c.deleted_at IS NULL
                  AND c.updated_at < $2
                ORDER BY c.updated_at DESC, c.id DESC
                LIMIT $3
                """,
                current_user.id, cursor_dt, limit + 1,
            )
        else:
            rows = await conn.fetch(
                _BASE_SELECT + """
                WHERE c.user_id = $1 AND c.deleted_at IS NULL
                ORDER BY c.updated_at DESC, c.id DESC
                LIMIT $2
                """,
                current_user.id, limit + 1,
            )

    has_more  = len(rows) > limit
    page_rows = rows[:limit]
    next_cursor = (
        f"{page_rows[-1]['updated_at'].isoformat()}|{page_rows[-1]['id']}"
        if has_more and page_rows else None
    )

    items = [ConversationSummary(**dict(r)).model_dump() for r in page_rows]
    return success({"items": items, "next_cursor": next_cursor, "has_more": has_more})


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, current_user: User = Depends(get_current_user)):
    """
    Conversation detail — 2 queries, small payload.

    frames_meta is intentionally excluded here (it can be 10–40 KB per turn).
    has_frames_meta: bool tells the client whether to call GET /sessions/:id/frames-meta,
    which now reads directly from the DB column (zero disk I/O, one RTT).
    """
    async with get_async_db_read() as conn:
        conv = await conn.fetchrow(
            """
            SELECT c.id, c.title, c.created_at, c.updated_at, c.merged_video_path,
                   n.content AS notes_content, n.updated_at AS notes_updated_at
            FROM conversations c
            LEFT JOIN conversation_notes n
              ON n.conversation_id = c.id AND n.user_id = $2
            WHERE c.id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL
            """,
            conversation_id, current_user.id,
        )
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        turns = await conn.fetch(
            "SELECT id, prompt, created_at, status, intent_type, render_path, "
            "frame_count, video_path, turn_index, parent_session_id, parent_frame_index, "
            "stages_json, sources_json, synthesis_text, "
            "(frames_meta IS NOT NULL) AS has_frames_meta "
            "FROM sessions WHERE conversation_id = $1 ORDER BY turn_index ASC",
            conversation_id,
        )

    notes = None
    if conv["notes_content"] is not None:
        notes = {
            "content": conv["notes_content"],
            "updated_at": (
                conv["notes_updated_at"].isoformat()
                if conv["notes_updated_at"] else None
            ),
        }

    detail = ConversationDetail(
        id=conv["id"],
        title=conv["title"],
        created_at=conv["created_at"],
        updated_at=conv["updated_at"],
        merged_video_path=conv["merged_video_path"],
        notes=notes,
        turns=[SessionTurn(**dict(t)) for t in turns],
    )
    return success(detail.model_dump())


@router.get("/conversations/{conversation_id}/tree")
async def get_conversation_tree(conversation_id: str, current_user: User = Depends(get_current_user)):
    """Lightweight endpoint for the canvas tree view — returns only node/edge fields."""
    async with get_async_db_read() as conn:
        conv = await conn.fetchrow(
            "SELECT id, title FROM conversations WHERE id = $1 AND user_id = $2",
            conversation_id, current_user.id,
        )
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        nodes = await conn.fetch(
            "SELECT id, prompt, status, intent_type, frame_count, video_path, "
            "turn_index, parent_session_id, parent_frame_index "
            "FROM sessions WHERE conversation_id = $1 ORDER BY turn_index ASC",
            conversation_id,
        )

    async def _video_ready(video_path: Optional[str]) -> bool:
        if not video_path:
            return False
        if video_path.startswith("https://"):
            return True
        return await asyncio.to_thread(os.path.exists, video_path)

    ready_flags = await asyncio.gather(*[_video_ready(n["video_path"]) for n in nodes])

    # M-1: Serialize through TreeNode schema.
    tree_nodes = [
        TreeNode(**dict(n), video_ready=ready)
        for n, ready in zip(nodes, ready_flags)
    ]
    tree = ConversationTree(
        conversation_id=conv["id"],
        title=conv["title"],
        nodes=tree_nodes,
    )
    return success(tree.model_dump())


@router.post("/conversations/{conversation_id}/merge")
async def merge_conversation_videos(conversation_id: str, current_user: User = Depends(get_current_user)):
    async with get_async_db() as conn:
        # Verify ownership first
        conv = await conn.fetchrow(
            "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
            conversation_id, current_user.id,
        )
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        rows = await conn.fetch(
            "SELECT id, prompt, video_path, parent_session_id, turn_index "
            "FROM sessions WHERE conversation_id = $1 AND status = 'done' ORDER BY turn_index ASC",
            conversation_id,
        )

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
        await asyncio.to_thread(
            subprocess.run,
            [ffmpeg_bin, "-y", "-f", "concat", "-safe", "0",
             "-i", concat_file, "-c", "copy", output_path],
            check=True,
            capture_output=True,
            timeout=600,
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="ffmpeg not found — please install ffmpeg and ensure it is on PATH",
        )
    except subprocess.CalledProcessError as e:
        # CRIT-6: log stderr server-side only; never expose it to the client.
        stderr = e.stderr.decode(errors="replace") if e.stderr else str(e)
        logger.error("ffmpeg_merge_failed", conversation=conversation_id, stderr=stderr)
        raise HTTPException(status_code=500, detail="Video merge failed. Please try again.")
    finally:
        if os.path.exists(concat_file):
            os.unlink(concat_file)

    # Upload to S3 and store CDN URL; fall back to local path if S3 is unavailable.
    stored_path = output_path
    try:
        cdn_url = await asyncio.to_thread(_s3_upload_merged_video, output_path, conversation_id)
        stored_path = cdn_url
    except Exception as exc:
        logger.warning("s3_merged_video_upload_failed", conversation=conversation_id, error=str(exc))

    async with get_async_db() as conn:
        await conn.execute(
            "UPDATE conversations SET merged_video_path = $1 WHERE id = $2",
            stored_path, conversation_id,
        )

    logger.info("merge_complete", conversation=conversation_id, sessions=len(video_paths), output=stored_path)
    # M-1: Serialize through MergeResponse schema.
    merge = MergeResponse(
        merged_video_url=f"/conversations/{conversation_id}/merged_video",
        session_count=len(ordered_sessions),
        sessions=ordered_sessions,
    )
    return success(merge.model_dump())


@router.get("/conversations/{conversation_id}/merged_video")
async def get_merged_video(
    conversation_id: str,
    token:           str = Query(default=""),
    credentials:     Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
):
    """
    Stream the merged conversation video.

    CRIT-2: Accepts ?token=<media_token> (browser <video src>) or
    Authorization: Bearer <jwt> (programmatic clients).
    The conversation media token is issued by POST /conversations/{id}/media-token.
    """
    current_user = await resolve_media_user(token, conversation_id, credentials)

    async with get_async_db_read() as conn:
        row = await conn.fetchrow(
            "SELECT merged_video_path FROM conversations WHERE id = $1 AND user_id = $2",
            conversation_id, current_user.id,
        )

    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")

    raw_path = row["merged_video_path"]
    if not raw_path:
        raise HTTPException(status_code=404, detail="Merged video not found")

    # CDN URL — redirect; no path traversal risk.
    if raw_path.startswith("https://"):
        return RedirectResponse(url=raw_path, status_code=302)

    # CRIT-3: Validate local path before serving.
    safe_path = safe_resolve(raw_path, label="merged_video")
    if not safe_path.exists():
        raise HTTPException(status_code=404, detail="Merged video not found")

    return FileResponse(
        str(safe_path),
        media_type="video/mp4",
        filename=f"merged_{conversation_id[:8]}.mp4",
    )


# ── Rename / Star / Delete ────────────────────────────────────────────────────

class RenameBody(BaseModel):
    title: str


@router.patch("/conversations/{conversation_id}")
async def rename_conv(
    conversation_id: str,
    body: RenameBody,
    current_user: User = Depends(get_current_user),
):
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    updated = await rename_conversation(conversation_id, current_user.id, title)
    if not updated:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return success({"title": title})


@router.post("/conversations/{conversation_id}/star")
async def star_conv(conversation_id: str, current_user: User = Depends(get_current_user)):
    new_starred = await toggle_star_conversation(conversation_id, current_user.id)
    if new_starred is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return success({"starred": new_starred})


@router.delete("/conversations/{conversation_id}")
async def delete_conv(conversation_id: str, current_user: User = Depends(get_current_user)):
    deleted = await soft_delete_conversation(conversation_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return success({"deleted": True})


# ── User notes ────────────────────────────────────────────────────────────────

class NotesUpdateBody(BaseModel):
    content: str  # TipTap JSONContent serialized as a string by the client


@router.get("/conversations/{conversation_id}/notes")
async def get_notes(conversation_id: str, current_user: User = Depends(get_current_user)):
    # Single query: ownership check + notes fetch via LEFT JOIN — 1 RTT instead of 2.
    async with get_async_db_read() as conn:
        row = await conn.fetchrow(
            """
            SELECT n.content, n.updated_at
            FROM conversations c
            LEFT JOIN conversation_notes n
              ON n.conversation_id = c.id AND n.user_id = $2
            WHERE c.id = $1 AND c.user_id = $2 AND c.deleted_at IS NULL
            """,
            conversation_id, current_user.id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if row["content"] is None:
        return success({"content": None, "updated_at": None})
    return success({"content": row["content"], "updated_at": row["updated_at"]})


@router.put("/conversations/{conversation_id}/notes")
async def update_notes(
    conversation_id: str,
    body: NotesUpdateBody,
    current_user: User = Depends(get_current_user),
):
    async with get_async_db() as conn:
        conv = await conn.fetchrow(
            "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
            conversation_id, current_user.id,
        )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    updated_at = await upsert_conversation_notes(conversation_id, current_user.id, body.content)
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
