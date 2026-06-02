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
import structlog
import os
import random
import time
from dataclasses import dataclass, field
from typing import AsyncGenerator

from core.config import SCENE_PLANNER_MAX_TOKENS, SOURCES_SNIPPET_MAX_CHARS
from services.frame_generation.planner import _extract_json, request_llm_service, _log, _accumulate_tokens
from services.interactive.scene_ir import SceneIR
from services.llm_service import LLMService, OpenAIProvider, default_llm_service

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
        # snippet is Tavily's query-relevant extract — always prefer it over raw content.
        # content[:N] almost always hits navigation boilerplate before real article text.
        content = (s.get("snippet") or s.get("content") or "")[:SOURCES_SNIPPET_MAX_CHARS]
        lines.append(f"[{i}] **{s.get('title', '')}** ({s.get('domain', '')})")
        lines.append(f"URL: {s.get('url', '')}")
        lines.append(content)
        lines.append("")
    return "\n".join(lines)


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
    _log({"event": "llm_call", "prompt_name": label, "usage": usage or {}})
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
        _log({"event": "llm_call", "prompt_name": "entity_selector", "usage": _usage or {}})
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
    _log({"event": "llm_call", "prompt_name": "scene_planner", "usage": _usage or {}})
    if raw is None:
        raise RuntimeError("Scene planner LLM returned None")

    data = _extract_json(raw)
    data.setdefault("domain", domain)

    try:
        return SceneIR(**data)
    except Exception as exc:
        logger.error("scene_ir_validation_failed", error=str(exc), raw=raw[:500])
        raise


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

    # Stage 2: Plan scene IR — enriched prompt (from plan_and_classify) + visual brief + sources
    plan_topic = _short_topic(entity_input.split('.')[0])
    _t0 = time.monotonic()
    yield {"type": "stage", "stage": "planning", "label": random.choice(_PLANNING_TEMPLATES).format(topic=plan_topic)}
    scene = await _plan_scene(
        entity_input, domain, conversation_context,
        selection.entities, sources, svc=scene_planner_svc,
        visual_brief=selection.visual_brief,
    )
    yield {"type": "stage_done", "stage": "planning", "duration_s": round(time.monotonic() - _t0, 1)}
    entity_blocks = [b for b in scene.blocks if b.type == "entity"]
    yield {"type": "blocks_planned", "count": len(entity_blocks), "block_types": [b.entity_type for b in entity_blocks]}

    # Stage 3: Emit title + follow_ups immediately
    yield {
        "type":               "meta",
        "title":              scene.title,
        "follow_ups":         scene.follow_ups,
        "learning_objective": scene.learning_objective,
    }

    _CODEGEN_LABELS = {
        "slide_deck":    "Generating presentation slides…",
        "p5_sketch":     "Rendering animation…",
        "freeform_html": "Building interactive widget…",
    }

    # Stage 4: Emit blocks — codegen entities emit a stage event while waiting
    for block in scene.blocks:
        if block.type == "entity" and block.entity_type in ("freeform_html", "p5_sketch", "slide_deck"):
            spec      = block.props.get("spec", "an interactive widget")
            stage_id  = f"building_{block.id}"
            _t0 = time.monotonic()
            yield {"type": "stage", "stage": stage_id, "label": _CODEGEN_LABELS.get(block.entity_type, "Building widget…"), "entity_type": block.entity_type}
            try:
                if block.entity_type == "p5_sketch":
                    raw_html = await _run_p5_codegen(spec, selection.enriched_prompt, svc=codegen_svc)
                    block.html = _wrap_in_sandbox(raw_html)
                elif block.entity_type == "slide_deck":
                    raw_html = await _run_slide_codegen(spec, selection.enriched_prompt, svc=codegen_svc)
                    block.html = raw_html  # SlideDeck component handles its own iframe sandbox
                else:
                    raw_html = await _run_codegen(spec, selection.enriched_prompt, svc=codegen_svc)
                    block.html = _wrap_in_sandbox(raw_html)
            except Exception as exc:
                logger.error("codegen_failed", block=block.id, error=str(exc))
                block.html = _wrap_in_sandbox(
                    "<p style='color:#f03e3e;font-family:system-ui'>Widget generation failed.</p>"
                )
            yield {"type": "stage_done", "stage": stage_id, "duration_s": round(time.monotonic() - _t0, 1)}
        yield {"type": "block", "block": block.dict()}

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

    yield {"type": "done", "session_id": session_id}
