"""
Unified generation router — single SSE endpoint for all AI generation.

POST /api/generate handles all four mode combinations:
  instant     + interactive
  instant     + video
  deep_research + interactive
  deep_research + video

SSE event schema (all modes share the same envelope):
  Research phase (when search fires):
    {type:'stage',         stage:'thinking'|'searching'|'reading', label}
    {type:'stage_done',    stage, duration_s}
    {type:'source',        source:{title,url,snippet,domain}}

  Interactive phase:
    {type:'stage',         stage:'designing', label}
    {type:'meta',          title, follow_ups, learning_objective}
    {type:'block',         block:{...}}

  Video phase:
    {type:'stage',         stage:'planning'|'generating_frames', label}
    {type:'stage_done',    stage, duration_s}
    {type:'frame',         index, image, caption}

  Shared:
    {type:'init',          conversation_id}    ← fired first, before any LLM call
    {type:'token',         text}               ← video only: synthesis tokens
    {type:'heartbeat',     elapsed_s}
    {type:'done',          session_id, conversation_id, turn_index, render_path, ...}
    {type:'error',         message}
"""

import asyncio
import json
import structlog
import time
import uuid
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import StreamingResponse
from core.config import (
    ALLOWED_CLAUDE_MODELS,
    ALLOWED_OPENAI_MODELS,
    ALLOWED_GEMINI_MODELS,
    CONVERSATION_TITLE_MAX_CHARS,
    DEEP_SEARCH_SOURCES,
    DEEP_SOURCES_IN_ANSWER,
    FOLLOWUP_CONTEXT_TURNS,
    FOLLOWUP_TOP_K_SOURCES,
    HEARTBEAT_INTERVAL_SECS,
    INSTANT_MAX_QUERIES,
    DEEP_MAX_QUERIES,
    UPLOAD_DIR,
)
from core.cost import compute_session_cost
from core.limiter import limiter as _limiter, get_user_key
from core.db_async import (
    session_output_dir,
    insert_conversation,
    touch_conversation,
    insert_session,
    update_session,
)
from core.db_models import User
from services.frame_generation.planner import (
    plan_and_classify,
    request_log,
    token_usage,
    request_llm_service,
    _log,
)
from services.generation_service import (
    count_llm_calls,
    build_conversation_context,
    build_interactive_context,
    run_video_pipeline_from_intent,
)
from services.llm_service import LLMService, OpenAIProvider, ClaudeProvider, GeminiProvider
from services.research.file_extractor import extract_urls_from_text, extract_text
from services.research.search_provider import SearchResult, tavily
from services.research.source_processor import rank_and_deduplicate
from services.research.source_processor import source_summary, source_full
from services.research.vector_store import upsert_sources, retrieve_sources
from dependencies.auth import get_current_user

logger = structlog.get_logger(__name__)

router = APIRouter()

HEARTBEAT_INTERVAL = HEARTBEAT_INTERVAL_SECS

# H1: Strong references to fire-and-forget background tasks. Without this an
# asyncio task created in a cancellation handler can be garbage-collected
# before it runs, leaving the session stuck in 'pending'.
_BACKGROUND_TASKS: set = set()


def _spawn_bg(coro) -> None:
    """Schedule a fire-and-forget coroutine, retaining a strong reference."""
    task = asyncio.create_task(coro)
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _write_activity_log(output_dir: str, lifecycle_log: list, session_id: str = "") -> None:
    try:
        data = json.dumps(lifecycle_log, indent=2).encode()
        with open(f"{output_dir}/activity_log.json", "wb") as f:
            f.write(data)
        if session_id:
            from core.s3 import upload_activity_log
            upload_activity_log(data, session_id)
    except Exception as exc:
        logger.warning("activity_log_write_failed", output_dir=output_dir, error=str(exc))


