"""
Video router — SSE-streamed video generation and video download.

Fixes applied:
  CRIT-2: POST /api/sessions/{session_id}/media-token issues a short-lived,
          session-scoped token. The video download endpoint accepts either
          Authorization: Bearer <access_jwt> (programmatic clients) or
          ?token=<media_token> (browser <video src>) — the main access JWT
          never appears in a URL query string.
  CRIT-3: video_path from DB is validated against OUTPUTS_DIR before serving.
  CRIT-6: SSE error events emit a generic message; details are server-side only.
  HIGH-2: export_frames and assemble run in asyncio.to_thread() so they don't
          block the event loop.
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.config import OUTPUTS_DIR
from core.database import get_db, update_session
from core.db_models import User
from core.responses import success
from dependencies.auth import get_current_user, create_media_token, resolve_media_user
from services.video.frame_exporter import export_frames
from services.video.tts_service import parse_narration, generate_audio_parallel
from services.video.video_assembler import assemble, moviepy_available

logger = logging.getLogger(__name__)

router = APIRouter()

_OUTPUTS_DIR_RESOLVED = Path(OUTPUTS_DIR).resolve()

# Used by media download endpoints that accept ?token= without Authorization header.
_bearer = HTTPBearer(auto_error=False)

_SSE_HEADERS = {
    "Cache-Control":     "no-cache",
    "X-Accel-Buffering": "no",
    "Connection":        "keep-alive",
}


def _sse(payload: dict) -> str:
    """Format one Server-Sent Event."""
    return f"data: {json.dumps(payload)}\n\n"


def _safe_video_path(raw_path: str) -> Path:
    """
    CRIT-3: Resolve the path and assert it is inside OUTPUTS_DIR.
    Raises HTTP 403 if the path escapes the outputs directory.
    """
    resolved = Path(raw_path).resolve()
    if not str(resolved).startswith(str(_OUTPUTS_DIR_RESOLVED)):
        logger.warning("path_traversal_blocked  raw=%r  resolved=%s", raw_path, resolved)
        raise HTTPException(status_code=403, detail="Access denied")
    return resolved


# ── Media token endpoint (CRIT-2) ─────────────────────────────────────────────

@router.post("/api/sessions/{session_id}/media-token")
def get_media_token(
    session_id:   str,
    current_user: User = Depends(get_current_user),
):
    """
    Issue a short-lived, session-scoped media token.

    The frontend calls this before rendering a <video> element, then appends
    the returned token to the video URL as ?token=<media_token>. The media
    token expires in MEDIA_TOKEN_EXPIRE_MINUTES (default 5 min) and is scoped
    to this session only — even if captured in logs it cannot be misused for
    long or reused on other sessions.

    This keeps the main access JWT out of any URL / log.
    """
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user.id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    token = create_media_token(current_user.id, session_id)
    return success({"media_token": token})


# ── Video generation (SSE) ────────────────────────────────────────────────────

@router.post("/api/generate_video/{session_id}")
async def generate_video(
    session_id:     str,
    use_openai_tts: bool = False,
    current_user:   User = Depends(get_current_user),
):
    """
    Generate a video for an existing session — streams progress via SSE.

    HIGH-2: export_frames and assemble are blocking (CPU / subprocess).
    They are run in asyncio.to_thread() so they don't block the event loop.
    """
    if not moviepy_available():
        raise HTTPException(
            status_code=503,
            detail="moviepy not installed — run: pip install moviepy",
        )

    with get_db() as conn:
        row = conn.execute(
            "SELECT output_dir, frame_count, status, render_path, video_path FROM sessions "
            "WHERE id = ? AND user_id = ?",
            (session_id, current_user.id),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    if row["status"] != "done":
        raise HTTPException(
            status_code=400,
            detail=f"Session not ready (status: {row['status']})",
        )

    output_dir = row["output_dir"]
    if not output_dir:
        raise HTTPException(status_code=404, detail="Session output directory missing")

    # CRIT-3: validate the directory is inside OUTPUTS_DIR before using it
    safe_output_dir = _safe_video_path(output_dir)
    if not safe_output_dir.is_dir():
        raise HTTPException(status_code=404, detail="Session output directory missing")

    frames_path    = safe_output_dir / "frames.json"
    narration_path = safe_output_dir / "narration.txt"

    if not frames_path.exists():
        raise HTTPException(
            status_code=404,
            detail="frames.json not found — re-run image generation",
        )
    if not narration_path.exists():
        raise HTTPException(status_code=404, detail="narration.txt not found")

    captions        = json.loads(frames_path.read_text()).get("captions", [])
    narration_texts = parse_narration(narration_path.read_text())

    while len(narration_texts) < len(captions):
        narration_texts.append("")
    narration_texts = narration_texts[: len(captions)]

    video_path  = str(safe_output_dir / "final_video.mp4")
    tts_backend = "openai" if use_openai_tts else "gtts"

    # Idempotency: video already exists — emit a single "done" event
    if row["video_path"]:
        existing = _safe_video_path(row["video_path"])
        if existing.exists():
            logger.info("video_cached  session=%s", session_id)

            async def _cached_stream():
                yield _sse({
                    "type":        "done",
                    "session_id":  session_id,
                    "video_path":  row["video_path"],
                    "frame_count": row["frame_count"],
                    "tts_backend": "cached",
                })

            return StreamingResponse(
                _cached_stream(), media_type="text/event-stream", headers=_SSE_HEADERS
            )

    async def event_stream():
        import time
        t_start = time.time()

        def elapsed() -> float:
            return round(time.time() - t_start, 1)

        try:
            # Stage 1: normalize frames to 1920×1080 PNGs
            logger.info(
                "video_stage_export_start  session=%s  frames=%d",
                session_id, len(captions),
            )
            yield _sse({
                "type": "stage", "stage": "export_frames",
                "message": "Exporting frames", "elapsed_s": elapsed(),
            })

            t1 = time.time()
            # HIGH-2: blocking I/O — run in thread pool
            normalized_pngs = await asyncio.to_thread(
                export_frames, str(safe_output_dir), captions
            )
            d1 = round(time.time() - t1, 1)

            logger.info(
                "video_stage_export_done  session=%s  exported=%d  duration=%.1fs",
                session_id, len(normalized_pngs), d1,
            )
            yield _sse({
                "type": "stage_done", "stage": "export_frames",
                "count": len(normalized_pngs), "duration_s": d1, "elapsed_s": elapsed(),
            })

            # Stage 2: parallel TTS with per-frame progress
            total_frames = len(narration_texts)
            logger.info(
                "video_stage_tts_start  session=%s  backend=%s  frames=%d",
                session_id, tts_backend, total_frames,
            )
            yield _sse({
                "type": "stage", "stage": "tts",
                "message": "Generating audio", "total": total_frames, "elapsed_s": elapsed(),
            })

            progress_queue: asyncio.Queue[int] = asyncio.Queue()
            t2 = time.time()
            tts_task = asyncio.create_task(
                generate_audio_parallel(
                    narration_texts, str(safe_output_dir), use_openai_tts, progress_queue
                )
            )
            for _ in range(total_frames):
                frame_idx = await progress_queue.get()
                yield _sse({
                    "type": "tts_progress",
                    "frame": frame_idx + 1, "total": total_frames, "elapsed_s": elapsed(),
                })

            audio_paths = await tts_task
            d2 = round(time.time() - t2, 1)
            audio_ok = sum(1 for p in audio_paths if p)
            logger.info(
                "video_stage_tts_done  session=%s  generated=%d/%d  duration=%.1fs",
                session_id, audio_ok, total_frames, d2,
            )
            yield _sse({
                "type": "stage_done", "stage": "tts",
                "generated": audio_ok, "total": total_frames,
                "duration_s": d2, "elapsed_s": elapsed(),
            })

            # Stage 3: assemble — heartbeat every 20s to prevent nginx proxy_read_timeout
            logger.info(
                "video_stage_assemble_start  session=%s  output=%s",
                session_id, video_path,
            )
            yield _sse({
                "type": "stage", "stage": "assembling",
                "message": "Assembling video", "elapsed_s": elapsed(),
            })

            t3 = time.time()
            # HIGH-2: blocking subprocess (ffmpeg) — run in thread pool
            assemble_task = asyncio.create_task(
                asyncio.to_thread(
                    assemble, normalized_pngs, audio_paths,
                    narration_texts, video_path, captions,
                )
            )

            while not assemble_task.done():
                try:
                    await asyncio.wait_for(asyncio.shield(assemble_task), timeout=20.0)
                except asyncio.TimeoutError:
                    yield _sse({"type": "heartbeat", "elapsed_s": elapsed()})

            await assemble_task
            d3 = round(time.time() - t3, 1)
            logger.info(
                "video_stage_assemble_done  session=%s  path=%s  duration=%.1fs",
                session_id, video_path, d3,
            )

            update_session(session_id, video_path=video_path)

            total = elapsed()
            logger.info(
                "video_generation_done  session=%s  frames=%d  tts=%s  total=%.1fs",
                session_id, len(normalized_pngs), tts_backend, total,
            )
            yield _sse({
                "type":        "done",
                "session_id":  session_id,
                "video_path":  video_path,
                "frame_count": len(normalized_pngs),
                "tts_backend": tts_backend,
                "elapsed_s":   total,
                "stage_times": {"export_s": d1, "tts_s": d2, "assembly_s": d3},
            })

        except Exception:
            # CRIT-6: log full details server-side; send generic message to client.
            logger.error(
                "video_generation_failed  session=%s  elapsed=%.1fs",
                session_id, elapsed(), exc_info=True,
            )
            yield _sse({
                "type":      "error",
                "message":   "Video generation failed. Please try again.",
                "elapsed_s": elapsed(),
            })

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=_SSE_HEADERS)


# ── Video download (CRIT-2, CRIT-3) ──────────────────────────────────────────

@router.get("/api/sessions/{session_id}/video")
def get_session_video(
    session_id:  str,
    request:     Request,
    token:       str = Query(default=""),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
):
    """
    Stream the generated .mp4 video with Range request support.

    CRIT-2: Accepts EITHER:
      - ?token=<media_token> query param — for browser <video src> elements that
        cannot set Authorization headers. The media token is short-lived (5 min)
        and session-scoped, issued by POST /api/sessions/{id}/media-token.
      - Authorization: Bearer <access_jwt> — for programmatic / API clients.

    CRIT-3: video_path from DB is validated against OUTPUTS_DIR before serving.
    """
    # Resolve user from media token or Bearer JWT (no Authorization header required
    # for browser <video src> clients using ?token=).
    current_user = resolve_media_user(token, session_id, credentials)

    with get_db() as conn:
        row = conn.execute(
            "SELECT video_path FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user.id),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    if not row["video_path"]:
        raise HTTPException(status_code=404, detail="Video not yet generated for this session")

    # CRIT-3: validate path before serving
    safe_video = _safe_video_path(row["video_path"])
    if not safe_video.exists():
        raise HTTPException(status_code=404, detail="Video file missing from disk")

    file_size    = safe_video.stat().st_size
    range_header = request.headers.get("range")

    if range_header:
        try:
            range_val          = range_header.replace("bytes=", "")
            start_str, end_str = range_val.split("-")
            start = int(start_str)
            end   = int(end_str) if end_str else file_size - 1
        except ValueError:
            raise HTTPException(status_code=416, detail="Invalid Range header")

        if start >= file_size or start > end:
            raise HTTPException(status_code=416, detail="Range Not Satisfiable")

        end        = min(end, file_size - 1)
        chunk_size = end - start + 1

        def iter_chunk():
            with open(safe_video, "rb") as f:
                f.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    data = f.read(min(65536, remaining))
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        headers = {
            "Content-Range":  f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges":  "bytes",
            "Content-Length": str(chunk_size),
            "Content-Type":   "video/mp4",
        }
        return StreamingResponse(iter_chunk(), status_code=206, headers=headers)

    def iter_full():
        with open(safe_video, "rb") as f:
            while chunk := f.read(65536):
                yield chunk

    headers = {
        "Content-Length":      str(file_size),
        "Accept-Ranges":       "bytes",
        "Content-Type":        "video/mp4",
        "Content-Disposition": f'inline; filename="lesson_{session_id[:8]}.mp4"',
    }
    return StreamingResponse(iter_full(), status_code=200, headers=headers)
