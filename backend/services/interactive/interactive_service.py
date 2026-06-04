"""
Interactive Mode pipeline — produces a Scene IR via SSE events.

SSE event sequence:
  { type: "meta",  title, follow_ups }          ← emitted right after scene planning
  { type: "block", block: { id, type, ... } }   ← one per block in order
  { type: "done",  session_id }

Pipeline stages:
  1. _select_entities   → 2–5 entity names best suited to the question
  2. _plan_scene        → SceneIR (uses full schemas for selected entities + injects sources)
  3. codegen (if needed) for freeform_html / p5_sketch blocks

Entity selector receives enriched_prompt from plan_and_classify + domain; outputs visual_brief + entities.
Scene planner receives enriched_prompt (from plan_and_classify) + visual_brief + raw research sources.

Adding a new entity type:
  1. Add its component to the frontend registry (registry.js)
  2. Add its prop schema to prompts/catalog/<entity_name>.md
  3. Add a one-liner to prompts/slim_index.md
  4. Add one entry to SceneBlock.validate_block in scene_ir.py
  No other changes needed in this file.
"""

import asyncio
import html
import json
import re
import structlog
import os
import random
import time
from dataclasses import dataclass, field
from typing import AsyncGenerator

from core.config import SCENE_PLANNER_MAX_TOKENS, SOURCES_SNIPPET_MAX_CHARS
from services.frame_generation.planner import _extract_json, request_llm_service, _log, _accumulate_tokens
from services.interactive.scene_ir import SceneIR, SceneBlock
from services.llm_service import LLMService, OpenAIProvider, ClaudeProvider, GeminiProvider, default_llm_service

logger = structlog.get_logger(__name__)

_WIDGET_TEMPLATES = [
    "Picking the best way to explain {topic}…",
    "Choosing the right visuals for {topic}…",
    "Figuring out how to show {topic}…",
    "Deciding how to present {topic}…",
    "Finding the best widgets for {topic}…",
    "Thinking about what makes {topic} click…",
    "Mapping {topic} to the right visuals…",
    "Working out the best way to teach {topic}…",
]

_PLANNING_TEMPLATES = [
    "Laying out your lesson on {topic}…",
    "Structuring the explanation of {topic}…",
    "Organizing the content around {topic}…",
    "Building out a lesson on {topic}…",
    "Putting the pieces together for {topic}…",
    "Crafting a lesson structure for {topic}…",
    "Shaping how {topic} will flow…",
    "Arranging everything you need to understand {topic}…",
]


def _short_topic(text: str, max_len: int = 45) -> str:
    t = text.strip()
    if len(t) > max_len:
        t = t[:max_len].rsplit(' ', 1)[0] + '…'
    return t

_PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "prompts")


@dataclass
class SelectionResult:
    visual_brief: str = ""
    entities: list[str] = field(default_factory=list)
    model: str = "claude-sonnet-4-6"


def _get_llm_service(model: str) -> LLMService:
    """Map an entity-selector model recommendation to an LLMService."""
    from services.llm_service import _make_service_for_model
    return _make_service_for_model(model) if model else default_llm_service


_DOMAINS_DIR = os.path.join(_PROMPTS_DIR, "domains")
_CATALOG_DIR = os.path.join(_PROMPTS_DIR, "catalog")


def _load_prompt(filename: str) -> str:
    with open(os.path.join(_PROMPTS_DIR, filename), encoding="utf-8") as f:
        return f.read()


def _load_domain_file(domain: str) -> str:
    path = os.path.join(_DOMAINS_DIR, f"{domain}.md")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return f.read()
    return ""


def _load_entity_schema(entity_name: str) -> str:
    path = os.path.join(_CATALOG_DIR, f"{entity_name}.md")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return f.read()
    return ""


def _build_catalog(selected_entities: list[str]) -> str:
    """
    Build the catalog section for the planner prompt.

    Full schemas are loaded only for selected_entities.
    slim_index is appended so the planner knows all types exist.
    """
    header = (
        "## Component Catalog\n\n"
        "### Entity block format — always use this exact shape\n\n"
        '```json\n{ "id": "<b1>", "type": "entity", "entity_type": "<name>", "props": {} }\n```\n\n'
        '`"type"` is ALWAYS the literal `"entity"`. `"entity_type"` holds the component name.\n'
    )
    schemas = [_load_entity_schema(e) for e in selected_entities]
    schemas = [s for s in schemas if s]
    slim_fallback = _load_prompt("slim_index.md")
    parts = [header] + schemas + [slim_fallback]
    return "\n\n---\n\n".join(parts)