@router.post("/generate")
@_limiter.limit("10/minute", key_func=get_user_key)
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
    uploaded_file_ids:   Optional[str] = Form(None),
    selected_text:       Optional[str] = Form(None),        # user-highlighted text for follow-up context
    current_user:        User          = Depends(get_current_user),
):
    # ── Input validation ──────────────────────────────────────────────────────
    from fastapi import HTTPException as _HTTPException
    message = (message or "").strip()
    if not message:
        raise _HTTPException(status_code=422, detail="message cannot be empty")
    if len(message) > 8000:
        raise _HTTPException(status_code=422, detail="message too long (max 8000 chars)")
    if research_mode not in ("instant", "deep_research"):
        raise _HTTPException(status_code=422, detail=f"invalid research_mode: {research_mode!r}")
    if render_mode is not None and render_mode not in ("manim", "svg"):
        raise _HTTPException(status_code=422, detail=f"invalid render_mode: {render_mode!r}")
    if model:
        if provider == "claude":
            _allowed = ALLOWED_CLAUDE_MODELS
        elif provider == "openai":
            _allowed = ALLOWED_OPENAI_MODELS
        elif provider == "gemini":
            _allowed = ALLOWED_GEMINI_MODELS
        else:
            _allowed = frozenset()
        if model not in _allowed:
            raise _HTTPException(status_code=422, detail=f"unsupported model: {model!r}")

    session_id = uuid.uuid4().hex
    output_dir = await asyncio.to_thread(session_output_dir, session_id)
    start_time = time.time()

    # ── Resolve / create conversation ─────────────────────────────────────────
    if not conversation_id:
        conversation_id = uuid.uuid4().hex
        await insert_conversation(
            conversation_id,
            message[:CONVERSATION_TITLE_MAX_CHARS],
            user_id=current_user.id,
        )
        # First turn — always 1, no need for an atomic lookup
        turn_index = await insert_session(
            session_id, message, conversation_id,
            turn_index=1,
            parent_session_id=parent_session_id,
            parent_frame_index=parent_frame_index,
            user_id=current_user.id,
        )
    else:
        # Atomic MAX()+1 inside insert_session eliminates the COUNT race condition
        turn_index = await insert_session(
            session_id, message, conversation_id,
            parent_session_id=parent_session_id,
            parent_frame_index=parent_frame_index,
            user_id=current_user.id,
        )
    await touch_conversation(conversation_id)

    # ── LLM provider ─────────────────────────────────────────────────────────
    if provider == "openai":
        _llm_provider = OpenAIProvider(model=model) if model else OpenAIProvider()
    elif provider == "gemini":
        _llm_provider = GeminiProvider(model=model) if model else GeminiProvider()
    else:
        _llm_provider = ClaudeProvider(model=model) if model else ClaudeProvider()
    model_name = _llm_provider.model if model else "auto"

    _params = dict(
        session_id=session_id,
        output_dir=output_dir,
        message=message,
        conversation_id=conversation_id,
        turn_index=turn_index,
        parent_session_id=parent_session_id,
        parent_frame_index=parent_frame_index,
        pause_session_id=pause_session_id,
        pause_frame_index=pause_frame_index,
        pause_caption=pause_caption,
        notes_enabled=notes_enabled,
        render_mode=render_mode,
        video_enabled=video_enabled,
        research_mode=research_mode,
        uploaded_file_ids=uploaded_file_ids,
        model_name=model_name,
        start_time=start_time,
        llm_provider=_llm_provider,
        current_user=current_user,
        selected_text=selected_text,
    )

    return StreamingResponse(
        _generate_stream(_params),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _generate_stream(p: dict):
    session_id        = p["session_id"]
    output_dir        = p["output_dir"]
    message           = p["message"]
    conversation_id   = p["conversation_id"]
    turn_index        = p["turn_index"]
    parent_session_id = p["parent_session_id"]
    parent_frame_index = p["parent_frame_index"]
    pause_session_id  = p["pause_session_id"]
    pause_frame_index = p["pause_frame_index"]
    pause_caption     = p["pause_caption"]
    notes_enabled     = p["notes_enabled"]
    render_mode       = p["render_mode"]
    video_enabled     = p["video_enabled"]
    research_mode     = p["research_mode"]
    uploaded_file_ids = p["uploaded_file_ids"]
    model_name        = p["model_name"]
    start_time        = p["start_time"]
    llm_provider      = p["llm_provider"]
    current_user      = p["current_user"]
    selected_text     = p.get("selected_text") or None

    # ContextVars must be set inside the generator
    lifecycle_log: list = []
    log_token   = request_log.set(lifecycle_log)
    usage_acc   = {
        "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0,
        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
    }
    usage_token  = token_usage.set(usage_acc)
    # Only set request_llm_service when the user explicitly selected a model.
    # When model_name == "auto", each call site uses its per-task configured service.
    _user_model = p.get("model_name") if p.get("model_name") != "auto" else None
    svc_token   = request_llm_service.set(LLMService(provider=llm_provider) if _user_model else None)

    stages_log: list[dict] = []

    def _apply_stage_log(event: dict) -> None:
        if event["type"] == "stage":
            existing = next((s for s in stages_log if s["id"] == event["stage"]), None)
            if existing:
                existing["status"] = "active"
                existing["label"]  = event.get("label", existing["label"])
                if event.get("queries"):
                    existing["queries"] = event["queries"]
            else:
                entry = {
                    "id":     event["stage"],
                    "label":  event.get("label", event["stage"]),
                    "status": "active",
                }
                if event.get("queries"):
                    entry["queries"] = event["queries"]
                stages_log.append(entry)
        elif event["type"] == "stage_done":
            for s in stages_log:
                if s["id"] == event["stage"]:
                    s["status"]     = "done"
                    s["duration_s"] = event.get("duration_s")
                    break

    _log({"event": "request_received", "prompt": message, "session_id": session_id,
          "model": model_name, "research_mode": research_mode, "video_enabled": video_enabled})

    # ── H2: single merged output queue ────────────────────────────────────────
    # All pipeline events AND heartbeats flow through one queue. The consumer
    # loop below drains it, so a heartbeat is delivered even while the pipeline
    # is awaiting a long synchronous step (e.g. plan_and_classify) that emits no
    # events of its own — the previous design only flushed heartbeats between
    # sub-generator iterations, leaving the longest steps unprotected.
    out_q: asyncio.Queue = asyncio.Queue()
    _STREAM_DONE = object()

    async def _emit(event: dict) -> None:
        await out_q.put(event)

    async def _heartbeat():
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            await out_q.put({"type": "heartbeat", "elapsed_s": round(time.time() - start_time, 1)})

    async def _produce():
        try:
            # ── 0. Init event — URL updates immediately ───────────────────────
            await _emit({"type": "init", "conversation_id": conversation_id})

            # ── 1. Conversation context ───────────────────────────────────────
            if video_enabled:
                if parent_session_id or pause_session_id:
                    conversation_context = await build_conversation_context(
                        parent_session_id=parent_session_id,
                        pause_session_id=pause_session_id,
                        pause_frame_index=pause_frame_index,
                        pause_caption=pause_caption,
                    )
                else:
                    conversation_context = ""
            else:
                if parent_session_id:
                    conversation_context = await build_interactive_context(
                        parent_session_id=parent_session_id,
                    )
                else:
                    conversation_context = ""

            # Append user text-selection context after the conversation history block
            if selected_text and selected_text.strip():
                _excerpt = selected_text.strip()
                _max_chars = 2000
                if len(_excerpt) > _max_chars:
                    _excerpt = _excerpt[:_max_chars] + "…"
                conversation_context += (
                    "\n## USER TEXT SELECTION CONTEXT\n"
                    "The user has highlighted the following excerpt from the lesson:\n"
                    f"\"{_excerpt}\"\n"
                    "Their follow-up question is specifically about this selected text. "
                    "Elaborate, clarify, or extend this concept in your response.\n\n"
                )

            # ── 2. Load prior synthesis_text from ancestor chain (branch-aware) ──
            prior_synthesis = await _load_prior_synthesis(parent_session_id, FOLLOWUP_CONTEXT_TURNS)

            # ── 3. Thinking stage + plan_and_classify ─────────────────────────
            short_q = message.strip()
            if len(short_q) > 60:
                short_q = short_q[:60].rsplit(' ', 1)[0] + '…'
            think_evt = {"type": "stage", "stage": "thinking", "label": f"Thinking about {short_q}"}
            _apply_stage_log(think_evt)
            await _emit(think_evt)
            t_think = time.time()

            intent = await plan_and_classify(
                message=message,
                research_mode=research_mode,
                video_enabled=video_enabled,
                conversation_context=conversation_context,
                prior_synthesis=prior_synthesis,
            )

            think_done = {"type": "stage_done", "stage": "thinking", "duration_s": round(time.time() - t_think, 2)}
            _apply_stage_log(think_done)
            await _emit(think_done)

            # ── 4. Search phase (conditional) ─────────────────────────────────
            sources:          list[dict] = []
            sources_full:     list[dict] = []   # top-N for LLM
            sources_all:      list[dict] = []   # all results for ChromaDB

            should_search = (research_mode == "deep_research") or intent.get("needs_search", False)

            # For instant follow-ups, try ChromaDB before hitting Tavily
            if should_search and parent_session_id and research_mode == "instant":
                cached = await retrieve_sources(
                    conversation_id, message, FOLLOWUP_TOP_K_SOURCES
                )
                if len(cached) >= 3:
                    sources      = cached
                    sources_full = cached
                    should_search = False
                    logger.info("chromadb_cache_hit", conv=conversation_id[:8], n=len(cached))

            if should_search:
                file_paths = _resolve_file_ids(uploaded_file_ids, current_user.id)
                extra_urls = extract_urls_from_text(message)

                async for event in _search_phase(
                    intent=intent,
                    message=message,
                    research_mode=research_mode,
                    conversation_id=conversation_id,
                    file_paths=file_paths,
                    extra_urls=extra_urls,
                    output_dir=output_dir,
                ):
                    if event["type"] == "_sources_ready":
                        sources      = event["sources"]
                        sources_full = event["sources_for_llm"]
                        sources_all  = event["sources_all"]
                        try:
                            from core.s3 import upload_sources_raw
                            raw_bytes = json.dumps(sources_all, indent=2).encode()
                            await asyncio.to_thread(upload_sources_raw, raw_bytes, session_id)
                        except Exception as _exc:
                            logger.warning("sources_raw_upload_failed", session=session_id, error=str(_exc))
                    else:
                        _apply_stage_log(event)
                        await _emit(event)

            # ── 5. Two-branch pipeline ─────────────────────────────────────────
            result_payload: dict = {}
            synthesis_text: str  = ""

            if video_enabled:
                # Synthesise sources → text for the frame planner
                if sources_full:
                    synth_evt = {"type": "stage", "stage": "synthesising", "label": "Synthesising answer…"}
                    _apply_stage_log(synth_evt)
                    await _emit(synth_evt)
                    t_synth = time.time()

                    from services.research.synthesiser import stream as synth_stream
                    from services.llm_service import get_task_service

                    llm_svc = request_llm_service.get() or get_task_service("synthesiser")
                    sr_list = [SearchResult(
                        title=s.get("title", ""), url=s.get("url", ""),
                        snippet=s.get("snippet", ""), content=s.get("content", ""),
                        domain=s.get("domain", ""), score=float(s.get("score", 0.5)),
                    ) for s in sources_full]

                    async for token in synth_stream(message, sr_list, llm_svc, conversation_context):
                        await _emit({"type": "token", "text": token})
                        synthesis_text += token

                    await _emit({"type": "synthesis_done"})

                    synth_done = {"type": "stage_done", "stage": "synthesising",
                                  "duration_s": round(time.time() - t_synth, 2)}
                    _apply_stage_log(synth_done)
                    await _emit(synth_done)

                async for event in run_video_pipeline_from_intent(
                    intent=intent,
                    synthesis_text=synthesis_text,
                    session_id=session_id,
                    output_dir=output_dir,
                    conversation_context=conversation_context,
                    notes_enabled=notes_enabled,
                    forced_render_mode=render_mode,
                ):
                    _apply_stage_log(event)
                    if event["type"] == "result":
                        result_payload = event["payload"]
                    else:
                        await _emit(event)

            else:
                # Interactive: scene planner gets raw sources + enriched_prompt
                from services.interactive.interactive_service import run_interactive_pipeline

                design_evt = {"type": "stage", "stage": "designing", "label": "Designing the lesson…"}
                _apply_stage_log(design_evt)
                await _emit(design_evt)
                t_design = time.time()

                result_payload = {
                    "session_id":          session_id,
                    "render_path":         "interactive",
                    "frame_count":         0,
                    "intent_type":         "general",
                    "suggested_followups": intent.get("suggested_followups", []),
                }

                async for event in run_interactive_pipeline(
                    original_message=message,
                    enriched_prompt=intent.get("enriched_prompt", ""),
                    session_id=session_id,
                    output_dir=output_dir,
                    conversation_context=conversation_context,
                    domain=intent.get("domain", "general"),
                    sources=sources_full,  # full content for scene planner citations
                ):
                    if event["type"] == "meta":
                        result_payload["suggested_followups"] = event.get("follow_ups", [])
                        await _emit(event)
                    elif event["type"] == "done":
                        # Use the pipeline's authoritative follow_ups (from the fully
                        # parsed SceneIR) rather than whatever the streaming meta prefix
                        # captured — field ordering in LLM output is not guaranteed.
                        if event.get("follow_ups"):
                            result_payload["suggested_followups"] = event["follow_ups"]
                    else:
                        if event["type"] in ("stage", "stage_done"):
                            _apply_stage_log(event)
                        await _emit(event)

                design_done = {"type": "stage_done", "stage": "designing",
                               "duration_s": round(time.time() - t_design, 2)}
                _apply_stage_log(design_done)
                await _emit(design_done)

            # ── 6. Finalise ────────────────────────────────────────────────────
            duration_ms    = int((time.time() - start_time) * 1000)
            api_call_count = count_llm_calls(lifecycle_log)
            final_usage    = token_usage.get() or {}
            # C4: compute the dollar cost of every LLM call in this session from
            # the per-call model + usage recorded in the lifecycle log.
            cost_usd       = compute_session_cost(lifecycle_log)

            _log({"event": "request_complete", "duration_ms": duration_ms, "session_id": session_id})
            logger.info(
                "generate_complete",
                session=session_id,
                render_path=result_payload.get("render_path"),
                research=research_mode,
                video=video_enabled,
                duration_ms=duration_ms,
                llm_calls=api_call_count,
                tokens=final_usage.get("total_tokens", 0),
                cost_usd=cost_usd,
            )

            await asyncio.to_thread(_write_activity_log, output_dir, lifecycle_log, session_id)

            for s in stages_log:
                if s.get("status") == "active":
                    s["status"] = "done"

            # Upsert ALL sources to ChromaDB (not just top-N) for richer follow-up retrieval
            if sources_all:
                await upsert_sources(conversation_id, sources_all)

            # frames_meta from the video pipeline (non-None for video mode).
            # For interactive mode, interactive_service already wrote frames_meta to
            # the DB — passing None here would overwrite and erase it.
            _frames_meta = result_payload.pop("frames_meta", None)
            _extra = {"frames_meta": _frames_meta} if _frames_meta is not None else {}

            await update_session(
                session_id,
                status="done",
                intent_type=result_payload.get("intent_type"),
                render_path=result_payload.get("render_path"),
                frame_count=result_payload.get("frame_count"),
                output_dir=output_dir,
                ui_output_file=result_payload.pop("ui_output_file", None),
                # Beat pipeline assembles session_final.mp4 directly — save it so the
                # video router can serve it without re-assembling with TTS.
                video_path=result_payload.get("video_path") or None,
                api_call_count=api_call_count,
                prompt_tokens=final_usage.get("prompt_tokens", 0),
                completion_tokens=final_usage.get("completion_tokens", 0),
                total_tokens=final_usage.get("total_tokens", 0),
                cost_usd=cost_usd,
                model_name=model_name,
                research_mode=research_mode,
                sources_json=sources or None,
                stages_json=stages_log or None,
                synthesis_text=synthesis_text or None,
                **_extra,
            )

            done_event: dict = {
                "type":               "done",
                "session_id":         session_id,
                "conversation_id":    conversation_id,
                "turn_index":         turn_index,
                "parent_session_id":  parent_session_id,
                "parent_frame_index": parent_frame_index,
                "cost_usd":           cost_usd,
                **result_payload,
            }
            if sources:
                done_event["sources"] = sources

            await _emit(done_event)

        except asyncio.CancelledError:
            logger.info("generate_cancelled", session=session_id)
            # H1: schedule the error-write with a retained strong reference so it
            # survives this task's teardown instead of being garbage-collected.
            _spawn_bg(update_session(session_id, status="error"))
            raise

        except Exception as exc:
            logger.error("generate_failed", session=session_id, error=str(exc), exc_info=True)
            _log({"event": "error", "error": str(exc)})
            await asyncio.to_thread(_write_activity_log, output_dir, lifecycle_log, session_id)
            await update_session(session_id, status="error")
            await _emit({"type": "error", "message": "Generation failed. Please try again."})

        finally:
            await out_q.put(_STREAM_DONE)

    # ── Consumer loop ─────────────────────────────────────────────────────────
    # The producer runs as its own task (inheriting this context, so it sees the
    # same lifecycle_log / token_usage / request_llm_service). The heartbeat task
    # feeds the same queue. We yield whatever arrives until the producer signals
    # completion.
    heartbeat_task = asyncio.create_task(_heartbeat())
    producer_task  = asyncio.create_task(_produce())

    try:
        while True:
            item = await out_q.get()
            if item is _STREAM_DONE:
                break
            yield _sse(item)
    finally:
        heartbeat_task.cancel()
        if not producer_task.done():
            producer_task.cancel()
        # Drain the producer so its cancellation handler (which marks the session
        # 'error' on client disconnect) runs to completion.
        try:
            await producer_task
        except (asyncio.CancelledError, Exception):
            pass
        request_log.reset(log_token)
        token_usage.reset(usage_token)
        request_llm_service.reset(svc_token)


# ── Search phase ──────────────────────────────────────────────────────────────

_DEEP_MAX_ROUNDS = 3  # maximum search rounds for deep_research mode

_GAP_ANALYSIS_SYSTEM = """\
You are a research gap analyzer. Given a user question, the queries already run, and a summary of what was found, identify what important angles are still missing and generate new targeted search queries to fill those gaps.

Rules:
- Write queries like a domain expert — specific terminology, precise framing, NOT "what is X" or "how does Y work"
- Each new query must target a distinct gap (mechanism, data, recent events, counterarguments, applications, comparisons)
- Do NOT repeat or paraphrase queries already run
- Return ONLY a JSON object with no markdown fences
- If existing results already cover the topic well enough, return {"new_queries": []}
- Maximum 3 new queries; fewer is better if only 1-2 gaps remain
"""


def _build_results_summary(results: list) -> str:
    """Compact summary of search results for gap analysis LLM input."""
    parts = []
    for i, r in enumerate(results[:8], 1):
        snippet = (getattr(r, "snippet", "") or getattr(r, "content", "") or "")[:250].strip()
        if snippet:
            parts.append(f"[{i}] {r.title}: {snippet}")
    return "\n\n".join(parts) if parts else "No results found."


async def _gap_analysis(
    user_question: str,
    results: list,
    prev_queries: list[str],
) -> list[str]:
    """
    Call Haiku to identify gaps in current search coverage and return new queries.
    Returns an empty list if coverage is already sufficient.
    """
    from services.llm_service import get_task_service
    from services.frame_generation.planner import _extract_json
    llm_svc = get_task_service("synthesiser")  # Haiku — fast classification-class call

    prev_q_str   = "\n".join(f"- {q}" for q in prev_queries)
    results_text = _build_results_summary(results)
    user_msg = (
        f"## User question\n{user_question}\n\n"
        f"## Queries already run\n{prev_q_str}\n\n"
        f"## Summary of results found so far\n{results_text}\n\n"
        "Identify the most important missing angles, then generate 0-3 new targeted search queries. "
        'Return JSON: {"new_queries": ["query1", "query2"]} or {"new_queries": []} if coverage is sufficient.'
    )

    try:
        raw, _ = await llm_svc.make_system_user_request_async(
            _GAP_ANALYSIS_SYSTEM,
            user_msg,
            max_tokens=300,
        )
        data    = _extract_json(raw)
        queries = data.get("new_queries", [])
        return [q.strip() for q in queries if isinstance(q, str) and q.strip()][:3]
    except Exception as exc:
        logger.warning("gap_analysis_failed", error=str(exc))
        return []


async def _search_phase(
    intent:          dict,
    message:         str,
    research_mode:   str,
    conversation_id: str,
    file_paths:      list[str],
    extra_urls:      list[str],
    output_dir:      str,
):
    """
    Unified search pipeline for instant (light) and deep_research (full) modes.

    For deep_research: runs up to _DEEP_MAX_ROUNDS iterative rounds. After each
    round an LLM gap-analysis call identifies what is still missing and generates
    new targeted queries for the next round. Stops early when gap analysis returns
    no new queries (sufficient coverage) or the round limit is reached.

    Yields SSE events and one internal sentinel:
      {type: '_sources_ready', sources, sources_for_llm, sources_all}

    sources          — summaries of ALL found results (for UI display and DB storage)
    sources_for_llm  — top-N for LLM injection (scene planner / synthesiser)
    sources_all      — all results for ChromaDB embedding

    The caller forwards all non-internal events to the client.
    """
    search_queries = intent.get("search_queries", [])
    max_queries    = DEEP_MAX_QUERIES if research_mode == "deep_research" else INSTANT_MAX_QUERIES
    queries_used   = search_queries[:max_queries]

    all_results:   list[SearchResult] = []
    all_queries_run: list[str]        = []

    # One semaphore for the entire request — caps total concurrent Tavily calls
    _tavily_sem = asyncio.Semaphore(3)
    _intent_domain = intent.get("domain", "")

    # For economics queries, bias Tavily toward financial data sources
    from services.research.source_processor import FINANCIAL_PRIORITY_DOMAINS
    _include_domains = (
        list(FINANCIAL_PRIORITY_DOMAINS) if _intent_domain == "economics" else []
    )

    async def _bounded_search(q: str) -> list:
        async with _tavily_sem:
            return await tavily.search(q, max_results=5, include_domains=_include_domains)

    max_rounds = _DEEP_MAX_ROUNDS if research_mode == "deep_research" else 1

    # ── Iterative search rounds ───────────────────────────────────────────────
    for round_n in range(max_rounds):
        if not queries_used:
            break

        n_q = len(queries_used)
        search_evt = {
            "type":    "stage",
            "stage":   "searching",
            "label":   f"Searching {n_q} {'query' if n_q == 1 else 'queries'}…" if round_n == 0
                       else f"Round {round_n + 1}: filling {n_q} gap{'s' if n_q != 1 else ''}…",
            "round":   round_n + 1,
            "queries": queries_used,
        }
        yield search_evt
        t_search = time.time()

        batches = await asyncio.gather(*[_bounded_search(q) for q in queries_used])

        round_results: list[SearchResult] = []
        for batch in batches:
            round_results.extend(batch)

        seen = {r.url for r in all_results}
        new_results = [r for r in round_results if r.url not in seen]
        all_results.extend(new_results)
        all_queries_run.extend(queries_used)

        # Emit source events for every new result — UI shows all, not just what LLM uses
        for r in new_results:
            yield {"type": "source", "source": source_summary(r)}

        yield {
            "type":          "stage_done",
            "stage":         "searching",
            "duration_s":    round(time.time() - t_search, 2),
            "sources_found": len(new_results),
        }

        # For deep research, run gap analysis to decide whether another round is needed
        if research_mode == "deep_research" and round_n < max_rounds - 1:
            queries_used = await _gap_analysis(message, all_results, all_queries_run)
            if not queries_used:
                break  # gap analysis says coverage is sufficient
        else:
            break

    # ── Extra URLs + uploaded files ───────────────────────────────────────────
    url_sources:  list[SearchResult] = []
    file_sources: list[SearchResult] = []

    if extra_urls:
        url_contents = await asyncio.gather(*[tavily.extract(u) for u in extra_urls])
        for url, content in zip(extra_urls, url_contents):
            if content:
                domain = urlparse(url).netloc.lstrip("www.")
                url_sources.append(SearchResult(
                    title=f"User-provided: {domain}",
                    url=url, snippet=content[:300],
                    content=content, domain=domain, score=1.0,
                ))

    for fp in file_paths:
        text = extract_text(fp)
        if text:
            name = Path(fp).name
            file_sources.append(SearchResult(
                title=f"Uploaded: {name}",
                url=f"local://{name}", snippet=text[:300],
                content=text, domain="uploaded_file", score=1.0,
            ))

    # ── Rank ─────────────────────────────────────────────────────────────────
    ranked    = rank_and_deduplicate(all_results, DEEP_SEARCH_SOURCES, intent_domain=_intent_domain)

    # ── Extract: replace snippets with full page content for top sources ─────
    # Tavily snippets are short query-relevant excerpts; full extraction gives
    # the LLM the actual page content (tables, data, full text).
    _EXTRACT_TOP_N = 3
    if ranked:
        to_extract = ranked[:_EXTRACT_TOP_N]

        async def _bounded_extract(r: SearchResult) -> str:
            async with _tavily_sem:
                return await tavily.extract(r.url)

        yield {"type": "stage", "stage": "reading", "label": f"Reading {len(ranked)} sources…"}
        t_extract = time.time()

        extracted = await asyncio.gather(
            *[_bounded_extract(r) for r in to_extract],
            return_exceptions=True,
        )
        for result, content in zip(to_extract, extracted):
            if isinstance(content, str) and content.strip():
                result.snippet = content
                logger.info("tavily_extract_applied", url=result.url[:80], chars=len(content))
            else:
                logger.info("tavily_extract_empty", url=result.url[:80],
                            reason="exception" if isinstance(content, Exception) else "empty_response")

        yield {"type": "stage_done", "stage": "reading", "duration_s": round(time.time() - t_extract, 2)}

    all_final = file_sources + url_sources + ranked

    # Top-N fed to the LLM; all sources embedded in ChromaDB for follow-up retrieval
    final = all_final[:DEEP_SOURCES_IN_ANSWER]
    logger.info(
        "sources_for_llm",
        conv=conversation_id[:8],
        count=len(final),
        sources=[{"domain": s.domain, "url": s.url[:80], "snippet_chars": len(s.snippet)} for s in final],
    )

    yield {
        "type":            "_sources_ready",
        "sources":         [source_summary(s) for s in all_final],   # UI display + DB
        "sources_for_llm": [source_full(s)    for s in final],        # top-N for LLM
        "sources_all":     [source_full(s)    for s in all_final],    # all N for ChromaDB
    }


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _load_prior_synthesis(parent_session_id: Optional[str], limit: int) -> str:
    """Load synthesis_text from the ancestor chain — branch-aware."""
    if not parent_session_id:
        return ""
    try:
        from core.db_async import collect_ancestor_chain
        chain = await collect_ancestor_chain(parent_session_id, limit)
        texts = [r["synthesis_text"] for r in chain if r.get("synthesis_text")]
        return "\n\n---\n\n".join(texts) if texts else ""
    except Exception as exc:
        logger.warning("load_prior_synthesis_failed", parent=parent_session_id, error=str(exc))
        return ""


def _resolve_file_ids(uploaded_file_ids: Optional[str], user_id: str) -> list[str]:
    if not uploaded_file_ids:
        return []
    paths = []
    for fid in uploaded_file_ids.split(","):
        fid = fid.strip()
        if not fid:
            continue
        user_dir = Path(UPLOAD_DIR) / user_id
        matches = list(user_dir.glob(f"{fid}*")) if user_dir.exists() else []
        if matches:
            paths.append(str(matches[0]))
    return paths


def _strip_urls(text: str) -> str:
    import re as _re
    return _re.sub(r'https?://\S+', '', text).strip()
