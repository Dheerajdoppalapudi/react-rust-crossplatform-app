"""
Planner — pipeline orchestration for all render paths.

Stage 1A — create_vocab_plan():
  One LLM call routed by intent: planning_svg.md (illustration/concept_analogy/comparison),
  planning_mermaid.md (process/architecture/timeline), planning_math.md (math).
  Builds element_vocabulary with entity identity — no pixel coordinates.

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

from services.llm_service import LLMService, default_llm_service

# Per-request lifecycle log. main.py sets this before each pipeline run.
request_log: ContextVar[list | None] = ContextVar("request_log", default=None)

# Per-request token accumulator. main.py resets this before each pipeline run.
# Holds {"prompt_tokens": int, "completion_tokens": int, "total_tokens": int}
token_usage: ContextVar[dict | None] = ContextVar("token_usage", default=None)

# Per-request LLM service override. When set, call_llm() uses this instead of
# default_llm_service — allows the UI to choose Claude vs OpenAI per request.
request_llm_service: ContextVar[LLMService | None] = ContextVar("request_llm_service", default=None)


def _accumulate_tokens(usage: dict):
    """Add one call's usage into the per-request running total."""
    acc = token_usage.get()
    if acc is None or not usage:
        return
    acc["prompt_tokens"]     += usage.get("prompt_tokens", 0)
    acc["completion_tokens"] += usage.get("completion_tokens", 0)
    acc["total_tokens"]      += usage.get("total_tokens", 0)


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

def call_llm(prompt: str, max_tokens: int = 8192, prompt_name: str = "") -> str:
    """
    Single entry point for all LLM calls in the pipeline.
    max_tokens defaults to 8192 — Phase B and component gen produce large JSON
    that easily exceeds the old 4096 default, causing mid-JSON truncation.
    """
    label = prompt_name or "unknown"
    logger.info("LLM call  prompt=%s  chars=%d", label, len(prompt))
    svc = request_llm_service.get() or default_llm_service
    result, usage = svc.make_single_prompt_request(prompt, max_tokens=max_tokens)
    if result is None:
        raise RuntimeError("LLM service returned None — check server connectivity and credentials.")
    _accumulate_tokens(usage)
    total_tokens = (usage or {}).get("total_tokens", 0)
    logger.info("LLM done  prompt=%s  tokens=%d", label, total_tokens)
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
        candidate = fence.group(1).strip()
        try:
            obj, _ = decoder.raw_decode(candidate)
            return obj
        except json.JSONDecodeError:
            pass

    # Find the first '{' — this must be the top-level object
    start = text.find("{")
    if start == -1:
        raise ValueError(f"No JSON object found in LLM response:\n{text[:300]}")

    try:
        obj, _ = decoder.raw_decode(text, start)
        return obj
    except json.JSONDecodeError as e:
        raise ValueError(
            f"JSON parse error at char {e.pos}: {e.msg}\n"
            f"Near: …{text[max(0, e.pos - 80):e.pos + 80]}…"
        ) from e


# ---------------------------------------------------------------------------
# Stage 1A — Vocabulary plan (no geometry)
# ---------------------------------------------------------------------------

async def classify_intent(user_prompt: str, conversation_context: str = "") -> tuple[str, int]:
    """
    Call 1 — tiny classification call.
    Returns (intent_type, frame_count). Fast and cheap (~300 tokens).
    """
    _prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")
    with open(os.path.join(_prompts_dir, "planning_classify.md")) as f:
        template = f.read()

    context_block = f"Conversation context:\n{conversation_context}\n\n" if conversation_context else ""
    prompt = (
        template
        .replace("{{USER_PROMPT}}", user_prompt)
        .replace("{{CONVERSATION_CONTEXT}}", context_block)
    )

    raw = await asyncio.to_thread(call_llm, prompt, 512, prompt_name="planning_classify.md")
    data = _extract_json(raw)
    intent_type = data.get("intent_type", "process")
    frame_count = max(2, min(8, int(data.get("frame_count", 3))))
    return intent_type, frame_count


async def create_vocab_plan(
    user_prompt: str,
    conversation_context: str = "",
    intent_type: str = "process",
    frame_count: int = 3,
) -> VocabularyPlan:
    """
    Call 2 — intent-specific planning.
    Routes to planning_math.md (math), planning_svg.md (illustration/concept_analogy/comparison),
    or planning_mermaid.md (process/architecture/timeline).
    intent_type and frame_count come from classify_intent() (Call 1).
    """
    _prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")
    context_block = f"Conversation context:\n{conversation_context}\n\n" if conversation_context else ""

    if intent_type == "math":
        prompt_file = "planning_math.md"
    elif intent_type in {"illustration", "concept_analogy", "comparison"}:
        prompt_file = "planning_svg.md"
    else:
        # process, architecture, timeline → Mermaid
        prompt_file = "planning_mermaid.md"

    with open(os.path.join(_prompts_dir, prompt_file)) as f:
        template = f.read()
    prompt = (
        template
        .replace("{{USER_PROMPT}}", user_prompt)
        .replace("{{CONVERSATION_CONTEXT}}", context_block)
        .replace("{{INTENT_TYPE}}", intent_type)
        .replace("{{FRAME_COUNT}}", str(frame_count))
    )
    raw = await asyncio.to_thread(call_llm, prompt, prompt_name=prompt_file)

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

    raw = await asyncio.to_thread(call_llm, prompt, prompt_name=f"prompt_template.md (frame {frame.index})")
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
