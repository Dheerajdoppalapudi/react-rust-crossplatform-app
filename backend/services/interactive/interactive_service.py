"""
Interactive Mode pipeline — produces a Scene IR via SSE events.

SSE event sequence:
  { type: "meta",  title, follow_ups }          ← emitted right after scene planning
  { type: "block", block: { id, type, ... } }   ← one per block in order; freeform_html
                                                    blocks are delayed until codegen finishes
  { type: "done",  session_id }

Adding a new entity type: add its component to the frontend registry, its prop
schema to component_catalog.md, and one line to SceneBlock.validate_block.
No changes needed in this file.
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


def _load_prompt(filename: str) -> str:
    with open(os.path.join(_PROMPTS_DIR, filename), encoding="utf-8") as f:
        return f.read()


def _load_domain_file(domain: str) -> str:
    path = os.path.join(_DOMAINS_DIR, f"{domain}.md")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return f.read()
    return ""


def _wrap_in_sandbox(raw_html: str) -> str:
    """
    Security boundary: sandbox="allow-scripts" without allow-same-origin gives
    the iframe a null origin, blocking localStorage/cookies/document.cookie.
    The CSP header set on the SSE response blocks fetch/XHR/WebSocket.
    No regex sanitizer — the sandbox IS the sanitizer.
    """
    escaped = html.escape(raw_html, quote=True)
    return (
        '<iframe sandbox="allow-scripts" '
        f'srcdoc="{escaped}" '
        'style="width:100%;height:420px;border:none;border-radius:8px" '
        'title="interactive-widget"></iframe>'
    )


async def _run_codegen(spec: str, user_prompt: str) -> str:
    """Call the codegen LLM to produce freeform HTML for one entity."""
    template = _load_prompt("canvas_codegen.md")
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


async def _plan_scene(
    message: str,
    domain: str,
    conversation_context: str,
) -> SceneIR:
    """Call the planner LLM and parse the Scene IR."""
    base = _load_prompt("base_planner.md")
    domain_ctx = _load_domain_file(domain)
    catalog = _load_prompt("component_catalog.md")

    system_prompt = "\n\n".join(filter(None, [base, domain_ctx, catalog]))

    context_block = (
        f"Conversation context:\n{conversation_context}\n\n"
        if conversation_context else ""
    )
    user_msg = f"{context_block}USER QUESTION: {message}"

    svc = request_llm_service.get() or default_llm_service
    raw, _ = await asyncio.to_thread(
        svc.make_system_user_request, system_prompt, user_msg, max_tokens=2000
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
    # Stage 1: Classify (returns domain as 5th value)
    try:
        _, _, _, _, domain = await classify_intent(message, conversation_context)
    except Exception:
        domain = "general"

    logger.info("interactive_pipeline session=%s domain=%s", session_id, domain)

    # Stage 2: Plan scene IR
    scene = await _plan_scene(message, domain, conversation_context)

    # Stage 3: Emit title + follow_ups immediately — UI shows these before blocks arrive
    yield {
        "type": "meta",
        "title": scene.title,
        "follow_ups": scene.follow_ups,
    }

    # Stage 4: Emit blocks in order.
    # Pre-built entity blocks emit instantly; freeform_html blocks wait for codegen.
    for block in scene.blocks:
        if block.type == "entity" and block.entity_type == "freeform_html":
            spec = block.props.get("spec", "an interactive widget")
            try:
                raw_html = await _run_codegen(spec, message)
                block.html = _wrap_in_sandbox(raw_html)
            except Exception as exc:
                logger.error("Codegen failed for block %s: %s", block.id, exc)
                block.html = _wrap_in_sandbox(
                    "<p style='color:#f03e3e;font-family:system-ui'>Widget generation failed.</p>"
                )
        yield {"type": "block", "block": block.dict()}

    # Stage 5: Persist and finish
    try:
        _save_scene_ir(scene, output_dir)
    except Exception as exc:
        logger.warning("Could not save scene_ir.json: %s", exc)

    yield {"type": "done", "session_id": session_id}
