"""
Planner — pipeline orchestration for all render paths.

Stage 1A — create_vocab_plan():
  One LLM call routed by intent: planning_svg.md (all non-math intents),
  planning_math.md (math).
  Builds element_vocabulary with entity identity and animation_behavior — no pixel coordinates.

_vocab_plan_to_generation_plan():
  Pure Python conversion. Builds FramePlan objects from the vocab plan.
  Used by all render paths (Manim, Mermaid, SVG, slim JSON fallback).
"""

import asyncio
import json
import logging
import os
import re
import time
from contextvars import ContextVar

logger = logging.getLogger(__name__)
from typing import List, Union

from pydantic import BaseModel, field_validator

from core.config import CLASSIFY_MODEL
from services.llm_service import LLMService, ClaudeProvider, OpenAIProvider, default_llm_service

# Per-request lifecycle log. main.py sets this before each pipeline run.
request_log: ContextVar[list | None] = ContextVar("request_log", default=None)

# Per-request token accumulator. main.py resets this before each pipeline run.
# Holds prompt/completion/total token counts + Anthropic cache token counts.
token_usage: ContextVar[dict | None] = ContextVar("token_usage", default=None)

# Per-request LLM service override. When set, call_llm() uses this instead of
# default_llm_service — allows the UI to choose Claude vs OpenAI per request.
request_llm_service: ContextVar[LLMService | None] = ContextVar("request_llm_service", default=None)

_classify_service = LLMService(provider=OpenAIProvider(model="gpt-4.1-mini"))

# Calibrated max_tokens per planning call type.
# These are generous upper bounds based on observed output sizes; setting them
# lower than 8192 reduces billing for unused token budget.
_VOCAB_PLAN_MAX_TOKENS: dict[str, int] = {
    "math":           4000,   # continuity + visual_objects fields are verbose
    "illustration":   3500,
    "concept_analogy":3500,
    "comparison":     3500,
    # All non-math intents now route through SVG planning
    "process":        3500,
    "architecture":   3500,
    "timeline":       3500,
}


def _accumulate_tokens(usage: dict):
    """Add one call's usage into the per-request running total."""
    acc = token_usage.get()
    if acc is None or not usage:
        return
    acc["prompt_tokens"]              += usage.get("prompt_tokens", 0)
    acc["completion_tokens"]          += usage.get("completion_tokens", 0)
    acc["total_tokens"]               += usage.get("total_tokens", 0)
    acc["cache_creation_input_tokens"] += usage.get("cache_creation_input_tokens", 0)
    acc["cache_read_input_tokens"]     += usage.get("cache_read_input_tokens", 0)


