"""
Generation router — handles the main image/frame generation pipeline.

Fixes applied:
  CRIT-6: Exception detail is never forwarded to the client; only a generic
          message is returned. Full traceback is logged server-side.
  HIGH-2: activity_log.json writes are run in asyncio.to_thread() so they
          don't block the event loop during the I/O-bound persist step.
"""

import asyncio
import json
import logging
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from core.db_models import User
from core.responses import success
from core.database import (
    get_db,
    insert_conversation,
    touch_conversation,
    insert_session,
    update_session,
    session_output_dir,
    now_iso,
)
from services.frame_generation.planner import request_log, token_usage, request_llm_service, _log
from services.generation_service import (
    run_generation_pipeline,
    build_conversation_context,
    count_llm_calls,
)
from services.llm_service import LLMService, OpenAIProvider, ClaudeProvider
from dependencies.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# M-3: Rate limiter — 10 generation requests per minute per IP.
# Protects against LLM cost abuse without affecting normal usage patterns.
_limiter = Limiter(key_func=get_remote_address)


def _write_activity_log(output_dir: str, lifecycle_log: list) -> None:
    """Synchronous helper — called via asyncio.to_thread() (HIGH-2)."""
    with open(f"{output_dir}/activity_log.json", "w") as f:
        json.dump(lifecycle_log, f, indent=2)


@router.post("/api/image_generation")
@_limiter.limit("10/minute")
async def image_generation(
    request:             Request,
    message:             str  = Form(""),
    conversation_id:     Optional[str] = Form(None),
    pause_session_id:    Optional[str] = Form(None),
    pause_frame_index:   Optional[int] = Form(None),
    pause_caption:       Optional[str] = Form(None),
    parent_session_id:   Optional[str] = Form(None),
    parent_frame_index:  Optional[int] = Form(None),
    notes_enabled:       bool = Form(False),
    provider:            str  = Form("claude"),
    model:               Optional[str] = Form(None),
    render_mode:         Optional[str] = Form(None),   # 'manim' | 'svg' | 'mermaid' | None
    current_user:        User = Depends(get_current_user),
):
    session_id = uuid.uuid4().hex
    output_dir = session_output_dir(session_id)
    start_time = time.time()

    # ── Resolve conversation ───────────────────────────────────────────────────
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

    # ── Build conversation context for follow-up turns ─────────────────────────
    conversation_context = ""
    if turn_index > 1:
        conversation_context = build_conversation_context(
            conversation_id=conversation_id,
            current_session_id=session_id,
            pause_session_id=pause_session_id,
            pause_frame_index=pause_frame_index,
            pause_caption=pause_caption,
        )
        if conversation_context:
            logger.info(
                "Conversation context built  session=%s  turn=%d  chars=%d  has_pause=%s",
                session_id, turn_index, len(conversation_context), pause_session_id is not None,
            )

    # ── Set up per-request context vars ───────────────────────────────────────
    lifecycle_log: list = []
    log_token   = request_log.set(lifecycle_log)
    usage_acc   = {
        "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0,
        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
    }
    usage_token = token_usage.set(usage_acc)

    _llm_provider = (
        OpenAIProvider(model=model) if provider == "openai" else ClaudeProvider(model=model)
    ) if model else (
        OpenAIProvider() if provider == "openai" else ClaudeProvider()
    )
    model_name = _llm_provider.model
    svc_token  = request_llm_service.set(LLMService(provider=_llm_provider))

    _log({"event": "request_received", "prompt": message, "session_id": session_id, "model": model_name})
    logger.info("Request received  session=%s  prompt=%r", session_id, message[:120])

    try:
        result_payload = await run_generation_pipeline(
            message=message,
            session_id=session_id,
            output_dir=output_dir,
            conversation_context=conversation_context,
            notes_enabled=notes_enabled,
            forced_render_mode=render_mode,
        )

        # ── Persist ──────────────────────────────────────────────────────────
        duration_ms    = int((time.time() - start_time) * 1000)
        api_call_count = count_llm_calls(lifecycle_log)
        final_usage    = token_usage.get() or {}

        _log({"event": "request_complete", "duration_ms": duration_ms, "session_id": session_id})
        logger.info(
            "Request complete  session=%s  render_path=%s  duration_ms=%d  llm_calls=%d"
            "  tokens=%d  cache_read=%d  cache_create=%d",
            session_id, result_payload.get("render_path"), duration_ms, api_call_count,
            final_usage.get("total_tokens", 0),
            final_usage.get("cache_read_input_tokens", 0),
            final_usage.get("cache_creation_input_tokens", 0),
        )

        # HIGH-2: write to disk in thread pool — don't block the event loop
        await asyncio.to_thread(_write_activity_log, output_dir, lifecycle_log)

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
        )

        result_payload["conversation_id"]    = conversation_id
        result_payload["turn_index"]         = turn_index
        result_payload["parent_session_id"]  = parent_session_id
        result_payload["parent_frame_index"] = parent_frame_index
        return success(result_payload)

    except Exception as exc:
        # CRIT-6: Log full details server-side; never forward exception text to client.
        logger.error(
            "generation_failed  session=%s  error=%s",
            session_id, exc, exc_info=True,
        )
        _log({"event": "error", "error": str(exc)})
        # HIGH-2: persist error log in thread pool as well
        await asyncio.to_thread(_write_activity_log, output_dir, lifecycle_log)
        update_session(session_id, status="error")
        raise HTTPException(
            status_code=500,
            detail="Generation failed. Please try again.",
        )

    finally:
        request_log.reset(log_token)
        token_usage.reset(usage_token)
        request_llm_service.reset(svc_token)
