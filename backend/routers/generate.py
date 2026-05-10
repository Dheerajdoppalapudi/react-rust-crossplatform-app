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
import logging
import time
import uuid
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import StreamingResponse
from core.config import (
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
from core.limiter import limiter as _limiter
from core.database import (
    get_db,
    insert_conversation,
    touch_conversation,
    insert_session,
    update_session,
    session_output_dir,
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
from services.llm_service import LLMService, OpenAIProvider, ClaudeProvider
from services.research.file_extractor import extract_urls_from_text, extract_text
from services.research.search_provider import SearchResult, tavily
from services.research.source_processor import rank_and_deduplicate, truncate_content
from services.research.research_service import source_summary, source_full
from services.research.vector_store import upsert_sources, retrieve_sources
from dependencies.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

HEARTBEAT_INTERVAL = HEARTBEAT_INTERVAL_SECS


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _write_activity_log(output_dir: str, lifecycle_log: list) -> None:
    try:
        with open(f"{output_dir}/activity_log.json", "w") as f:
            json.dump(lifecycle_log, f, indent=2)
    except Exception as exc:
        logger.warning("activity_log_write_failed  output_dir=%s  error=%s", output_dir, exc)


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
    uploaded_file_ids:   Optional[str] = Form(None),
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

    session_id = uuid.uuid4().hex
    output_dir = session_output_dir(session_id)
    start_time = time.time()

    # ── Resolve / create conversation ─────────────────────────────────────────
    if not conversation_id:
        conversation_id = uuid.uuid4().hex
        insert_conversation(conversation_id, message[:CONVERSATION_TITLE_MAX_CHARS], user_id=current_user.id)
        # First turn — always 1, no need for an atomic lookup
        turn_index = insert_session(
            session_id, message, conversation_id, turn_index=1,
            parent_session_id=parent_session_id,
            parent_frame_index=parent_frame_index,
            user_id=current_user.id,
        )
    else:
        # Atomic MAX()+1 inside insert_session eliminates the COUNT race condition
        turn_index = insert_session(
            session_id, message, conversation_id,
            parent_session_id=parent_session_id,
            parent_frame_index=parent_frame_index,
            user_id=current_user.id,
        )
    touch_conversation(conversation_id)

    # ── LLM provider ─────────────────────────────────────────────────────────
    _llm_provider = (
        OpenAIProvider(model=model) if provider == "openai" else ClaudeProvider(model=model)
    ) if model else (
        OpenAIProvider() if provider == "openai" else ClaudeProvider()
    )
    model_name = _llm_provider.model

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

    # ContextVars must be set inside the generator
    lifecycle_log: list = []
    log_token   = request_log.set(lifecycle_log)
    usage_acc   = {
        "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0,
        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
    }
    usage_token  = token_usage.set(usage_acc)
    svc_token    = request_llm_service.set(LLMService(provider=llm_provider))

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

    _log({"event": "request_received", "prompt": message, "session_id": session_id,
          "model": model_name, "research_mode": research_mode, "video_enabled": video_enabled})

    heartbeat_queue: asyncio.Queue = asyncio.Queue()

    async def _heartbeat():
        t = start_time
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            await heartbeat_queue.put({"type": "heartbeat", "elapsed_s": round(time.time() - t, 1)})

    heartbeat_task = asyncio.create_task(_heartbeat())

    try:
        # ── 0. Init event — URL updates immediately ───────────────────────────
        yield _sse({"type": "init", "conversation_id": conversation_id})

        # ── 1. Conversation context ───────────────────────────────────────────
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

        # ── 2. Load prior synthesis_text for follow-up context ────────────────
        prior_synthesis = _load_prior_synthesis(conversation_id, FOLLOWUP_CONTEXT_TURNS, current_user.id)

        # ── 3. Thinking stage + plan_and_classify ─────────────────────────────
        think_evt = {"type": "stage", "stage": "thinking", "label": "Thinking about your question…"}
        _apply_stage_log(think_evt)
        yield _sse(think_evt)
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
        yield _sse(think_done)

        # ── 4. Search phase (conditional) ─────────────────────────────────────
        sources:      list[dict] = []
        sources_full: list[dict] = []

        should_search = (research_mode == "deep_research") or intent.get("needs_search", False)
        if should_search:
            file_paths = _resolve_file_ids(uploaded_file_ids, current_user.id)
            extra_urls = extract_urls_from_text(message)
            clean_message = _strip_urls(message)

            async for event in _search_phase(
                intent=intent,
                research_mode=research_mode,
                conversation_id=conversation_id,
                file_paths=file_paths,
                extra_urls=extra_urls,
                output_dir=output_dir,
            ):
                while not heartbeat_queue.empty():
                    yield _sse(await heartbeat_queue.get())
                if event["type"] == "_sources_ready":
                    sources      = event["sources"]
                    sources_full = event["sources_full"]
                else:
                    _apply_stage_log(event)
                    yield _sse(event)

        # ── 5. Two-branch pipeline ─────────────────────────────────────────────
        result_payload: dict = {}
        synthesis_text: str  = ""

        if video_enabled:
            # Synthesise sources → text for the frame planner
            if sources_full:
                yield _sse({"type": "stage", "stage": "synthesising", "label": "Synthesising answer…"})
                _apply_stage_log({"type": "stage", "stage": "synthesising", "label": "Synthesising answer…"})
                t_synth = time.time()

                from services.research.synthesiser import stream as synth_stream
                from services.research.source_processor import build_evidence_table

                llm_svc = request_llm_service.get()
                sr_list = [SearchResult(
                    title=s.get("title", ""), url=s.get("url", ""),
                    snippet=s.get("snippet", ""), content=s.get("content", ""),
                    domain=s.get("domain", ""), score=float(s.get("score", 0.5)),
                ) for s in sources_full]

                async for token in synth_stream(message, sr_list, llm_svc, conversation_context):
                    yield _sse({"type": "token", "text": token})
                    synthesis_text += token

                synth_done = {"type": "stage_done", "stage": "synthesising",
                              "duration_s": round(time.time() - t_synth, 2)}
                _apply_stage_log(synth_done)
                yield _sse(synth_done)

            async for event in run_video_pipeline_from_intent(
                intent=intent,
                synthesis_text=synthesis_text,
                session_id=session_id,
                output_dir=output_dir,
                conversation_context=conversation_context,
                notes_enabled=notes_enabled,
                forced_render_mode=render_mode,
            ):
                while not heartbeat_queue.empty():
                    yield _sse(await heartbeat_queue.get())
                _apply_stage_log(event)
                if event["type"] == "result":
                    result_payload = event["payload"]
                else:
                    yield _sse(event)

        else:
            # Interactive: scene planner gets raw sources + enriched_prompt
            from services.interactive.interactive_service import run_interactive_pipeline

            design_evt = {"type": "stage", "stage": "designing", "label": "Designing the lesson…"}
            _apply_stage_log(design_evt)
            yield _sse(design_evt)
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
                while not heartbeat_queue.empty():
                    yield _sse(await heartbeat_queue.get())
                if event["type"] == "meta":
                    result_payload["suggested_followups"] = event.get("follow_ups", [])
                    yield _sse(event)
                elif event["type"] == "done":
                    pass  # router emits the unified done
                else:
                    yield _sse(event)

            design_done = {"type": "stage_done", "stage": "designing",
                           "duration_s": round(time.time() - t_design, 2)}
            _apply_stage_log(design_done)
            yield _sse(design_done)

        # ── 6. Finalise ────────────────────────────────────────────────────────
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

        for s in stages_log:
            if s.get("status") == "active":
                s["status"] = "done"

        # Upsert sources to ChromaDB for follow-up retrieval
        if sources_full:
            await asyncio.to_thread(upsert_sources, conversation_id, sources_full)

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
            # Store all found source summaries so the UI sources panel shows everything
            sources_json=json.dumps(sources) if sources else None,
            stages_json=json.dumps(stages_log) if stages_log else None,
            synthesis_text=synthesis_text or None,
        )

        done_event: dict = {
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


# ── Search phase ──────────────────────────────────────────────────────────────

async def _search_phase(
    intent:          dict,
    research_mode:   str,
    conversation_id: str,
    file_paths:      list[str],
    extra_urls:      list[str],
    output_dir:      str,
):
    """
    Unified search pipeline for instant (light) and deep_research (full) modes.

    Yields SSE events and one internal sentinel:
      {type: '_sources_ready', sources: [...], sources_full: [...]}

    sources      — summaries of ALL found results (for UI display and DB storage)
    sources_full — top-N with truncated content (for LLM and ChromaDB)

    All raw content is saved to output_dir/sources_raw.json before truncation.
    The caller forwards all non-internal events to the client.
    """
    search_queries = intent.get("search_queries", [])
    sub_questions  = intent.get("sub_questions", [])
    max_queries    = DEEP_MAX_QUERIES if research_mode == "deep_research" else INSTANT_MAX_QUERIES
    queries_used   = search_queries[:max_queries]

    all_results: list[SearchResult] = []

    # ── Round 1 (and optional round 2 for deep) ───────────────────────────────
    for round_n in range(2 if research_mode == "deep_research" else 1):
        if not queries_used:
            break

        n_q = len(queries_used)
        search_evt = {
            "type":    "stage",
            "stage":   "searching",
            "label":   f"Searching {n_q} {'query' if n_q == 1 else 'queries'}…",
            "round":   round_n + 1,
            "queries": queries_used,
        }
        yield search_evt
        t_search = time.time()

        # Semaphore caps concurrent Tavily calls to prevent 429 storms at scale
        _tavily_sem = asyncio.Semaphore(3)

        async def _bounded_search(q: str) -> list:
            async with _tavily_sem:
                return await tavily.search(q, max_results=5)

        batches = await asyncio.gather(*[_bounded_search(q) for q in queries_used])

        round_results: list[SearchResult] = []
        for batch in batches:
            round_results.extend(batch)

        seen = {r.url for r in all_results}
        new_results = [r for r in round_results if r.url not in seen]
        all_results.extend(new_results)

        # Emit source events for every result found — UI shows all, not just what LLM uses
        for r in new_results:
            yield {"type": "source", "source": source_summary(r)}

        yield {
            "type":          "stage_done",
            "stage":         "searching",
            "duration_s":    round(time.time() - t_search, 2),
            "sources_found": len(new_results),
        }

        # Round 2: only if deep and too few results
        if round_n == 0 and research_mode == "deep_research" and len(all_results) < 5:
            queries_used = [f"{q} explained" for q in sub_questions[:2]]
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
    ranked    = rank_and_deduplicate(all_results, DEEP_SEARCH_SOURCES)
    all_final = file_sources + url_sources + ranked

    # Save full raw content to disk before any truncation
    _save_sources_raw(all_final, output_dir)

    # Top-N for LLM — only these get content-truncated and fed to the scene planner
    final = all_final[:DEEP_SOURCES_IN_ANSWER]

    if final:
        n_read = len(final)
        yield {"type": "stage", "stage": "reading", "label": f"Reading {n_read} sources…"}
        t_read = time.time()

        for s in final:
            s.content = truncate_content(s.content or s.snippet)

        yield {"type": "stage_done", "stage": "reading", "duration_s": round(time.time() - t_read, 2)}

    yield {
        "type":         "_sources_ready",
        # All found — shown in UI sources panel and stored in DB
        "sources":      [source_summary(s) for s in all_final],
        # Top-N truncated — fed to LLM and embedded in ChromaDB
        "sources_full": [source_full(s)    for s in final],
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _save_sources_raw(sources, output_dir: str) -> None:
    """Persist full extracted source content to disk before truncation."""
    try:
        import os
        os.makedirs(output_dir, exist_ok=True)
        data = [
            {
                "title":   s.title,
                "url":     s.url,
                "domain":  s.domain,
                "score":   s.score,
                "snippet": s.snippet,
                "content": s.content,
            }
            for s in sources
        ]
        with open(f"{output_dir}/sources_raw.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        logger.warning("sources_raw_write_failed  output_dir=%s  error=%s", output_dir, exc)


def _load_prior_synthesis(conversation_id: str, limit: int, user_id: str) -> str:
    """Load the last N synthesis_text values from prior turns for follow-up context."""
    if not conversation_id:
        return ""
    try:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT synthesis_text FROM sessions "
                "WHERE conversation_id = ? AND user_id = ? AND status = 'done' "
                "AND synthesis_text IS NOT NULL "
                "ORDER BY turn_index DESC LIMIT ?",
                (conversation_id, user_id, limit),
            ).fetchall()
        texts = [r["synthesis_text"] for r in reversed(rows) if r["synthesis_text"]]
        return "\n\n---\n\n".join(texts) if texts else ""
    except Exception as exc:
        logger.warning("load_prior_synthesis_failed  conv=%s  error=%s", conversation_id, exc)
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