def _log(entry: dict):
    """Append a timestamped entry to the active request log (no-op if not set)."""
    log = request_log.get()
    if log is not None:
        log.append({"timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **entry})


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SharedStyle(BaseModel):
    """Visual style applied consistently across every frame."""
    strokeColor: str = "#1e1e1e"
    backgroundColor: str = "#a5d8ff"
    strokeWidth: int = 2
    palette: dict = {}   # math path: color-as-meaning map (primary, secondary, accent, …)


class VocabEntry(BaseModel):
    """One entity in the element_vocabulary (Phase A output)."""
    entity_type: str = "generic"   # browser | server | database | router | person | document | api | phone | cloud | queue | generic
    visual: str = ""               # free-text description for generic entities
    fill: str = "#a5d8ff"
    label: str = ""
    animation_behavior: str = "enter"   # enter | loop | static
    loop_speed: str = ""                # fast | medium | slow (only meaningful when animation_behavior=="loop")


class VocabularyPlan(BaseModel):
    """
    Phase A output — what to teach, which entities exist, no coordinates.
    Used to drive Prompt 2 (icon generation) before spatial math runs.
    """
    intent_type: str = "process"
    frame_count: int
    shared_style: SharedStyle
    element_vocabulary: dict = {}   # entity_key → VocabEntry (or raw dict — both accepted)
    frames: list = []               # list of dicts with teaching_intent, entities_used, caption, narration
    slide_frames: list = []         # optional list of chapter_intro / text_slide specs
    visual_objects: list = []       # math path: objects with persists_frames for cross-frame continuity
    continuity_plan: dict = {}      # math path: persistent_objects + transition_strategy
    visual_strategy: str = ""       # math path: e.g. "network_diagram", "equation_cascade"
    suggested_followups: List[str] = []
    notes: Union[str, List[str]] = ""

    @field_validator("notes", mode="before")
    @classmethod
    def coerce_notes(cls, v):
        if isinstance(v, list):
            return "\n".join(v)
        return v


class FramePlan(BaseModel):
    """Everything needed to generate one SVG frame."""
    index: int
    description: str       # complete ordered draw list — sent to Prompt 3
    caption: str
    narration: str = ""
    spatial_plan: dict = {}
    intent_type: str = ""
    reveal_order: list = []   # ordered list of entity_keys to animate in (planning_svg.md output)
    animation_spec: dict = {} # {entity_key: {behavior, speed}} — derived from element_vocabulary


class GenerationPlan(BaseModel):
    """
    Full plan — Phase B output.
    Contains all pixel coordinates and complete frame descriptions.
    Used by svg_generator to drive Prompt 3.
    """
    frame_count: int
    layout: str = "horizontal"
    intent_type: str = "process"
    canvas: dict = {}
    shared_style: SharedStyle
    element_vocabulary: dict = {}
    frames: List[FramePlan]
    slide_frames: list = []         # optional list of chapter_intro / text_slide specs
    visual_objects: list = []       # math path: cross-frame persistent objects
    continuity_plan: dict = {}      # math path: persistent_objects + transition_strategy
    visual_strategy: str = ""       # math path: composition pattern
    suggested_followups: List[str] = []
    notes: Union[str, List[str]] = ""

    @field_validator("notes", mode="before")
    @classmethod
    def coerce_notes(cls, v):
        if isinstance(v, list):
            return "\n".join(v)
        return v


# ---------------------------------------------------------------------------
# LLM call
# ---------------------------------------------------------------------------

def call_llm(
    prompt: str,
    max_tokens: int = 8192,
    prompt_name: str = "",
    cache_prefix: str = "",
    override_service: LLMService = None,
    tool_schema: dict = None,
    json_mode: bool = False,
) -> str:
    """
    Single entry point for all LLM calls in the pipeline.

    max_tokens: calibrated per call-type — see _VOCAB_PLAN_MAX_TOKENS and
        per-generator constants. Default 8192 kept for backwards compat.

    cache_prefix: static portion of the prompt template (Anthropic only).
        When set, the message is split into a cached block + dynamic block,
        reducing cost by ~90% on the static tokens for repeated calls.

    override_service: use this LLMService instead of the per-request context
        var. Used by plan_and_classify() which always runs on Haiku.

    json_mode: if True, tells OpenAI to return guaranteed-valid JSON
        (response_format=json_object). No-op for Claude.

    tool_schema: reserved for future use. Adds tool_use forcing in Claude
        at the cost of ~500 extra uncacheable input tokens — leave None
        unless a specific call is known to fail JSON parsing.
    """
    label = prompt_name or "unknown"
    svc = override_service or request_llm_service.get() or default_llm_service
    model = getattr(svc.provider, "model", "unknown")
    logger.info(
        "LLM call  prompt=%s  model=%s  chars=%d  cache=%s",
        label, model, len(prompt), "yes" if cache_prefix else "no",
    )
    result, usage = svc.make_single_prompt_request(
        prompt,
        cache_prefix=cache_prefix,
        max_tokens=max_tokens,
        tool_schema=tool_schema,
        json_mode=json_mode,
    )
    if result is None:
        raise RuntimeError("LLM service returned None — check server connectivity and credentials.")
    _accumulate_tokens(usage)
    total_tokens = (usage or {}).get("total_tokens", 0)
    cache_read   = (usage or {}).get("cache_read_input_tokens", 0)
    cache_create = (usage or {}).get("cache_creation_input_tokens", 0)
    logger.info(
        "LLM done  prompt=%s  model=%s  tokens=%d  cache_read=%d  cache_create=%d",
        label, model, total_tokens, cache_read, cache_create,
    )
    _log({
        "event": "llm_call",
        "prompt_name": label,
        "prompt_preview": prompt[:600] + ("…" if len(prompt) > 600 else ""),
        "response_preview": result[:600] + ("…" if len(result) > 600 else ""),
        "full_prompt": prompt,
        "full_response": result,
        "usage": usage,
    })
    return result


# ---------------------------------------------------------------------------
# JSON extraction
# ---------------------------------------------------------------------------

def _strip_trailing_commas(text: str) -> str:
    """Remove trailing commas before ] or } — Claude often produces JSON5-style output."""
    return re.sub(r",\s*([}\]])", r"\1", text)


def _extract_json(text: str) -> dict:
    """
    Pull the top-level JSON object out of an LLM response.

    Only attempts the FIRST '{' found — never falls back to inner sub-objects,
    which would silently return the wrong dict (e.g. a canvas sub-object
    instead of the full GenerationPlan).
    """
    decoder = json.JSONDecoder()

    # Try markdown fence content first
    fence = re.search(r"```(?:json)?\s*(\{.*?)\s*```", text, re.DOTALL)
    if fence:
        candidate = _strip_trailing_commas(fence.group(1).strip())
        try:
            obj, _ = decoder.raw_decode(candidate)
            return obj
        except json.JSONDecodeError:
            pass

    # Find the first '{' — this must be the top-level object
    start = text.find("{")
    if start == -1:
        raise ValueError(f"No JSON object found in LLM response:\n{text[:300]}")

    cleaned = _strip_trailing_commas(text)
    start = cleaned.find("{")
    try:
        obj, _ = decoder.raw_decode(cleaned, start)
        return obj
    except json.JSONDecodeError as e:
        raise ValueError(
            f"JSON parse error at char {e.pos}: {e.msg}\n"
            f"Near: …{cleaned[max(0, e.pos - 80):e.pos + 80]}…"
        ) from e


# ---------------------------------------------------------------------------
# Unified first call — plan_and_classify
# ---------------------------------------------------------------------------

# Mode-specific output schema injected into planning_classify.md via {{MODE_RULES}}.
_MODE_RULES: dict[tuple[str, bool], str] = {
    ("instant", False): """\
## Output schema (JSON only — no prose, no markdown fences)
{
  "domain": "physics|cs|chemistry|biology|math|history|economics|general",
  "enriched_prompt": "<2-4 sentence specific learning spec with mechanisms and numbers>",
  "suggested_followups": ["<q1>", "<q2>", "<q3>"],
  "needs_search": false
}
Set needs_search=true and add "search_queries":["q1","q2","q3"] when the question
requires current statistics, recent events, or specific data the model cannot reliably
produce from training data alone. Never add search_queries if needs_search is false.""",

    ("deep_research", False): """\
## Output schema (JSON only — no prose, no markdown fences)
{
  "domain": "physics|cs|chemistry|biology|math|history|economics|general",
  "enriched_prompt": "<2-4 sentence specific learning spec with mechanisms and numbers>",
  "suggested_followups": ["<q1>", "<q2>", "<q3>"],
  "search_queries": ["<precise query 1>", "<q2>", "<q3>", "<q4>", "<q5>"],
  "sub_questions": ["<deeper angle 1>", "<deeper angle 2>"]
}
Quality rules:
- search_queries: write like a researcher — precise terminology, avoid vague "what is X" phrasing
- If prior conversation context is given: target queries at NEW information not already covered
- sub_questions: angles the main queries might miss; used only if round-1 finds < 5 results""",

    ("instant", True): """\
## Output schema (JSON only — no prose, no markdown fences)
{
  "domain": "physics|cs|chemistry|biology|math|history|economics|general",
  "intent_type": "math|process|architecture|timeline|concept_analogy|comparison|illustration",
  "frame_count": <integer 2-6>,
  "notes": ["<key fact 1>", "<fact 2>", "<fact 3>", "<fact 4>", "<fact 5>"],
  "enriched_prompt": "<2-4 sentence learning spec>",
  "suggested_followups": ["<q1>", "<q2>", "<q3>"],
  "needs_search": false
}
Frame count: math(2-5), process/timeline(3-5), others(2-4). Fewer is better — never pad.
Biology / natural science → always illustration intent_type.
Set needs_search=true and add "search_queries":["q1","q2","q3"] for current data needs.""",

    ("deep_research", True): """\
## Output schema (JSON only — no prose, no markdown fences)
{
  "domain": "physics|cs|chemistry|biology|math|history|economics|general",
  "intent_type": "math|process|architecture|timeline|concept_analogy|comparison|illustration",
  "frame_count": <integer 2-6>,
  "notes": ["<key fact 1>", "<fact 2>", "<fact 3>", "<fact 4>", "<fact 5>"],
  "enriched_prompt": "<2-4 sentence learning spec>",
  "suggested_followups": ["<q1>", "<q2>", "<q3>"],
  "search_queries": ["<precise query 1>", "<q2>", "<q3>", "<q4>", "<q5>"],
  "sub_questions": ["<deeper angle 1>", "<deeper angle 2>"]
}
Frame count: math(2-5), process/timeline(3-5), others(2-4). Biology → illustration.
search_queries: precise terminology, write like a researcher.""",
}


async def plan_and_classify(
    message:              str,
    research_mode:        str,
    video_enabled:        bool,
    conversation_context: str = "",
    prior_synthesis:      str = "",
) -> dict:
    """
    Unified first Haiku call — single intent classification + search planning call.

    Returns a dict with all fields needed by the generation pipeline:
      Interactive: domain, enriched_prompt, suggested_followups, needs_search?, search_queries?, sub_questions?
      Video:       + intent_type, frame_count, notes
    Always uses Haiku (_classify_service) regardless of the per-request model.
    """
    _prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")
    with open(os.path.join(_prompts_dir, "planning_classify.md")) as f:
        template = f.read()

    mode_key = (research_mode, video_enabled)
    mode_rules = _MODE_RULES.get(mode_key, _MODE_RULES[("instant", video_enabled)])

    context_parts: list[str] = []
    if prior_synthesis:
        context_parts.append(f"Prior answer context:\n{prior_synthesis}")
    if conversation_context:
        context_parts.append(f"Conversation history:\n{conversation_context}")
    context_block = ("\n\n".join(context_parts) + "\n\n") if context_parts else ""

    prompt = (
        template
        .replace("{{MODE_RULES}}", mode_rules)
        .replace("{{USER_PROMPT}}", message)
        .replace("{{CONVERSATION_CONTEXT}}", context_block)
    )

    raw = await asyncio.to_thread(
        call_llm, prompt, 1500,
        prompt_name="plan_and_classify",
        override_service=_classify_service,
    )
    data = _extract_json(raw)

    # Normalise and validate fields
    result: dict = {
        "domain":              data.get("domain", "general"),
        "enriched_prompt":     data.get("enriched_prompt", message),
        "suggested_followups": data.get("suggested_followups", []),
        "needs_search":        bool(data.get("needs_search", False)),
        "search_queries":      data.get("search_queries", []),
        "sub_questions":       data.get("sub_questions", []),
    }
    if video_enabled:
        result["intent_type"] = data.get("intent_type", "process")
        result["frame_count"]  = max(2, min(8, int(data.get("frame_count", 3))))
        result["notes"]        = data.get("notes", [])
    return result



async def create_vocab_plan(
    user_prompt: str,
    conversation_context: str = "",
    intent_type: str = "process",
    frame_count: int = 3,
) -> VocabularyPlan:
    """
    Call 2 — intent-specific planning.
    Routes to planning_math.md (math) or planning_svg.md (all non-math intents).
    intent_type and frame_count come from plan_and_classify().
    """
    _prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")
    context_block = f"Conversation context:\n{conversation_context}\n\n" if conversation_context else ""

    if intent_type == "math":
        prompt_file = "planning_math.md"
    else:
        # All non-math intents (illustration, concept_analogy, comparison,
        # process, architecture, timeline) → SVG animated path
        prompt_file = "planning_svg.md"

    with open(os.path.join(_prompts_dir, prompt_file)) as f:
        template = f.read()

    prompt = (
        template
        .replace("{{USER_PROMPT}}", user_prompt)
        .replace("{{CONVERSATION_CONTEXT}}", context_block)
        .replace("{{INTENT_TYPE}}", intent_type)
        .replace("{{FRAME_COUNT}}", str(frame_count))
    )

    # Cache prefix: the large static instruction block of the template.
    # Split at {{CONVERSATION_CONTEXT}} (or {{USER_PROMPT}}) — everything
    # before these markers is pure instructions that never changes between
    # requests, so Anthropic can reuse it at 10% of normal token cost.
    _split_markers = ("{{CONVERSATION_CONTEXT}}", "{{USER_PROMPT}}")
    cache_prefix = ""
    for marker in _split_markers:
        split_idx = template.find(marker)
        if split_idx != -1:
            # Substitute the small header tokens (INTENT_TYPE, FRAME_COUNT)
            # that appear before the split point, so the cached text matches
            # the assembled prompt exactly.
            static_raw = template[:split_idx]
            cache_prefix = (
                static_raw
                .replace("{{INTENT_TYPE}}", intent_type)
                .replace("{{FRAME_COUNT}}", str(frame_count))
            )
            break

    max_tokens = _VOCAB_PLAN_MAX_TOKENS.get(intent_type, 2500)
    raw = await asyncio.to_thread(
        call_llm, prompt, max_tokens,
        prompt_name=prompt_file,
        cache_prefix=cache_prefix,
        json_mode=True,   # OpenAI: guarantees valid JSON; Claude: no-op (prompt already asks for JSON)
    )

    plan_dict = _extract_json(raw)
    # Always enforce Call 1's classification — never let Call 2 override it
    plan_dict["intent_type"] = intent_type
    plan_dict["frame_count"] = frame_count
    return VocabularyPlan(**plan_dict)


# ---------------------------------------------------------------------------
# Convert VocabularyPlan → GenerationPlan (no LLM call — used by all non-SVG paths)
# ---------------------------------------------------------------------------

def _vocab_plan_to_generation_plan(vocab_plan: VocabularyPlan) -> GenerationPlan:
    """
    Converts a VocabularyPlan (phase A output) into a GenerationPlan that all
    non-SVG renderers (Mermaid, Manim, slim JSON) can consume.

    Builds frame.description from teaching_intent + entities_used + narration —
    no pixel coordinates. Mermaid and Manim handle their own layout internally;
    slim JSON lets the LLM place elements without forced coord math.
    """
    # Build animation_spec from element_vocabulary animation fields.
    # {entity_key: {"behavior": "enter"|"loop"|"static", "speed": "fast"|"medium"|"slow"}}
    animation_spec: dict = {}
    for key, entry in vocab_plan.element_vocabulary.items():
        if isinstance(entry, dict):
            behavior = entry.get("animation_behavior", "enter")
            speed    = entry.get("loop_speed", "")
        else:
            behavior = getattr(entry, "animation_behavior", "enter")
            speed    = getattr(entry, "loop_speed", "")
        animation_spec[key] = {"behavior": behavior, "speed": speed}

    frames = []
    for i, f in enumerate(vocab_plan.frames):
        entities = f.get("entities_used", [])
        entities_line = f"Entities present: {', '.join(entities)}\n" if entities else ""
        # math path extras — included when present so Manim generator has full context
        focus_line = f"Visual focus: {f['visual_focus']}\n" if f.get("visual_focus") else ""
        builds_line = f"Builds on: {f['builds_on']}\n" if f.get("builds_on") and f.get("builds_on") != "none" else ""
        description = (
            f"{f.get('teaching_intent', '')}\n"
            f"{focus_line}"
            f"{builds_line}"
            f"{entities_line}"
            f"Narration: {f.get('narration', '')}"
        )
        frames.append(FramePlan(
            index=i,
            description=description,
            caption=f.get("caption", ""),
            narration=f.get("narration", ""),
            intent_type=vocab_plan.intent_type,
            reveal_order=f.get("reveal_order", []),
            animation_spec=animation_spec,
        ))
    return GenerationPlan(
        frame_count=vocab_plan.frame_count,
        layout="horizontal",
        intent_type=vocab_plan.intent_type,
        shared_style=vocab_plan.shared_style,
        element_vocabulary=vocab_plan.element_vocabulary,
        frames=frames,
        slide_frames=vocab_plan.slide_frames,
        visual_objects=vocab_plan.visual_objects,
        continuity_plan=vocab_plan.continuity_plan,
        visual_strategy=vocab_plan.visual_strategy,
        suggested_followups=vocab_plan.suggested_followups,
        notes=vocab_plan.notes,
    )


# ---------------------------------------------------------------------------
# Stage 2 — Single frame generation (non-SVG paths only)
# ---------------------------------------------------------------------------

async def _generate_one_frame(
    frame: FramePlan,
    shared_style: SharedStyle,
    prompt_template: str,
    element_vocabulary: dict = {},
) -> dict:
    """Generate slim JSON for one frame (Mermaid / Manim paths)."""
    style_note = (
        f"\n\nStyle constraints (strictly follow for consistency across all frames):\n"
        f'- strokeColor must be "{shared_style.strokeColor}" on all elements\n'
        f'- Use "{shared_style.backgroundColor}" as the primary backgroundColor for key shapes\n'
        f"- IMPORTANT: use string IDs for every element and in all arrow from/to fields"
    )

    vocab_note = ""
    if element_vocabulary:
        lines = [f'  - "{k}": {v}' for k, v in element_vocabulary.items()]
        vocab_note = (
            "\n\nElement vocabulary (STRICTLY reproduce these exact specs for each named entity):\n"
            + "\n".join(lines)
        )

    description = frame.description + style_note + vocab_note
    prompt = prompt_template.replace("{{DIAGRAM_DESCRIPTION}}", description)

    # Cache the static template text; only the frame description is dynamic.
    split_idx = prompt_template.find("{{DIAGRAM_DESCRIPTION}}")
    cache_prefix = prompt_template[:split_idx] if split_idx != -1 else ""

    raw = await asyncio.to_thread(
        call_llm, prompt, 8192,
        prompt_name=f"prompt_template.md (frame {frame.index})",
        cache_prefix=cache_prefix,
    )
    return _extract_json(raw)


# ---------------------------------------------------------------------------
# Stage 2 — All frames in parallel (non-SVG paths only)
# ---------------------------------------------------------------------------

async def generate_all_frames(
    plan: GenerationPlan,
    prompt_template: str,
) -> List[dict]:
    """Run all frame generation calls concurrently (Mermaid / Manim paths)."""
    tasks = [
        _generate_one_frame(frame, plan.shared_style, prompt_template, plan.element_vocabulary)
        for frame in plan.frames
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    slims = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error("planner frame %d failed: %s", i, result)
            slims.append({"elements": []})
        else:
            slims.append(result)
    return slims
