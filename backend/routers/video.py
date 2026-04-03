"""
Video router — SSE-streamed video generation and video download.
"""

import asyncio
import json
import logging
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from core.database import get_db, update_session
from services.video.frame_exporter import export_frames
from services.video.tts_service import parse_narration, generate_audio_parallel
from services.video.video_assembler import assemble, moviepy_available

logger = logging.getLogger(__name__)

router = APIRouter()

_SSE_HEADERS = {
    "Cache-Control":    "no-cache",
    "X-Accel-Buffering": "no",
    "Connection":       "keep-alive",
}


def _sse(payload: dict) -> str:
    """Format one Server-Sent Event: 'data: <json>\\n\\n'"""
    return f"data: {json.dumps(payload)}\n\n"


@router.post("/api/generate_video/{session_id}")
async def generate_video(session_id: str, use_openai_tts: bool = False):
    """
    Generate a video for an existing session — streams progress via SSE.

    Event types:
      {"type": "stage",        "stage": "export_frames" | "tts" | "assembling", ...}
      {"type": "stage_done",   "stage": ..., "duration_s": ..., ...}
      {"type": "tts_progress", "frame": N, "total": N}
      {"type": "heartbeat",    "elapsed_s": ...}
      {"type": "done",         "session_id": ..., "video_path": ..., ...}
      {"type": "error",        "message": ...}

    NOTE: use_openai_tts defaults to False (free gTTS). Pass ?use_openai_tts=true
    to use OpenAI TTS (requires OPENAI_API_KEY and will incur API costs).
    """
    if not moviepy_available():
        raise HTTPException(status_code=503, detail="moviepy not installed — run: pip install moviepy")

    with get_db() as conn:
        row = conn.execute(
            "SELECT output_dir, frame_count, status, render_path, video_path FROM sessions WHERE id = ?",
            (session_id,),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    if row["status"] != "done":
        raise HTTPException(status_code=400, detail=f"Session not ready (status: {row['status']})")

    output_dir = row["output_dir"]
    if not output_dir or not os.path.isdir(output_dir):
        raise HTTPException(status_code=404, detail="Session output directory missing")

    frames_path = os.path.join(output_dir, "frames.json")
    if not os.path.exists(frames_path):
        raise HTTPException(status_code=404, detail="frames.json not found — re-run image generation")

    narration_path = os.path.join(output_dir, "narration.txt")
    if not os.path.exists(narration_path):
        raise HTTPException(status_code=404, detail="narration.txt not found")

    with open(frames_path) as f:
        captions = json.load(f).get("captions", [])

    with open(narration_path) as f:
        narration_texts = parse_narration(f.read())

    # Pad/trim narration list to match caption count
    while len(narration_texts) < len(captions):
        narration_texts.append("")
    narration_texts = narration_texts[: len(captions)]

    video_path  = os.path.join(output_dir, "final_video.mp4")
    tts_backend = "openai" if use_openai_tts else "gtts"

    # Idempotency: video already exists — emit a single "done" event
    if row["video_path"] and os.path.exists(row["video_path"]):
        logger.info("Video already exists — returning cached  session=%s", session_id)

        async def _cached_stream():
            yield _sse({
                "type":        "done",
                "session_id":  session_id,
                "video_path":  row["video_path"],
                "frame_count": row["frame_count"],
                "tts_backend": "cached",
            })

        return StreamingResponse(_cached_stream(), media_type="text/event-stream", headers=_SSE_HEADERS)

    async def event_stream():
        import time
        t_start = time.time()

        def elapsed() -> float:
            return round(time.time() - t_start, 1)

        try:
            # Stage 1: normalize frames to 1920×1080 PNGs
            logger.info("Video stage 1/3: frame export  session=%s  frames=%d", session_id, len(captions))
            yield _sse({"type": "stage", "stage": "export_frames",
                        "message": "Exporting frames", "elapsed_s": elapsed()})

            t1 = time.time()
            normalized_pngs = await asyncio.to_thread(export_frames, output_dir, captions)
            d1 = round(time.time() - t1, 1)

            logger.info("Frame export done  session=%s  exported=%d  duration=%.1fs",
                        session_id, len(normalized_pngs), d1)
            yield _sse({"type": "stage_done", "stage": "export_frames",
                        "count": len(normalized_pngs), "duration_s": d1, "elapsed_s": elapsed()})

            # Stage 2: parallel TTS with per-frame progress
            total_frames = len(narration_texts)
            logger.info("Video stage 2/3: TTS  session=%s  backend=%s  frames=%d",
                        session_id, tts_backend, total_frames)
            yield _sse({"type": "stage", "stage": "tts", "message": "Generating audio",
                        "total": total_frames, "elapsed_s": elapsed()})

            progress_queue: asyncio.Queue[int] = asyncio.Queue()
            t2 = time.time()
            tts_task = asyncio.create_task(
                generate_audio_parallel(narration_texts, output_dir, use_openai_tts, progress_queue)
            )
            for _ in range(total_frames):
                frame_idx = await progress_queue.get()
                yield _sse({"type": "tts_progress", "frame": frame_idx + 1,
                            "total": total_frames, "elapsed_s": elapsed()})

            audio_paths = await tts_task
            d2 = round(time.time() - t2, 1)
            audio_ok = sum(1 for p in audio_paths if p)
            logger.info("TTS done  session=%s  generated=%d/%d  duration=%.1fs",
                        session_id, audio_ok, total_frames, d2)
            yield _sse({"type": "stage_done", "stage": "tts", "generated": audio_ok,
                        "total": total_frames, "duration_s": d2, "elapsed_s": elapsed()})

            # Stage 3: assemble — heartbeat every 20s to prevent nginx proxy_read_timeout
            logger.info("Video stage 3/3: assembly  session=%s  output=%s", session_id, video_path)
            yield _sse({"type": "stage", "stage": "assembling",
                        "message": "Assembling video", "elapsed_s": elapsed()})

            t3 = time.time()
            assemble_task = asyncio.create_task(
                asyncio.to_thread(assemble, normalized_pngs, audio_paths, narration_texts, video_path, captions)
            )

            while not assemble_task.done():
                try:
                    await asyncio.wait_for(asyncio.shield(assemble_task), timeout=20.0)
                except asyncio.TimeoutError:
                    yield _sse({"type": "heartbeat", "elapsed_s": elapsed()})

            await assemble_task
            d3 = round(time.time() - t3, 1)
            logger.info("Video assembly complete  session=%s  path=%s  duration=%.1fs",
                        session_id, video_path, d3)

            update_session(session_id, video_path=video_path)

            total = elapsed()
            logger.info(
                "Video generation done  session=%s  frames=%d  tts=%s  total=%.1fs",
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

        except Exception as e:
            logger.error("Video SSE stream failed  session=%s  elapsed=%.1fs",
                         session_id, elapsed(), exc_info=True)
            yield _sse({"type": "error", "message": str(e), "elapsed_s": elapsed()})

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=_SSE_HEADERS)


@router.get("/api/sessions/{session_id}/video")
def get_session_video(session_id: str):
    """Stream the generated .mp4 video for a session."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT video_path FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    if not row["video_path"]:
        raise HTTPException(status_code=404, detail="Video not yet generated for this session")

    video_path = row["video_path"]
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video file missing from disk")

    return FileResponse(video_path, media_type="video/mp4",
                        filename=f"lesson_{session_id[:8]}.mp4")