def _build_sources_block(sources: list[dict]) -> str:
    """Format research sources for injection into the scene planner user prompt."""
    if not sources:
        return ""
    lines = ["## Research Sources\n\nUse [N] inline citations in text blocks for factual claims.\n"]
    for i, s in enumerate(sources, 1):
        # Top sources carry full page content; lower-ranked carry snippet only.
        # Prefer content (full page) when present, fall back to snippet.
        content = (s.get("content") or s.get("snippet") or "")[:SOURCES_SNIPPET_MAX_CHARS]
        lines.append(f"[{i}] **{s.get('title', '')}** ({s.get('domain', '')})")
        lines.append(f"URL: {s.get('url', '')}")
        lines.append(content)
        lines.append("")
    return "\n".join(lines)


# ── Streaming JSON helpers ─────────────────────────────────────────────────────
#
# The scene planner LLM call returns a JSON document whose `blocks` array
# can be large (8+ blocks, each potentially kilobytes of props).  Instead of
# waiting for the full response before emitting anything, we stream the raw
# token output and yield each block as soon as its closing `}` arrives.
#
# Three building-block functions:
#   _extract_meta_fields  — parse title/follow_ups/etc. from the JSON prefix
#   _scan_next_block      — brace-depth scanner to find the next complete object
#   _extract_events_from_buffer — stateless driver called on each new token
#
# Two per-provider token streamers (mirrors synthesiser.py):
#   _stream_tokens_anthropic
#   _stream_tokens_openai_compat


def _extract_meta_fields(buf: str, blocks_key_start: int) -> dict:
    """
    Parse top-level meta fields (title, domain, intent, follow_ups,
    learning_objective) from the JSON prefix that appears before the
    `"blocks"` key.  The prefix is not yet valid JSON (no closing `}`),
    so we strip the trailing comma and close it ourselves.

    Returns an empty dict on any parse failure — callers always supply
    safe defaults for missing keys.
    """
    prefix = buf[:blocks_key_start].rstrip().rstrip(",")
    if not prefix or prefix[-1] == "{":
        return {}
    try:
        return json.loads(prefix + "}")
    except json.JSONDecodeError:
        return {}


def _extract_balanced(buf: str, start: int) -> "str | None":
    """
    Return the substring from the bracket at `start` to its matching close,
    respecting JSON string escaping. `start` must point at a '[' or '{'.
    Returns None if the bracket never closes within the buffer.
    """
    if start < 0 or start >= len(buf) or buf[start] not in "[{":
        return None
    depth = 0
    in_string = False
    escape_next = False
    for i in range(start, len(buf)):
        c = buf[i]
        if escape_next:
            escape_next = False
            continue
        if in_string:
            if c == "\\":
                escape_next = True
            elif c == '"':
                in_string = False
            continue
        if c == '"':
            in_string = True
        elif c in "[{":
            depth += 1
        elif c in "]}":
            depth -= 1
            if depth == 0:
                return buf[start : i + 1]
    return None


def _extract_meta_anywhere(buf: str) -> dict:
    """
    Best-effort recovery of top-level SceneIR meta fields (title, follow_ups,
    learning_objective) from a scene-planner buffer — regardless of whether the
    model placed them before or after the blocks array, and even when the strict
    JSON parse fell back to block-only reconstruction.

    Used to backfill the persisted SceneIR so a reloaded conversation shows the
    same follow-ups/title the live stream produced. Returns only the keys it
    could confidently recover.
    """
    out: dict = {}
    for key in ("title", "learning_objective"):
        m = re.search(rf'"{key}"\s*:\s*"((?:[^"\\]|\\.)*)"', buf)
        if m:
            try:
                out[key] = json.loads('"' + m.group(1) + '"')
            except Exception:
                out[key] = m.group(1)
    m = re.search(r'"follow_ups"\s*:\s*\[', buf)
    if m:
        arr = _extract_balanced(buf, m.end() - 1)
        if arr:
            try:
                vals = json.loads(arr)
                if isinstance(vals, list):
                    cleaned = [v.strip() for v in vals if isinstance(v, str) and v.strip()]
                    if cleaned:
                        out["follow_ups"] = cleaned
            except Exception:
                pass
    return out


