"""
SVG Generator — frame generation for illustration, concept_analogy, and comparison content.

Pipeline per frame:
  1. LLM call  → raw SVG string  (parallel, via asyncio.gather)
  2. Extract SVG markup from the LLM response
  3. Save .svg file to disk
  4. Convert SVG → PNG using cairosvg  (output: 1200×900)
  5. Return absolute path to the PNG

All N frames run in parallel. Failed frames return None (same graceful
fallback pattern as manim_generator).

Caller (main.py) routes here when intent_type is one of SVG_INTENT_TYPES
("illustration", "concept_analogy", "comparison").

Requires: pip install cairosvg
"""

import asyncio
import os
import re
from typing import Optional

try:
    import cairosvg
    _CAIROSVG_AVAILABLE = True
except (ImportError, OSError):
    _CAIROSVG_AVAILABLE = False

from services.excalidraw.planner import GenerationPlan, FramePlan, call_llm


# ---------------------------------------------------------------------------
# Availability check
# ---------------------------------------------------------------------------

def svg_available() -> bool:
    """Return True if cairosvg is installed and the SVG path is usable."""
    return _CAIROSVG_AVAILABLE


# ---------------------------------------------------------------------------
# SVG extraction helper
# ---------------------------------------------------------------------------

def _extract_svg(text: str) -> str:
    """
    Pull raw SVG markup out of an LLM response.

    Handles the three common cases:
      1. Raw SVG (ideal — starts with <svg)
      2. SVG wrapped in markdown fences (```svg ... ``` or ```xml ... ```)
      3. SVG embedded in prose (search for the <svg> tag)
    """
    # Strip markdown fences if present
    fence = re.search(r"```(?:svg|xml)?\s*(<svg[\s>].*?</svg>)\s*```", text, re.DOTALL | re.IGNORECASE)
    if fence:
        return fence.group(1).strip()

    # Search for raw SVG tag in the text
    raw = re.search(r"<svg[\s>].*?</svg>", text, re.DOTALL | re.IGNORECASE)
    if raw:
        return raw.group(0).strip()

    return text.strip()


# ---------------------------------------------------------------------------
# Single frame: build prompt with style injection
# ---------------------------------------------------------------------------

def _generate_svg_code(
    frame: FramePlan,
    plan: GenerationPlan,
    prompt_template: str,
) -> str:
    """
    Synchronous LLM call that returns the raw LLM response for one frame.

    Injects shared_style and element_vocabulary into the frame description
    before sending — same pattern as _generate_one_frame in planner.py,
    but with SVG-specific language so the model uses correct SVG attributes.
    """
    stroke = plan.shared_style.strokeColor
    bg     = plan.shared_style.backgroundColor

    style_note = (
        f"\n\nStyle constraints (apply consistently across ALL frames for visual coherence):\n"
        f'- stroke="{stroke}" on ALL shape outlines, lines, and paths\n'
        f'- fill="{bg}" as the primary fill for key shapes (containers, main bodies)\n'
        f'- Arrow marker <polygon> fill must also be "{stroke}"\n'
        f'- Canvas background <rect> always fill="white"\n'
        f'- font-family="Arial, Helvetica, sans-serif" on every <text> element\n'
    )

    vocab_note = ""
    if plan.element_vocabulary:
        lines = [f'  - "{k}": {v}' for k, v in plan.element_vocabulary.items()]
        vocab_note = (
            "\n\nElement vocabulary (STRICTLY reproduce each named entity with the same "
            "shape, fill color, approximate size, and label in every frame it appears — "
            "visual consistency across frames depends on this):\n"
            + "\n".join(lines)
        )

    description = frame.description + style_note + vocab_note
    prompt = prompt_template.replace("{{DIAGRAM_DESCRIPTION}}", description)
    return call_llm(prompt)


# ---------------------------------------------------------------------------
# Single frame: SVG → PNG via cairosvg
# ---------------------------------------------------------------------------

def _render_frame(svg_text: str, frame_index: int, output_dir: str) -> Optional[str]:
    """
    Save SVG markup to disk and convert it to PNG using cairosvg.

    Output PNG is always 1200×900 — matches the canvas size the prompt enforces.
    Returns the absolute PNG path, or None if rendering fails.
    """
    frame_dir = os.path.join(output_dir, f"frame_{frame_index}")
    os.makedirs(frame_dir, exist_ok=True)

    svg_path = os.path.join(frame_dir, "frame.svg")
    png_path = os.path.join(frame_dir, "frame.png")

    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_text)

    try:
        cairosvg.svg2png(
            url=svg_path,
            write_to=png_path,
            output_width=1200,
            output_height=900,
        )
        return png_path
    except Exception as e:
        print(f"[svg_generator] Frame {frame_index} render error: {e}")
        return None


# ---------------------------------------------------------------------------
# Single frame: orchestrate LLM + render (async wrapper)
# ---------------------------------------------------------------------------

async def _generate_one_svg_frame(
    frame: FramePlan,
    frame_index: int,
    plan: GenerationPlan,
    prompt_template: str,
    output_dir: str,
) -> Optional[str]:
    """
    Generate and render one SVG frame. Returns absolute PNG path or None.

    Runs the synchronous LLM call and cairosvg render in threads so the
    event loop is never blocked.
    """
    raw = await asyncio.to_thread(_generate_svg_code, frame, plan, prompt_template)
    svg_text = _extract_svg(raw)

    if not svg_text.lower().startswith("<svg"):
        print(f"[svg_generator] Frame {frame_index}: LLM did not return valid SVG markup")
        return None

    return await asyncio.to_thread(_render_frame, svg_text, frame_index, output_dir)


# ---------------------------------------------------------------------------
# All frames in parallel
# ---------------------------------------------------------------------------

async def generate_svg_frames(
    plan: GenerationPlan,
    prompt_template: str,
    output_dir: str,
) -> list[Optional[str]]:
    """
    Generate one PNG per frame using SVG.

    Mirrors the interface of generate_manim_frames:
      - Input:  GenerationPlan + svg prompt template string + output dir
      - Output: List of absolute PNG paths, one per frame (None = failed frame)

    All N LLM + render calls run concurrently via asyncio.gather.
    Failed frames return None so the rest of the pipeline continues.

    Args:
        plan:            GenerationPlan produced by the planner.
        prompt_template: Contents of svg_prompt.md, loaded by the caller.
        output_dir:      Directory where per-frame subdirectories are created.
    """
    tasks = [
        _generate_one_svg_frame(frame, i, plan, prompt_template, output_dir)
        for i, frame in enumerate(plan.frames)
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    paths: list[Optional[str]] = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"[svg_generator] Frame {i} exception: {result}")
            paths.append(None)
        else:
            paths.append(result)

    return paths
