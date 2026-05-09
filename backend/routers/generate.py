"""
Unified generation router — single SSE endpoint for all AI generation.

Replaces /api/image_generation (JSON) and /api/interactive_generation (SSE).
Every mode — instant video, instant interactive, deep research video,
deep research interactive — flows through POST /api/generate.

SSE event schema (all modes share the same envelope):
  Research phase (deep_research only):
    {type:'stage',         stage:'decomposing'|'searching'|'reading'|'synthesising', label}
    {type:'stage_done',    stage, duration_s}
    {type:'source',        source:{title,url,snippet,domain,score}}
    {type:'token',         text}          — synthesis tokens stream word by word
    {type:'synthesis_done',sources:[...]}

  Visual phase — interactive:
    {type:'stage',  stage:'designing', label}
    {type:'meta',   title, follow_ups, learning_objective}
    {type:'block',  block:{...}}

  Visual phase — video:
    {type:'stage',         stage:'planning'|'generating_frames', label}
    {type:'stage_done',    stage, duration_s}
    {type:'frame',         index, image, caption}

  Shared:
    {type:'heartbeat',  elapsed_s}
    {type:'done',       session_id, conversation_id, turn_index, render_path, ...}
    {type:'error',      message}
"""

import asyncio
import json
import logging
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from core.db_models import User
from core.database import (
    get_db,
    insert_conversation,
    touch_conversation,
    insert_session,
    update_session,
    session_output_dir,
)
from services.frame_generation.planner import request_log, token_usage, request_llm_service, _log
from services.generation_service import (
    run_generation_pipeline_stream,
    run_text_pipeline_stream,
    build_conversation_context,
    build_interactive_context,
    count_llm_calls,
)
from services.llm_service import LLMService, OpenAIProvider, ClaudeProvider
from services.research.research_service import run_deep_research, run_followup_research
from dependencies.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()
_limiter = Limiter(key_func=get_remote_address)

HEARTBEAT_INTERVAL = 20  # seconds


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _write_activity_log(output_dir: str, lifecycle_log: list) -> None:
    try:
        with open(f"{output_dir}/activity_log.json", "w") as f:
            json.dump(lifecycle_log, f, indent=2)
    except Exception:
        pass