def _scan_next_block(buf: str, pos: int) -> tuple[int, "str | None"]:
    """
    Scan `buf` starting at `pos` for the next complete JSON object.

    Handles nested objects, JSON strings (including escape sequences), and
    ignores structural characters inside strings.

    Returns:
        (new_pos, json_str)  — complete object found; new_pos is right after `}`
        (pos,     None)      — object not yet complete; caller should wait for
                               more tokens and retry with the same `pos`
        (-1,      None)      — `]` found at depth 0 — the blocks array has ended
    """
    n = len(buf)

    # Skip inter-object whitespace / commas
    while pos < n and buf[pos] in " \t\n\r,":
        pos += 1

    if pos >= n:
        return pos, None          # need more data

    if buf[pos] == "]":
        return -1, None           # array closed

    if buf[pos] != "{":
        return pos + 1, None      # unexpected char — skip it and keep going

    depth = 0
    in_string = False
    escape_next = False
    start = pos
    i = pos

    while i < n:
        c = buf[i]

        if escape_next:
            escape_next = False
            i += 1
            continue

        if in_string:
            if c == "\\":
                escape_next = True
            elif c == '"':
                in_string = False
            i += 1
            continue

        # Outside a string
        if c == '"':
            in_string = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i + 1, buf[start : i + 1]

        i += 1

    return start, None            # object incomplete — wait for more tokens


def _extract_events_from_buffer(
    buf: str,
    meta_emitted: bool,
    scan_pos: int,
) -> tuple[list[dict], bool, int]:
    """
    Stateless driver: given the accumulated token buffer and current parse
    state, return any new events that can be yielded right now.

    Called on every new token — only O(new_chars) work after meta is found
    because scan_pos advances past already-processed content.

    Returns:
        events        — list of {"type": "_meta", ...} and/or {"type": "_block", "block": SceneBlock}
        meta_emitted  — updated flag
        scan_pos      — updated position inside the blocks array
    """
    events: list[dict] = []

    # Phase 1 — find "blocks": [ and extract meta fields from the prefix
    if not meta_emitted:
        m = re.search(r'"blocks"\s*:\s*\[', buf)
        if m:
            meta_emitted = True
            scan_pos = m.end()          # position right after the '['
            meta_fields = _extract_meta_fields(buf, m.start())
            events.append({"type": "_meta", **meta_fields})

    # Phase 2 — extract every complete block object we can find from scan_pos
    if meta_emitted:
        while True:
            new_pos, block_json = _scan_next_block(buf, scan_pos)

            if new_pos == -1:           # ']' reached — array closed
                break

            if block_json is None:      # incomplete — wait for more tokens
                break

            scan_pos = new_pos

            try:
                block_data = json.loads(block_json)
                block = SceneBlock(**block_data)
                events.append({"type": "_block", "block": block})
            except Exception as exc:
                logger.warning("streaming_block_invalid", error=str(exc),
                               preview=block_json[:120])

    return events, meta_emitted, scan_pos


async def _stream_tokens_anthropic(
    svc: LLMService,
    system_prompt: str,
    user_msg: str,
    usage_sink: dict,
    max_tokens: int,
) -> AsyncGenerator[str, None]:
    """Yield raw text tokens from the Anthropic streaming API."""
    from services.llm_service import _get_async_anthropic_client
    client = _get_async_anthropic_client()
    model = getattr(svc.provider, "model", "claude-haiku-4-5-20251001")

    async with client.messages.stream(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_msg}],
    ) as s:
        async for text in s.text_stream:
            yield text
        # Usage is available after text_stream is exhausted, still inside ctx
        try:
            msg = await s.get_final_message()
            if msg.usage:
                usage_sink.update({
                    "prompt_tokens":              msg.usage.input_tokens,
                    "completion_tokens":           msg.usage.output_tokens,
                    "total_tokens":               msg.usage.input_tokens + msg.usage.output_tokens,
                    "cache_creation_input_tokens": getattr(msg.usage, "cache_creation_input_tokens", 0),
                    "cache_read_input_tokens":     getattr(msg.usage, "cache_read_input_tokens", 0),
                })
        except Exception:
            pass


