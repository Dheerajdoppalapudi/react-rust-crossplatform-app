"""
Generation router — handles the main image/frame generation pipeline.
"""

import json
import logging
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import JSONResponse

from core.database import (
    get_db,
    insert_conversation,
    touch_conversation,
    insert_session,
    update_session,
    session_output_dir,
    now_iso,
)
from services.Frame_generation.planner import request_log, token_usage, request_llm_service, _log
from services.generation_service import (
    run_generation_pipeline,
    build_conversation_context,
    count_llm_calls,
)
from services.llm_service import LLMService, OpenAIProvider, ClaudeProvider

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/api/image_generation")
async def image_generation(
    message:             str  = Form(""),
    conversation_id:     Optional[str] = Form(None),
    pause_session_id:    Optional[str] = Form(None),
    pause_frame_index:   Optional[int] = Form(None),
    pause_caption:       Optional[str] = Form(None),
    parent_session_id:   Optional[str] = Form(None),
    parent_frame_index:  Optional[int] = Form(None),
    notes_enabled:       str  = Form("false"),
    provider:            str  = Form("claude"),
    model:               Optional[str] = Form(None),
):
    session_id = uuid.uuid4().hex
    output_dir = session_output_dir(session_id)
    start_time = time.time()

    # ── Resolve conversation ───────────────────────────────────────────────────
    if not conversation_id:
        conversation_id = uuid.uuid4().hex
        insert_conversation(conversation_id, message[:80])
        turn_index = 1
    else:
        with get_db() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS cnt FROM sessions WHERE conversation_id = ?",
                (conversation_id,),
            ).fetchone()
            turn_index = (row["cnt"] or 0) + 1

    insert_session(
        session_id, message, conversation_id, turn_index,
        parent_session_id=parent_session_id,
        parent_frame_index=parent_frame_index,
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
    usage_acc   = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
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
            notes_enabled=notes_enabled.lower() == "true",
        )

        # ── Persist ──────────────────────────────────────────────────────────
        duration_ms    = int((time.time() - start_time) * 1000)
        api_call_count = count_llm_calls(lifecycle_log)
        final_usage    = token_usage.get() or {}

        _log({"event": "request_complete", "duration_ms": duration_ms, "session_id": session_id})
        logger.info(
            "Request complete  session=%s  render_path=%s  duration_ms=%d  llm_calls=%d",
            session_id, result_payload.get("render_path"), duration_ms, api_call_count,
        )

        with open(f"{output_dir}/activity_log.json", "w") as f:
            json.dump(lifecycle_log, f, indent=2)

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
        return result_payload

    except Exception as exc:
        logger.error("Request failed  session=%s  error=%s", session_id, exc, exc_info=True)
        _log({"event": "error", "error": str(exc)})
        with open(f"{output_dir}/activity_log.json", "w") as f:
            json.dump(lifecycle_log, f, indent=2)
        update_session(session_id, status="error")
        raise HTTPException(status_code=500, detail=str(exc))

    finally:
        request_log.reset(log_token)
        token_usage.reset(usage_token)
        request_llm_service.reset(svc_token)


@router.post("/api/chat")
async def chat(message: str = Form("")):
    # NOTE: This is a stub endpoint. See TASK 2 flag — confirm with team if it should be removed.
    return {"reply": message}
