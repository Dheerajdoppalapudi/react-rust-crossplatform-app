"""
Planner — Stages 1 & 2 of the multi-frame pipeline.

Stage 1 (create_plan):
    One LLM call that reads the user's prompt and decides:
    - How many frames are needed
    - What each frame should show (description)
    - What caption/label goes under each frame
    - A shared visual style so all frames look consistent

Stage 2 (generate_all_frames):
    N parallel LLM calls — one per frame — each producing a slim JSON
    that the excalidraw enhancer already understands.
    Uses asyncio.gather so all N calls run simultaneously.
"""

import asyncio
import json
import os
import re
from typing import List

from pydantic import BaseModel

from services.llm_service import default_llm_service


# ---------------------------------------------------------------------------
# Pydantic models — validate the planning call's JSON output
# ---------------------------------------------------------------------------

class SharedStyle(BaseModel):
    """Visual style applied consistently across every frame."""
    strokeColor: str = "#1e1e1e"
    backgroundColor: str = "#a5d8ff"
    roughness: int = 1


class FramePlan(BaseModel):
    """Everything needed to generate one frame."""
    index: int
    description: str   # self-contained prompt sent to the diagram generator
    caption: str       # short label placed below the frame on the canvas
    narration: str = ""  # 2-3 sentence teaching-voice explanation for this frame


class GenerationPlan(BaseModel):
    """Full plan returned by the planning call."""
    frame_count: int
    layout: str
    intent_type: str = "process"  # process | architecture | concept_analogy | math | comparison | timeline
    shared_style: SharedStyle
    element_vocabulary: dict = {}  # maps entity key → visual spec string, shared across all frames
    frames: List[FramePlan]


# ---------------------------------------------------------------------------
# Modular LLM call
# ---------------------------------------------------------------------------

def call_llm(prompt: str) -> str:
    """
    Single entry point for all LLM calls in the image generation pipeline.

    Sends a single-prompt request through the shared LLMService instance
    and returns the raw text response.

    Using one function here means:
    - Swapping the LLM provider only requires changing this function.
    - All calls (planning + frame generation) share the same config.
    - Easy to add logging, retries, or token counting in one place.

    Args:
        prompt: The full prompt string to send to the model.

    Returns:
        The model's text reply as a string.

    Raises:
        RuntimeError: If the LLM service returns None (network/auth failure).
    """
    result = default_llm_service.make_single_prompt_request(prompt)
    if result is None:
        raise RuntimeError("LLM service returned None — check server connectivity and credentials.")
    return result


# ---------------------------------------------------------------------------
# JSON extraction helper
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> dict:
    """
    Pull a JSON object out of an LLM response.
    Handles two common cases:
      1. Raw JSON (ideal — what we asked for)
      2. JSON wrapped in markdown code fences (```json ... ```)
    """
    # Try markdown code fences first
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))

    # Fall back to first bare JSON object in the text
    obj = re.search(r"\{.*\}", text, re.DOTALL)
    if obj:
        return json.loads(obj.group())

    raise ValueError(f"No JSON object found in LLM response:\n{text[:300]}")


# ---------------------------------------------------------------------------
# Stage 1 — Planning call
# ---------------------------------------------------------------------------

async def create_plan(user_prompt: str) -> GenerationPlan:
    """
    Ask the LLM to plan the full multi-frame sequence.

    Loads planning_prompt.md, injects the user's prompt, calls the LLM
    via call_llm(), and validates the response with Pydantic.

    The LLMService.make_single_prompt_request is synchronous (uses requests),
    so we run it in a thread via asyncio.to_thread to avoid blocking the
    FastAPI event loop while waiting for the HTTP response.

    Returns a GenerationPlan with frame_count, shared_style, and one
    FramePlan per frame (each containing description + caption).
    """
    template_path = os.path.join(os.path.dirname(__file__), "planning_prompt.md")
    with open(template_path) as f:
        prompt = f.read().replace("{{USER_PROMPT}}", user_prompt)

    # Run the synchronous call_llm in a thread so the event loop stays free
    raw = await asyncio.to_thread(call_llm, prompt)
    plan_dict = _extract_json(raw)
    return GenerationPlan(**plan_dict)


# ---------------------------------------------------------------------------
# Stage 2 — Single frame generation
# ---------------------------------------------------------------------------

async def _generate_one_frame(
    frame: FramePlan,
    shared_style: SharedStyle,
    prompt_template: str,
    element_vocabulary: dict = {},
) -> dict:
    """
    Generate the slim JSON for a single frame.

    Injects the frame's self-contained description + the shared style
    constraints + the element vocabulary into prompt_template.md, then
    calls the LLM via call_llm().

    The style note forces the model to use the same colors and roughness
    as every other frame. The vocabulary note forces the model to reuse
    the exact same shape/color/size for recurring entities, ensuring
    visual consistency across all frames generated in parallel.
    """
    style_note = (
        f"\n\nStyle constraints (strictly follow for consistency across all frames):\n"
        f'- strokeColor must be "{shared_style.strokeColor}" on all elements\n'
        f'- Use "{shared_style.backgroundColor}" as the primary backgroundColor for key shapes\n'
        f"- roughness must be {shared_style.roughness} on all elements\n"
        f"- IMPORTANT: use string IDs (e.g. \"box1\", \"arrow_ab\") for every element "
        f"and in all arrow from/to fields — never use integer indices"
    )

    vocab_note = ""
    if element_vocabulary:
        lines = [f'  - "{k}": {v}' for k, v in element_vocabulary.items()]
        vocab_note = (
            "\n\nElement vocabulary (STRICTLY reproduce these exact specs for each named entity "
            "— same shape type, backgroundColor, width, height, and label as defined here. "
            "This is critical for visual consistency across frames):\n"
            + "\n".join(lines)
        )

    description = frame.description + style_note + vocab_note
    prompt = prompt_template.replace("{{DIAGRAM_DESCRIPTION}}", description)

    raw = await asyncio.to_thread(call_llm, prompt)
    return _extract_json(raw)


# ---------------------------------------------------------------------------
# Stage 2 — All frames in parallel
# ---------------------------------------------------------------------------

async def generate_all_frames(
    plan: GenerationPlan,
    prompt_template: str,
) -> List[dict]:
    """
    Run all frame generation calls simultaneously using asyncio.gather.

    Each frame's call goes through call_llm() → asyncio.to_thread, so
    all N HTTP requests to the LLM server run concurrently without
    blocking each other or the event loop.

    If any individual frame fails (bad JSON, network error, etc.) it is
    replaced with an empty elements list so the rest of the pipeline
    continues — a bad frame shows as blank rather than crashing everything.

    Returns a list of slim JSON dicts, one per frame, in order.
    """
    tasks = [
        _generate_one_frame(frame, plan.shared_style, prompt_template, plan.element_vocabulary)
        for frame in plan.frames
    ]

    # return_exceptions=True means a failed task returns an Exception
    # object instead of raising and cancelling the other tasks
    results = await asyncio.gather(*tasks, return_exceptions=True)

    slims = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"[planner] Frame {i} failed: {result}")
            slims.append({"elements": []})  # blank fallback
        else:
            slims.append(result)

    return slims
