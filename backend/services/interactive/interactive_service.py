"""
Interactive Mode pipeline — produces a Scene IR via SSE events.

SSE event sequence:
  { type: "meta",  title, follow_ups }          ← emitted right after scene planning
  { type: "block", block: { id, type, ... } }   ← one per block in order; freeform_html
                                                    and p5_sketch blocks are delayed until
                                                    codegen finishes
  { type: "done",  session_id }

Pipeline stages:
  1. classify_intent    → domain
  2. _select_entities   → 2–5 entity names best suited to the question
  3. _plan_scene        → SceneIR (uses full schemas only for selected entities)
  4. codegen (if needed) for freeform_html / p5_sketch blocks

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
import logging
import os
from typing import AsyncGenerator

from services.frame_generation.planner import classify_intent, _extract_json, request_llm_service
from services.interactive.scene_ir import SceneBlock, SceneIR
from services.llm_service import default_llm_service

logger = logging.getLogger(__name__)

_PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "prompts")
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
    """Load the full schema for a single entity from catalog/<entity_name>.md."""
    path = os.path.join(_CATALOG_DIR, f"{entity_name}.md")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return f.read()
    return ""


def _build_catalog(selected_entities: list[str]) -> str:
    """
    Build the catalog section for the planner prompt.

    Full schemas are loaded only for selected_entities.
    The slim_index is always appended so the planner knows all entity types exist
    and can use any of them (with lower fidelity) even if not in the selected set.
    """
    header = (
        "## Component Catalog\n\n"
        "### Entity block format — always use this exact shape\n\n"
        '```json\n{ "id": "<b1>", "type": "entity", "entity_type": "<name>", "props": {} }\n```\n\n'
        '`"type"` is ALWAYS the literal `"entity"`. `"entity_type"` holds the component name.\n'
    )

    schemas = [_load_entity_schema(e) for e in selected_entities]
    schemas = [s for s in schemas if s]  # drop any that weren't found

    slim_fallback = _load_prompt("slim_index.md")

    parts = [header] + schemas + [slim_fallback]
    return "\n\n---\n\n".join(parts)


def _wrap_in_sandbox(raw_html: str) -> str:
    """
    Security boundary: sandbox="allow-scripts" without allow-same-origin gives
    the iframe a null origin, blocking localStorage/cookies/document.cookie.
    No regex sanitizer — the sandbox IS the sanitizer.
    """
    escaped = html.escape(raw_html, quote=True)
    return (
        '<iframe sandbox="allow-scripts" '
        f'srcdoc="{escaped}" '
        'style="width:100%;height:420px;border:none;border-radius:8px" '
        'title="interactive-widget"></iframe>'
    )


async def _run_codegen_with_prompt(prompt_file: str, spec: str, user_prompt: str) -> str:
    """Call the codegen LLM using the given prompt template file."""
    template = _load_prompt(prompt_file)
    prompt = (
        template
        .replace("{{ENTITY_SPEC}}", spec)
        .replace("{{USER_PROMPT}}", user_prompt)
    )
    svc = request_llm_service.get() or default_llm_service
    raw = await asyncio.to_thread(
        svc.make_single_prompt_request, prompt, "", None, False, max_tokens=4000
    )
    result, _ = raw if isinstance(raw, tuple) else (raw, {})
    if result is None:
        raise RuntimeError("Codegen LLM returned None")
    result = result.strip()
    if result.startswith("```"):
        result = result.split("\n", 1)[-1]
        result = result.rsplit("```", 1)[0]
    return result.strip()


async def _run_codegen(spec: str, user_prompt: str) -> str:
    """Produce freeform Canvas HTML (raw JS, no framework)."""
    return await _run_codegen_with_prompt("canvas_codegen.md", spec, user_prompt)


async def _run_p5_codegen(spec: str, user_prompt: str) -> str:
    """Produce a p5.js looping animation sketch."""
    return await _run_codegen_with_prompt("canvas_codegen_p5.md", spec, user_prompt)


async def _select_entities(
    message: str,
    domain: str,
    conversation_context: str,
) -> list[str]:
    """
    Intermediate LLM call: given the question + slim entity index, return the 2–5
    entity names best suited to explain the concept.

    Falls back to empty list on any error — _plan_scene then uses the full catalog.
    """
    slim_index = _load_prompt("slim_index.md")
    selector_template = _load_prompt("entity_selector.md")
    selector_prompt = selector_template.replace("{{SLIM_INDEX}}", slim_index)

    context_block = f"Conversation context:\n{conversation_context}\n\n" if conversation_context else ""
    user_msg = f"{context_block}Domain: {domain}\n\nQuestion: {message}"

    svc = request_llm_service.get() or default_llm_service
    try:
        raw, _ = await asyncio.to_thread(
            svc.make_system_user_request, selector_prompt, user_msg, max_tokens=150
        )
        if raw is None:
            return []

        data = _extract_json(raw)
        entities: list[str] = data.get("entities", [])

        # Enforce mandatory pairing: code_walkthrough always needs step_controls
        if "code_walkthrough" in entities and "step_controls" not in entities:
            entities.append("step_controls")

        logger.info("entity_selector selected=%s", entities)
        return entities

    except Exception as exc:
        logger.warning("entity_selector failed (%s) — falling back to full catalog", exc)
        return []


async def _plan_scene(
    message: str,
    domain: str,
    conversation_context: str,
    selected_entities: list[str],
) -> SceneIR:
    """Call the planner LLM and parse the Scene IR."""
    base       = _load_prompt("base_planner.md")
    domain_ctx = _load_domain_file(domain)

    if selected_entities:
        catalog = _build_catalog(selected_entities)
    else:
        # Fallback: load the full monolithic catalog if selector failed
        catalog = _load_prompt("component_catalog.md")

    system_prompt = "\n\n".join(filter(None, [base, domain_ctx, catalog]))

    context_block = (
        f"Conversation context:\n{conversation_context}\n\n"
        if conversation_context else ""
    )
    user_msg = f"{context_block}USER QUESTION: {message}"

    svc = request_llm_service.get() or default_llm_service
    raw, _ = await asyncio.to_thread(
        svc.make_system_user_request, system_prompt, user_msg, max_tokens=4000
    )
    if raw is None:
        raise RuntimeError("Scene planner LLM returned None")

    data = _extract_json(raw)
    data.setdefault("domain", domain)

    try:
        return SceneIR(**data)
    except Exception as exc:
        logger.error("Scene IR validation failed: %s | raw=%s", exc, raw[:500])
        raise


def _save_scene_ir(scene: SceneIR, output_dir: str) -> None:
    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, "scene_ir.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(scene.dict(), f, indent=2)


async def run_interactive_pipeline(
    message: str,
    session_id: str,
    output_dir: str,
    conversation_context: str,
) -> AsyncGenerator[dict, None]:
    """
    Main SSE generator for interactive mode.

    Yields dicts that the route handler serialises as SSE events.
    """
    # Stage 1: Classify → domain
    try:
        _, _, _, _, domain = await classify_intent(message, conversation_context)
    except Exception:
        domain = "general"

    logger.info("interactive_pipeline session=%s domain=%s", session_id, domain)

    # Stage 2: Select entities — focused intermediate call with slim index
    selected_entities = await _select_entities(message, domain, conversation_context)

    # Stage 3: Plan scene IR — planner gets full schemas only for selected entities
    scene = await _plan_scene(message, domain, conversation_context, selected_entities)

    # Stage 4: Emit title + follow_ups immediately
    yield {
        "type": "meta",
        "title": scene.title,
        "follow_ups": scene.follow_ups,
        "learning_objective": scene.learning_objective,
    }

    # Stage 5: Emit blocks in order.
    # Pre-built entities emit instantly; codegen entities wait for generation.
    for block in scene.blocks:
        if block.type == "entity" and block.entity_type in ("freeform_html", "p5_sketch"):
            spec = block.props.get("spec", "an interactive widget")
            try:
                if block.entity_type == "p5_sketch":
                    raw_html = await _run_p5_codegen(spec, message)
                else:
                    raw_html = await _run_codegen(spec, message)
                block.html = _wrap_in_sandbox(raw_html)
            except Exception as exc:
                logger.error("Codegen failed for block %s: %s", block.id, exc)
                block.html = _wrap_in_sandbox(
                    "<p style='color:#f03e3e;font-family:system-ui'>Widget generation failed.</p>"
                )
        yield {"type": "block", "block": block.dict()}

    # Stage 6: Persist and finish
    try:
        _save_scene_ir(scene, output_dir)
    except Exception as exc:
        logger.warning("Could not save scene_ir.json: %s", exc)

    yield {"type": "done", "session_id": session_id}