async def _stream_tokens_openai_compat(
    svc: LLMService,
    system_prompt: str,
    user_msg: str,
    usage_sink: dict,
    max_tokens: int,
) -> AsyncGenerator[str, None]:
    """Yield raw text tokens from OpenAI or Gemini (OpenAI-compatible) streaming API."""
    from services.llm_service import (
        _get_async_openai_client, _get_async_gemini_client,
    )
    provider = svc.provider
    client = (
        _get_async_gemini_client()
        if isinstance(provider, GeminiProvider)
        else _get_async_openai_client()
    )
    model = getattr(provider, "model", "gpt-4.1")

    create_kwargs: dict = dict(
        model=model,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_msg},
        ],
        response_format={"type": "json_object"},
        stream=True,
        stream_options={"include_usage": True},
    )

    try:
        response = await client.chat.completions.create(**create_kwargs)
    except Exception:
        # stream_options not supported by this endpoint — retry without it.
        # Keep response_format — both OpenAI and Gemini support json_object mode.
        create_kwargs.pop("stream_options", None)
        response = await client.chat.completions.create(**create_kwargs)

    async for chunk in response:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
        # Final chunk carries usage when stream_options is supported
        if getattr(chunk, "usage", None):
            usage_sink.update({
                "prompt_tokens":     getattr(chunk.usage, "prompt_tokens",     0),
                "completion_tokens": getattr(chunk.usage, "completion_tokens", 0),
                "total_tokens":      getattr(chunk.usage, "total_tokens",      0),
            })


def _wrap_in_sandbox(raw_html: str) -> str:
    escaped = html.escape(raw_html, quote=True)
    return (
        '<iframe sandbox="allow-scripts" '
        f'srcdoc="{escaped}" '
        'style="width:100%;height:420px;border:none;border-radius:8px" '
        'title="interactive-widget"></iframe>'
    )


_CODEGEN_MAX_TOKENS: dict[str, int] = {
    "canvas_codegen_slides": 8000,   # full HTML presentation with 8-10 slides
    "canvas_codegen_p5":     6000,
    "canvas_codegen":        6000,
}


async def _run_codegen_with_prompt(
    prompt_file: str,
    spec: str,
    user_prompt: str,
    svc: LLMService = None,
) -> str:
    template = _load_prompt(prompt_file)
    prompt = (
        template
        .replace("{{ENTITY_SPEC}}", spec)
        .replace("{{USER_PROMPT}}", user_prompt)
    )
    svc = svc or default_llm_service
    model = getattr(svc.provider, "model", "unknown")
    label = prompt_file.replace(".md", "")
    logger.info("llm_call", prompt=label, model=model, chars=len(prompt), cache="no")
    max_tokens = _CODEGEN_MAX_TOKENS.get(label, 4000)
    result, usage = await svc.make_single_prompt_request_async(prompt, max_tokens=max_tokens)
    if result is None:
        raise RuntimeError("Codegen LLM returned None")
    _accumulate_tokens(usage or {})
    logger.info("llm_done", prompt=label, model=model,
                tokens=(usage or {}).get("total_tokens", 0),
                cache_read=(usage or {}).get("cache_read_input_tokens", 0),
                cache_create=(usage or {}).get("cache_creation_input_tokens", 0))
    _log({"event": "llm_call", "prompt_name": label, "model": model, "usage": usage or {}})
    result = result.strip()
    if result.startswith("```"):
        result = result.split("\n", 1)[-1]
        result = result.rsplit("```", 1)[0]
    return result.strip()


async def _run_codegen(spec: str, user_prompt: str, svc: LLMService = None) -> str:
    return await _run_codegen_with_prompt("canvas_codegen.md", spec, user_prompt, svc=svc)


async def _run_p5_codegen(spec: str, user_prompt: str, svc: LLMService = None) -> str:
    return await _run_codegen_with_prompt("canvas_codegen_p5.md", spec, user_prompt, svc=svc)


async def _run_slide_codegen(spec: str, user_prompt: str, svc: LLMService = None) -> str:
    return await _run_codegen_with_prompt("canvas_codegen_slides.md", spec, user_prompt, svc=svc)


