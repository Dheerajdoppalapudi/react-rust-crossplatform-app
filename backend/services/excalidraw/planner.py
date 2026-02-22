"""
Planner — Stages 1, 2a, 2b, and 2c of the multi-frame pipeline.

Stage 1  (create_plan):
    One LLM call. Decides frame count, captions, shared style, AND
    identifies recurring objects (components) that need a consistent
    visual definition across frames.

Stage 2a (generate_components):
    One LLM call per recurring component, all in parallel.
    Each call produces a slim JSON for just that object in isolation
    (no background, no scene). The result is a dict: {name -> slim JSON}.

Stage 2b (generate_frame_0):
    One LLM call for frame 0, with the component slim JSONs injected
    as context. Frame 0 establishes the background/environment style.

Stage 2c (generate_remaining_frames):
    N-1 parallel LLM calls for frames 1 through N-1.
    Each call receives both the component JSONs (for object consistency)
    AND frame 0's slim JSON (for background/environment consistency).

Final order: [frame_0_slim, frame_1_slim, ..., frame_N_slim]
"""

import asyncio
import json
import os
import re
from typing import Dict, List, Optional

from pydantic import BaseModel

from services.llm_service import default_llm_service


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SharedStyle(BaseModel):
    """Visual style applied consistently across every frame."""
    strokeColor: str = "#1e1e1e"
    backgroundColor: str = "#a5d8ff"
    roughness: int = 1


class ComponentDef(BaseModel):
    """
    A recurring visual object that appears in more than one frame.
    Generated once as a slim JSON and reused in every frame that needs it.
    """
    name: str          # e.g. "car", "person", "server"
    description: str   # how to draw it in isolation


class FramePlan(BaseModel):
    """Everything needed to generate one frame."""
    index: int
    description: str   # self-contained prompt, references components by name
    caption: str       # short label placed below the frame on the canvas


class GenerationPlan(BaseModel):
    """Full plan returned by the planning call."""
    frame_count: int
    layout: str
    shared_style: SharedStyle
    components: List[ComponentDef] = []   # empty = no recurring objects
    frames: List[FramePlan]


# ---------------------------------------------------------------------------
# Modular LLM call — single entry point for all LLM calls
# ---------------------------------------------------------------------------

def call_llm(prompt: str) -> str:
    """
    Send a prompt through the shared LLMService and return the raw text reply.

    All calls in the pipeline (planning, component generation, frame generation)
    go through here. To swap the LLM provider, change only this function.

    Raises RuntimeError if the service returns None (network / auth failure).
    """
    result = default_llm_service.make_single_prompt_request(prompt)
    if result is None:
        raise RuntimeError(
            "LLM service returned None — check server connectivity and credentials."
        )
    return result