@router.post("/api/generate")
@_limiter.limit("10/minute")
async def generate(
    request:             Request,
    message:             str           = Form(""),
    conversation_id:     Optional[str] = Form(None),
    pause_session_id:    Optional[str] = Form(None),
    pause_frame_index:   Optional[int] = Form(None),
    pause_caption:       Optional[str] = Form(None),
    parent_session_id:   Optional[str] = Form(None),
    parent_frame_index:  Optional[int] = Form(None),
    notes_enabled:       bool          = Form(False),
    provider:            str           = Form("claude"),
    model:               Optional[str] = Form(None),
    render_mode:         Optional[str] = Form(None),
    video_enabled:       bool          = Form(False),
    research_mode:       str           = Form("instant"),   # "instant" | "deep_research"
    uploaded_file_ids:   Optional[str] = Form(None),        # comma-separated UUIDs
    research_context:    Optional[str] = Form(None),        # pre-synthesised text (internal)
    current_user:        User          = Depends(get_current_user),
):
    """
    Unified SSE generation endpoint. Handles all four combinations:
      instant     + interactive
      instant     + video
      deep_research + interactive
      deep_research + video
    """
    session_id = uuid.uuid4().hex
    output_dir = session_output_dir(session_id)
    start_time = time.time()

    # ── Resolve / create conversation ─────────────────────────────────────────
    if not conversation_id:
        conversation_id = uuid.uuid4().hex
        insert_conversation(conversation_id, message[:80], user_id=current_user.id)
        turn_index = 1
    else:
        with get_db() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS cnt FROM sessions WHERE conversation_id = ? AND user_id = ?",
                (conversation_id, current_user.id),
            ).fetchone()
            turn_index = (row["cnt"] or 0) + 1

    insert_session(
        session_id, message, conversation_id, turn_index,
        parent_session_id=parent_session_id,
        parent_frame_index=parent_frame_index,
        user_id=current_user.id,
    )
    touch_conversation(conversation_id)

    # ── Conversation context ──────────────────────────────────────────────────
    if video_enabled:
        conversation_context = build_conversation_context(
            parent_session_id=parent_session_id,
            pause_session_id=pause_session_id,
            pause_frame_index=pause_frame_index,
            pause_caption=pause_caption,
        ) if (parent_session_id or pause_session_id) else ""
    else:
        conversation_context = build_interactive_context(
            parent_session_id=parent_session_id,
        ) if parent_session_id else ""

    # If caller pre-synthesised research context, prepend it
    if research_context:
        conversation_context = research_context + (
            "\n\n---\n\n" + conversation_context if conversation_context else ""
        )

    # ── LLM provider setup ────────────────────────────────────────────────────
    _llm_provider = (
        OpenAIProvider(model=model) if provider == "openai" else ClaudeProvider(model=model)
    ) if model else (
        OpenAIProvider() if provider == "openai" else ClaudeProvider()
    )
    model_name = _llm_provider.model

    # Capture params for the stream closure (avoid cell-var issues)
    _params = dict(
        session_id=session_id,
        output_dir=output_dir,
        message=message,
        conversation_id=conversation_id,
        turn_index=turn_index,
        parent_session_id=parent_session_id,
        parent_frame_index=parent_frame_index,
        conversation_context=conversation_context,
        notes_enabled=notes_enabled,
        render_mode=render_mode,
        video_enabled=video_enabled,
        research_mode=research_mode,
        uploaded_file_ids=uploaded_file_ids,
        model_name=model_name,
        start_time=start_time,
        llm_provider=_llm_provider,
        current_user=current_user,
    )

    return StreamingResponse(
        _generate_stream(_params),
        media_type="text/event-stream",
        headers={
            "Cache-Control":   "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _generate_stream(p: dict):
    """
    The core SSE generator. All four generation paths flow through here.
    p is the params dict captured above.
    """
    session_id          = p["session_id"]
    output_dir          = p["output_dir"]
    message             = p["message"]
    conversation_id     = p["conversation_id"]
    turn_index          = p["turn_index"]
    parent_session_id   = p["parent_session_id"]
    parent_frame_index  = p["parent_frame_index"]
    conversation_context = p["conversation_context"]
    notes_enabled       = p["notes_enabled"]
    render_mode         = p["render_mode"]
    video_enabled       = p["video_enabled"]
    research_mode       = p["research_mode"]
    uploaded_file_ids   = p["uploaded_file_ids"]
    model_name          = p["model_name"]
    start_time          = p["start_time"]
    llm_provider        = p["llm_provider"]
    current_user        = p["current_user"]

    # ContextVars must be set inside the generator
    lifecycle_log: list = []
    log_token   = request_log.set(lifecycle_log)
    usage_acc   = {
        "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0,
        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
    }
    usage_token  = token_usage.set(usage_acc)
    svc_token    = request_llm_service.set(LLMService(provider=llm_provider))

    # Accumulate stages as events flow — saved to DB at the end for persistence.
    stages_log: list[dict] = []

    def _apply_stage_log(event: dict) -> None:
        if event["type"] == "stage":
            existing = next((s for s in stages_log if s["id"] == event["stage"]), None)
            if existing:
                existing["status"] = "active"
                existing["label"]  = event.get("label", existing["label"])
            else:
                stages_log.append({
                    "id":     event["stage"],
                    "label":  event.get("label", event["stage"]),
                    "status": "active",
                })
        elif event["type"] == "stage_done":
            for s in stages_log:
                if s["id"] == event["stage"]:
                    s["status"]     = "done"
                    s["duration_s"] = event.get("duration_s")
                    break

    _log({"event": "request_received", "prompt": message,
          "session_id": session_id, "model": model_name,
          "research_mode": research_mode, "video_enabled": video_enabled})

    # Heartbeat task — fires every HEARTBEAT_INTERVAL seconds
    heartbeat_queue: asyncio.Queue = asyncio.Queue()

    async def _heartbeat():
        t = start_time
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            await heartbeat_queue.put({"type": "heartbeat", "elapsed_s": round(time.time() - t, 1)})

    heartbeat_task = asyncio.create_task(_heartbeat())

    try:
        effective_message = message
        sources:      list = []
        sources_full: list = []

        # ── DEEP RESEARCH PHASE ───────────────────────────────────────────────
        if research_mode == "deep_research":
            from services.research.file_extractor import extract_urls_from_text

            file_paths    = _resolve_file_ids(uploaded_file_ids, current_user.id)
            extra_urls    = extract_urls_from_text(message)
            clean_message = _strip_urls(message)
            llm_svc       = request_llm_service.get()

            # Load prior session's full sources for follow-up reuse
            prior_sources_full: list = []
            if parent_session_id:
                with get_db() as conn:
                    row = conn.execute(
                        "SELECT sources_json FROM sessions WHERE id = ? AND user_id = ?",
                        (parent_session_id, current_user.id),
                    ).fetchone()
                if row and row["sources_json"]:
                    prior_sources_full = json.loads(row["sources_json"])

            # Choose pipeline: follow-up (prior sources exist) vs full research
            if prior_sources_full:
                pipeline_gen = run_followup_research(
                    query=clean_message,
                    prior_sources=prior_sources_full,
                    conversation_context=conversation_context,
                    llm_service=llm_svc,
                )
            else:
                pipeline_gen = run_deep_research(
                    query=clean_message,
                    conversation_context=conversation_context,
                    file_paths=file_paths,
                    extra_urls=extra_urls,
                    llm_service=llm_svc,
                )

            async for event in pipeline_gen:
                while not heartbeat_queue.empty():
                    yield _sse(await heartbeat_queue.get())
                _apply_stage_log(event)
                if event["type"] == "synthesis_done":
                    sources_full      = event.pop("sources_full", [])
                    effective_message = event["synthesized_text"]
                    sources           = event["sources"]
                yield _sse(event)

        # ── VISUAL GENERATION PHASE ───────────────────────────────────────────
        result_payload: dict = {}

        if video_enabled:
            pipeline = run_generation_pipeline_stream(
                message=effective_message,
                session_id=session_id,
                output_dir=output_dir,
                conversation_context=conversation_context,
                notes_enabled=notes_enabled,
                forced_render_mode=render_mode,
            )
        else:
            pipeline = run_text_pipeline_stream(
                message=effective_message,
                session_id=session_id,
                output_dir=output_dir,
                conversation_context=conversation_context,
            )

        async for event in pipeline:
            while not heartbeat_queue.empty():
                yield _sse(await heartbeat_queue.get())
            _apply_stage_log(event)
            if event["type"] == "result":
                result_payload = event["payload"]
            else:
                yield _sse(event)

        # ── FINALISE ──────────────────────────────────────────────────────────
        duration_ms    = int((time.time() - start_time) * 1000)
        api_call_count = count_llm_calls(lifecycle_log)
        final_usage    = token_usage.get() or {}

        _log({"event": "request_complete", "duration_ms": duration_ms, "session_id": session_id})
        logger.info(
            "generate_complete  session=%s  render_path=%s  research=%s  video=%s  "
            "duration_ms=%d  llm_calls=%d  tokens=%d",
            session_id, result_payload.get("render_path"), research_mode, video_enabled,
            duration_ms, api_call_count, final_usage.get("total_tokens", 0),
        )

        await asyncio.to_thread(_write_activity_log, output_dir, lifecycle_log)

        # Ensure no stage is left active before persisting — any stage that didn't
        # receive an explicit stage_done is finalized here so reloads show correctly.
        for s in stages_log:
            if s.get("status") == "active":
                s["status"] = "done"

        # Persist session
        update_session(
            session_id,
            status="done",
            intent_type=result_payload.get("intent_type"),
            render_path=result_payload.get("render_path"),
            frame_count=result_payload.get("frame_count"),
            output_dir=output_dir,
            ui_output_file=result_payload.pop("ui_output_file", None),
            api_call_count=api_call_count,
            prompt_tokens=final_usage.get("prompt_tokens", 0),
            completion_tokens=final_usage.get("completion_tokens", 0),
            total_tokens=final_usage.get("total_tokens", 0),
            model_name=model_name,
            research_mode=research_mode,
            sources_json=json.dumps(sources_full) if sources_full else (json.dumps(sources) if sources else None),
            stages_json=json.dumps(stages_log) if stages_log else None,
        )

        done_event = {
            "type":               "done",
            "session_id":         session_id,
            "conversation_id":    conversation_id,
            "turn_index":         turn_index,
            "parent_session_id":  parent_session_id,
            "parent_frame_index": parent_frame_index,
            **result_payload,
        }
        if sources:
            done_event["sources"] = sources

        yield _sse(done_event)

    except asyncio.CancelledError:
        logger.info("generate_cancelled  session=%s", session_id)
        update_session(session_id, status="error")
        raise

    except Exception as exc:
        logger.error("generate_failed  session=%s  error=%s", session_id, exc, exc_info=True)
        _log({"event": "error", "error": str(exc)})
        await asyncio.to_thread(_write_activity_log, output_dir, lifecycle_log)
        update_session(session_id, status="error")
        yield _sse({"type": "error", "message": "Generation failed. Please try again."})

    finally:
        heartbeat_task.cancel()
        request_log.reset(log_token)
        token_usage.reset(usage_token)
        request_llm_service.reset(svc_token)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_file_ids(uploaded_file_ids: Optional[str], user_id: str) -> list[str]:
    """Convert comma-separated file UUIDs to absolute paths under UPLOAD_DIR/<user_id>/."""
    if not uploaded_file_ids:
        return []
    from core.config import UPLOAD_DIR
    from pathlib import Path
    paths = []
    for fid in uploaded_file_ids.split(","):
        fid = fid.strip()
        if not fid:
            continue
        user_dir = Path(UPLOAD_DIR) / user_id
        # Find the file with any extension matching the UUID prefix
        matches = list(user_dir.glob(f"{fid}*")) if user_dir.exists() else []
        if matches:
            paths.append(str(matches[0]))
    return paths


def _strip_urls(text: str) -> str:
    """Remove bare URLs from a message so they don't appear in the prompt."""
    import re
    return re.sub(r'https?://\S+', '', text).strip()