async def _select_entities(
    enriched_prompt: str,
    domain: str,
    conversation_context: str,
) -> SelectionResult:
    """
    Entity selector call — picks 2–5 entities, writes visual_brief, recommends a model.

    Receives enriched_prompt from plan_and_classify. Does NOT re-enrich the question.
    """
    slim_index = _load_prompt("slim_index.md")
    selector_template = _load_prompt("entity_selector.md")
    selector_prompt = selector_template.replace("{{SLIM_INDEX}}", slim_index)

    context_block = f"Conversation context:\n{conversation_context}\n\n" if conversation_context else ""
    user_msg = f"{context_block}Domain: {domain}\n\nenriched_prompt: {enriched_prompt}"

    try:
        from services.llm_service import get_task_service
        entity_svc = request_llm_service.get() or get_task_service("entity_selector")
        _model = getattr(entity_svc.provider, "model", "unknown")
        logger.info("llm_call", prompt="entity_selector", model=_model,
                    chars=len(selector_prompt) + len(user_msg), cache="no")
        raw, _usage = await entity_svc.make_system_user_request_async(
            selector_prompt, user_msg, max_tokens=800
        )
        _accumulate_tokens(_usage or {})
        logger.info("llm_done", prompt="entity_selector", model=_model,
                    tokens=(_usage or {}).get("total_tokens", 0),
                    cache_read=(_usage or {}).get("cache_read_input_tokens", 0),
                    cache_create=(_usage or {}).get("cache_creation_input_tokens", 0))
        _log({"event": "llm_call", "prompt_name": "entity_selector", "model": _model, "usage": _usage or {}})
        if raw is None:
            return SelectionResult()

        data = _extract_json(raw)
        entities: list[str] = data.get("entities", [])
        visual_brief = data.get("visual_brief", "")
        model = data.get("model", "claude-sonnet-4-6")

        if model not in ("gpt-4.1", "claude-sonnet-4-6"):
            model = "claude-sonnet-4-6"

        logger.info("entity_selected", visual_brief=visual_brief[:80], entities=entities, model=model)
        return SelectionResult(visual_brief=visual_brief, entities=entities, model=model)

    except Exception as exc:
        logger.warning("entity_selector_failed_fallback", error=str(exc))
        return SelectionResult()


async def _plan_scene(
    enriched_prompt: str,
    domain: str,
    conversation_context: str,
    selected_entities: list[str],
    sources: list[dict],
    svc: LLMService = None,
    visual_brief: str = "",
) -> SceneIR:
    """Call the planner LLM and parse the Scene IR. Injects research sources for [N] citations."""
    base       = _load_prompt("base_planner.md")
    domain_ctx = _load_domain_file(domain)

    if selected_entities:
        catalog = _build_catalog(selected_entities)
    else:
        catalog = _load_prompt("component_catalog.md")

    system_prompt = "\n\n".join(filter(None, [base, domain_ctx, catalog]))

    context_block = (
        f"Conversation context:\n{conversation_context}\n\n"
        if conversation_context else ""
    )
    sources_block = _build_sources_block(sources)
    visual_brief_block = f"Visual brief: {visual_brief}\n\n" if visual_brief else ""
    user_msg = f"{context_block}{sources_block}{visual_brief_block}USER QUESTION: {enriched_prompt}"

    from services.llm_service import get_task_service
    svc = svc or get_task_service("scene_planner")
    _model = getattr(svc.provider, "model", "unknown")
    logger.info("llm_call", prompt="scene_planner", model=_model,
                chars=len(system_prompt) + len(user_msg), cache="no")
    raw, _usage = await svc.make_system_user_request_async(
        system_prompt, user_msg, max_tokens=SCENE_PLANNER_MAX_TOKENS
    )
    _accumulate_tokens(_usage or {})
    logger.info("llm_done", prompt="scene_planner", model=_model,
                tokens=(_usage or {}).get("total_tokens", 0),
                cache_read=(_usage or {}).get("cache_read_input_tokens", 0),
                cache_create=(_usage or {}).get("cache_creation_input_tokens", 0))
    _log({"event": "llm_call", "prompt_name": "scene_planner", "model": _model, "usage": _usage or {}})
    if raw is None:
        raise RuntimeError("Scene planner LLM returned None")

    data = _extract_json(raw)
    data.setdefault("domain", domain)

    try:
        return SceneIR(**data)
    except Exception as exc:
        logger.error("scene_ir_validation_failed", error=str(exc), raw=raw[:500])
        raise