# ---------------------------------------------------------------------------
# JSON extraction helper
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> dict:
    """
    Extract a JSON object from an LLM response.
    Handles raw JSON and JSON wrapped in markdown code fences.
    """
    fence = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))

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

    Returns a GenerationPlan containing:
    - frame_count, layout, shared_style
    - components: recurring objects that need a consistent visual definition
    - frames: per-frame description + caption
    """
    template_path = os.path.join(os.path.dirname(__file__), "planning_prompt.md")
    with open(template_path) as f:
        prompt = f.read().replace("{{USER_PROMPT}}", user_prompt)

    raw = await asyncio.to_thread(call_llm, prompt)
    plan_dict = _extract_json(raw)
    return GenerationPlan(**plan_dict)


# ---------------------------------------------------------------------------
# Stage 2a — Component generation (parallel)
# ---------------------------------------------------------------------------

async def _generate_one_component(
    comp: ComponentDef,
    shared_style: SharedStyle,
    prompt_template: str,
) -> dict:
    """
    Generate a slim JSON for a single component in isolation.

    The component is drawn standalone — no background, no scene — centered
    near the origin so it can be positioned anywhere by the frame generator.
    The prompt instructs the LLM to use namespaced string IDs (e.g. "car_body")
    so they stay unique when the component is reused across frames.
    """
    description = (
        f"Draw ONLY this single object in complete isolation.\n"
        f"No background, no road, no environment, no scene context. Just the object itself.\n\n"
        f"Object: {comp.description}\n\n"
        f"Positioning: place it starting at approximately x=60, y=60. Keep it compact.\n"
        f"Style: strokeColor='{shared_style.strokeColor}', "
        f"backgroundColor='{shared_style.backgroundColor}', "
        f"roughness={shared_style.roughness}.\n"
        f"IDs: use namespaced string IDs prefixed with '{comp.name}_' "
        f"(e.g. '{comp.name}_body', '{comp.name}_wheel_l'). "
        f"Never use integer indices."
    )
    prompt = prompt_template.replace("{{DIAGRAM_DESCRIPTION}}", description)
    raw = await asyncio.to_thread(call_llm, prompt)
    return _extract_json(raw)


async def generate_components(
    plan: GenerationPlan,
    prompt_template: str,
) -> Dict[str, dict]:
    """
    Generate slim JSONs for all recurring components in parallel.

    Returns a dict mapping component name to its slim JSON:
        {"car": {"elements": [...]}, "person": {"elements": [...]}}

    If a component generation fails, it gets an empty fallback so the
    pipeline continues without crashing.
    """
    if not plan.components:
        return {}

    tasks = [
        _generate_one_component(comp, plan.shared_style, prompt_template)
        for comp in plan.components
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    components_json: Dict[str, dict] = {}
    for comp, result in zip(plan.components, results):
        if isinstance(result, Exception):
            print(f"[planner] Component '{comp.name}' generation failed: {result}")
            components_json[comp.name] = {"elements": []}
        else:
            components_json[comp.name] = result

    return components_json


# ---------------------------------------------------------------------------
# Stage 2b / 2c — Frame generation (frame 0 first, then parallel)
# ---------------------------------------------------------------------------

def _build_frame_prompt(
    frame: FramePlan,
    shared_style: SharedStyle,
    prompt_template: str,
    components_json: Dict[str, dict],
    frame_0_slim: Optional[dict],
) -> str:
    """
    Build the full prompt for a single frame by assembling three sections:

    1. Frame description  — from the plan
    2. Style constraints  — same colors / roughness across all frames
    3. Component context  — exact slim JSON for each recurring object
       (frame generator copies elements, only repositions them)
    4. Frame 0 reference  — frame 0's slim JSON injected for background
       consistency in frames 1-N (skipped for frame 0 itself)
    """
    # ---- 1. Style note ----
    style_note = (
        f"\n\nStyle constraints (strictly follow for consistency across all frames):\n"
        f'- strokeColor: "{shared_style.strokeColor}" on all elements\n'
        f'- Primary backgroundColor: "{shared_style.backgroundColor}" for key shapes\n'
        f"- roughness: {shared_style.roughness} on all elements\n"
        f"- Use string IDs for ALL elements and arrow from/to refs — never integers"
    )

    # ---- 2. Component context ----
    component_note = ""
    if components_json:
        component_note = (
            "\n\nCOMPONENT DEFINITIONS — copy these element structures exactly. "
            "Do NOT redraw them from scratch:\n"
        )
        for name, slim in components_json.items():
            component_note += f"\n[{name}]:\n{json.dumps(slim, indent=2)}\n"

        component_note += (
            "\nINSTRUCTIONS for components:\n"
            "- Copy the component elements as-is into your output\n"
            "- Only change their x, y to position them in the scene\n"
            "- Keep width, height, strokeColor, backgroundColor identical\n"
            "- Preserve the component's element IDs exactly as defined above"
        )

    # ---- 3. Frame 0 background reference (frames 1-N only) ----
    frame_0_note = ""
    if frame_0_slim and frame.index > 0:
        frame_0_note = (
            f"\n\nFRAME 0 REFERENCE — use this for background/environment consistency:\n"
            f"{json.dumps(frame_0_slim, indent=2)}\n\n"
            f"INSTRUCTIONS for background:\n"
            f"- Use the same road/environment element types and proportions as frame 0\n"
            f"- Keep background colors and layout visually consistent\n"
            f"- Do NOT copy the component elements from this reference — "
            f"use the component definitions above instead"
        )

    full_description = frame.description + style_note + component_note + frame_0_note
    return prompt_template.replace("{{DIAGRAM_DESCRIPTION}}", full_description)


async def _generate_one_frame(
    frame: FramePlan,
    shared_style: SharedStyle,
    prompt_template: str,
    components_json: Dict[str, dict],
    frame_0_slim: Optional[dict] = None,
) -> dict:
    """Generate the slim JSON for a single frame using the assembled prompt."""
    prompt = _build_frame_prompt(
        frame, shared_style, prompt_template, components_json, frame_0_slim
    )
    raw = await asyncio.to_thread(call_llm, prompt)
    return _extract_json(raw)


async def generate_all_frames(
    plan: GenerationPlan,
    prompt_template: str,
    components_json: Optional[Dict[str, dict]] = None,
) -> List[dict]:
    """
    Generate all frame slim JSONs with the two-phase strategy:

    Phase A — Frame 0 (sequential):
        Generated first, with component context but no prior-frame reference.
        Establishes the background / environment that all other frames mirror.

    Phase B — Frames 1-N (parallel):
        All run simultaneously via asyncio.gather.
        Each receives:
          - component_json  → exact element definitions (Option 2: object consistency)
          - frame_0_slim    → frame 0's output as background reference (Option 1: env consistency)

    Failed frames fall back to empty elements so the pipeline never crashes.
    Returns a list of slim JSON dicts in frame order.
    """
    components_json = components_json or {}

    if not plan.frames:
        return []

    # Phase A — frame 0
    frame_0_slim = await _generate_one_frame(
        plan.frames[0], plan.shared_style, prompt_template, components_json
    )

    if plan.frame_count == 1:
        return [frame_0_slim]

    # Phase B — frames 1-N in parallel, referencing frame 0
    remaining_tasks = [
        _generate_one_frame(
            frame, plan.shared_style, prompt_template, components_json, frame_0_slim
        )
        for frame in plan.frames[1:]
    ]
    results = await asyncio.gather(*remaining_tasks, return_exceptions=True)

    slims = [frame_0_slim]
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"[planner] Frame {i + 1} failed: {result}")
            slims.append({"elements": []})
        else:
            slims.append(result)

    return slims