async def _stream_plan_scene(
    enriched_prompt: str,
    domain: str,
    conversation_context: str,
    selected_entities: list[str],
    sources: list[dict],
    svc: LLMService = None,
    visual_brief: str = "",
) -> AsyncGenerator[dict, None]:
    """
    Streaming replacement for _plan_scene.

    Calls the scene-planner LLM with streaming enabled and yields internal
    events as they become available — no waiting for the full response:

        {"type": "_meta",  "title": ..., "follow_ups": [...], ...}
            Emitted as soon as the JSON prefix before `"blocks": [` is complete.

        {"type": "_block", "block": SceneBlock}
            Emitted for each block the instant its closing `}` arrives.

        {"type": "_done",  "scene": SceneIR | None, "usage": dict}
            Emitted once after the stream ends.  `scene` is the fully validated
            SceneIR built from the complete buffer — used for persistence.
            Falls back to assembling from emitted_blocks when json parsing fails.

    On any streaming error the function falls back to the non-streaming
    _plan_scene path, emitting meta and blocks in batch so the caller never
    needs to know the difference.
    """
    # ── Build prompts (identical to _plan_scene) ──────────────────────────────
    base       = _load_prompt("base_planner.md")
    domain_ctx = _load_domain_file(domain)
    catalog    = (_build_catalog(selected_entities) if selected_entities
                  else _load_prompt("component_catalog.md"))
    system_prompt = "\n\n".join(filter(None, [base, domain_ctx, catalog]))

    context_block      = f"Conversation context:\n{conversation_context}\n\n" if conversation_context else ""
    sources_block      = _build_sources_block(sources)
    visual_brief_block = f"Visual brief: {visual_brief}\n\n" if visual_brief else ""
    user_msg = f"{context_block}{sources_block}{visual_brief_block}USER QUESTION: {enriched_prompt}"

    from services.llm_service import get_task_service
    svc    = svc or get_task_service("scene_planner")
    _model = getattr(svc.provider, "model", "unknown")
    logger.info("llm_call", prompt="scene_planner_stream", model=_model,
                chars=len(system_prompt) + len(user_msg), cache="no")

    buf: str              = ""
    usage: dict           = {}
    meta_emitted: bool    = False
    scan_pos: int         = 0
    emitted_blocks: list  = []
    stream_ok: bool       = False

    # ── Streaming path ────────────────────────────────────────────────────────
    try:
        if isinstance(svc.provider, ClaudeProvider):
            token_gen = _stream_tokens_anthropic(
                svc, system_prompt, user_msg, usage, SCENE_PLANNER_MAX_TOKENS)
        else:
            token_gen = _stream_tokens_openai_compat(
                svc, system_prompt, user_msg, usage, SCENE_PLANNER_MAX_TOKENS)

        async for token in token_gen:
            buf      += token
            stream_ok = True
            events, meta_emitted, scan_pos = _extract_events_from_buffer(
                buf, meta_emitted, scan_pos)
            for event in events:
                if event["type"] == "_block":
                    emitted_blocks.append(event["block"])
                yield event

    except Exception as exc:
        logger.warning("scene_planner_stream_failed", error=str(exc), model=_model)
        stream_ok = False

    # ── Non-streaming fallback ────────────────────────────────────────────────
    if not stream_ok or not buf:
        logger.info("scene_planner_stream_fallback", model=_model)
        try:
            raw, usage = await svc.make_system_user_request_async(
                system_prompt, user_msg, max_tokens=SCENE_PLANNER_MAX_TOKENS)
            buf = raw or ""
        except Exception as exc2:
            logger.error("scene_planner_fallback_failed", error=str(exc2))
            buf = ""

        # Reset scan state — streaming may have left it partially advanced
        meta_emitted = False
        scan_pos     = 0
        emitted_blocks = []

        if buf:
            events, meta_emitted, scan_pos = _extract_events_from_buffer(
                buf, False, 0)
            # Drain: collect ALL blocks from the complete buffer
            while True:
                more_events, _, scan_pos = _extract_events_from_buffer(
                    buf, meta_emitted, scan_pos)
                if not more_events:
                    break
                events.extend(more_events)
                meta_emitted = True   # already set after first pass

            for event in events:
                if event["type"] == "_block":
                    emitted_blocks.append(event["block"])
                yield event

    # ── Build the canonical SceneIR from the complete buffer ─────────────────
    scene: "SceneIR | None" = None
    try:
        data = _extract_json(buf)
        data.setdefault("domain", domain)
        scene = SceneIR(**data)
    except Exception as exc:
        logger.error("scene_ir_final_parse_failed", error=str(exc))
        # Last resort: reconstruct from the blocks we already emitted
        if emitted_blocks:
            m = re.search(r'"blocks"\s*:\s*\[', buf)
            meta_fields = _extract_meta_fields(buf, m.start()) if m else {}
            try:
                scene = SceneIR(
                    title              = meta_fields.get("title", ""),
                    domain             = domain,
                    intent             = meta_fields.get("intent", "general"),
                    learning_objective = meta_fields.get("learning_objective"),
                    follow_ups         = meta_fields.get("follow_ups", []),
                    blocks             = emitted_blocks,
                )
            except Exception:
                pass

    # ── Backfill meta the strict parse may have dropped ───────────────────────
    # The model is told to emit title/follow_ups before blocks, but it sometimes
    # places them after the array (or the final parse falls back to block-only
    # reconstruction), leaving the persisted scene with empty meta even though the
    # data is present in the buffer. Recover it from anywhere in the buffer so a
    # reloaded conversation shows the same follow-ups the live stream produced.
    if scene is not None:
        recovered = _extract_meta_anywhere(buf)
        if not scene.title and recovered.get("title"):
            scene.title = recovered["title"]
        if not scene.follow_ups and recovered.get("follow_ups"):
            scene.follow_ups = recovered["follow_ups"]
        if not scene.learning_objective and recovered.get("learning_objective"):
            scene.learning_objective = recovered["learning_objective"]
        if not scene.follow_ups:
            logger.warning("scene_followups_empty", model=_model, buf_chars=len(buf))

    _accumulate_tokens(usage)
    logger.info("llm_done", prompt="scene_planner", model=_model,
                tokens=usage.get("total_tokens", 0),
                cache_read=usage.get("cache_read_input_tokens", 0),
                cache_create=usage.get("cache_creation_input_tokens", 0))
    # Persist the raw buffer so follow-up/title recovery issues stay debuggable.
    _log({"event": "llm_call", "prompt_name": "scene_planner", "model": _model,
          "usage": usage, "full_response": buf})

    yield {"type": "_done", "scene": scene, "usage": usage}


def _save_scene_ir(scene: SceneIR, output_dir: str, session_id: str = "") -> None:
    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, "scene_ir.json")
    data = json.dumps(scene.dict(), indent=2).encode()
    with open(path, "wb") as f:
        f.write(data)
    if session_id:
        try:
            from core.s3 import upload_scene_ir
            upload_scene_ir(data, session_id)
        except Exception as exc:
            logger.warning("scene_ir_s3_upload_failed", session=session_id, error=str(exc))


async def run_interactive_pipeline(
    original_message:     str,
    session_id:           str,
    output_dir:           str,
    conversation_context: str,
    domain:               str = "general",
    sources:              list[dict] = None,
    enriched_prompt:      str = "",
) -> AsyncGenerator[dict, None]:
    """
    Main SSE generator for interactive mode.

    original_message — the user's raw question (kept for logging/context)
    enriched_prompt  — plan_and_classify's 2-4 sentence spec; fed to entity selector
                       for better widget choices. Falls back to original_message if empty.
    domain           — pre-computed by plan_and_classify (skip separate classify call)
    sources          — research sources from Tavily; injected into scene planner for [N] citations
    """
    sources = sources or []

    logger.info("interactive_pipeline_start", session=session_id, domain=domain, sources=len(sources))

    # Stage 1: Select entities + visual brief + recommend model.
    entity_input = enriched_prompt or original_message
    topic = _short_topic(entity_input)
    _t0 = time.monotonic()
    yield {"type": "stage", "stage": "widgets", "label": random.choice(_WIDGET_TEMPLATES).format(topic=topic)}
    selection = await _select_entities(entity_input, domain, conversation_context)
    yield {"type": "stage_done", "stage": "widgets", "duration_s": round(time.monotonic() - _t0, 1)}
    yield {"type": "entities_selected", "entities": selection.entities}

    from services.llm_service import get_task_service
    user_forced_svc = request_llm_service.get()

    # scene_planner always reads from TASK_MODELS["scene_planner"] unless the
    # user explicitly chose a model in the UI.
    # Entity selector model recommendation is used for codegen only.
    if user_forced_svc:
        scene_planner_svc = user_forced_svc
        codegen_svc       = user_forced_svc
    else:
        scene_planner_svc = get_task_service("scene_planner")
        codegen_svc       = _get_llm_service(selection.model) or get_task_service("codegen")

    # Stage 2–4: Stream the scene planner — blocks are emitted as each one
    # completes rather than waiting for the full LLM response.
    #
    # Internal event flow from _stream_plan_scene:
    #   _meta  → emit stage_done:planning + SSE meta (title, follow_ups, ...)
    #   _block → run codegen if needed, then emit SSE block
    #   _done  → capture SceneIR for persistence

    plan_topic = _short_topic(entity_input.split(".")[0])
    _t0 = time.monotonic()
    yield {"type": "stage", "stage": "planning",
           "label": random.choice(_PLANNING_TEMPLATES).format(topic=plan_topic)}

    scene: "SceneIR | None" = None
    planning_done_emitted   = False
    all_entity_block_types:  list[str] = []

    _CODEGEN_LABELS = {
        "slide_deck":    "Generating presentation slides…",
        "p5_sketch":     "Rendering animation…",
        "freeform_html": "Building interactive widget…",
    }

    async for event in _stream_plan_scene(
        entity_input, domain, conversation_context,
        selection.entities, sources,
        svc=scene_planner_svc,
        visual_brief=selection.visual_brief,
    ):
        # ── Internal _meta: close planning stage, emit SSE meta ───────────────
        if event["type"] == "_meta":
            if not planning_done_emitted:
                planning_done_emitted = True
                yield {"type": "stage_done", "stage": "planning",
                       "duration_s": round(time.monotonic() - _t0, 1)}
            yield {
                "type":               "meta",
                "title":              event.get("title", ""),
                "follow_ups":         event.get("follow_ups", []),
                "learning_objective": event.get("learning_objective"),
            }

        # ── Internal _block: optional codegen, then emit SSE block ────────────
        elif event["type"] == "_block":
            block = event["block"]
            if block.type == "entity":
                all_entity_block_types.append(block.entity_type or "")

            if block.type == "entity" and block.entity_type in (
                    "freeform_html", "p5_sketch", "slide_deck"):
                spec     = block.props.get("spec", "an interactive widget")
                stage_id = f"building_{block.id}"
                _t_cg    = time.monotonic()
                yield {"type": "stage", "stage": stage_id,
                       "label": _CODEGEN_LABELS.get(block.entity_type, "Building widget…"),
                       "entity_type": block.entity_type}
                try:
                    if block.entity_type == "p5_sketch":
                        raw_html    = await _run_p5_codegen(spec, entity_input, svc=codegen_svc)
                        block.html  = _wrap_in_sandbox(raw_html)
                    elif block.entity_type == "slide_deck":
                        raw_html    = await _run_slide_codegen(spec, entity_input, svc=codegen_svc)
                        block.html  = raw_html
                    else:
                        raw_html    = await _run_codegen(spec, entity_input, svc=codegen_svc)
                        block.html  = _wrap_in_sandbox(raw_html)
                except Exception as exc:
                    logger.error("codegen_failed", block=block.id, error=str(exc))
                    block.html = _wrap_in_sandbox(
                        "<p style='color:#f03e3e;font-family:system-ui'>"
                        "Widget generation failed.</p>")
                yield {"type": "stage_done", "stage": stage_id,
                       "duration_s": round(time.monotonic() - _t_cg, 1)}

            yield {"type": "block", "block": block.dict()}

        # ── Internal _done: capture complete SceneIR ──────────────────────────
        elif event["type"] == "_done":
            scene = event.get("scene")

    # Emit stage_done:planning if _meta never arrived (extreme edge case)
    if not planning_done_emitted:
        yield {"type": "stage_done", "stage": "planning",
               "duration_s": round(time.monotonic() - _t0, 1)}

    # Emit blocks_planned summary now that we have the full count
    if all_entity_block_types:
        yield {"type": "blocks_planned",
               "count": len(all_entity_block_types),
               "block_types": all_entity_block_types}

    if scene is None:
        raise RuntimeError("Scene planning produced no valid output")

    # Stage 5: Persist and finish
    try:
        _save_scene_ir(scene, output_dir, session_id=session_id)
    except Exception as exc:
        logger.warning("scene_ir_save_failed", error=str(exc))

    # Write scene IR into DB so the unified conversation endpoint can serve it
    # without a local-disk or S3 round-trip.
    if session_id:
        try:
            from core.db_async import update_session
            await update_session(session_id, frames_meta=scene.dict())
        except Exception as exc:
            logger.warning("scene_ir_db_write_failed", session=session_id, error=str(exc))

    yield {"type": "done", "session_id": session_id, "follow_ups": scene.follow_ups}
