"""
Manim Generator — frame generation for math, physics, and science content.

Pipeline per frame:
  1. LLM call  → Manim Python code  (parallel, via asyncio.gather)
  2. Write code to a temp .py file
  3. subprocess: manim render -ql --save_last_frame scene.py GeneratedScene
  4. Return absolute path to rendered PNG

All N frames run in parallel. Failed frames return None (same graceful
fallback pattern as mermaid_generator).

Caller (main.py) is responsible for routing: this path is taken when
intent_type is "math". Manim must be installed: pip install manim
"""

import asyncio
import os
import re
import subprocess
from pathlib import Path
from typing import Optional

from services.excalidraw.planner import GenerationPlan, FramePlan, call_llm



# ---------------------------------------------------------------------------
# Availability check
# ---------------------------------------------------------------------------

def manim_available() -> bool:
    """Return True if the manim CLI is installed and reachable."""
    try:
        result = subprocess.run(
            ["manim", "--version"],
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


# ---------------------------------------------------------------------------
# Code extraction helper
# ---------------------------------------------------------------------------

def _extract_code(response: str) -> str:
    """Strip markdown fences from an LLM response, leaving raw Python."""
    fence = re.search(r"```(?:python)?\s*(.*?)```", response, re.DOTALL)
    if fence:
        return fence.group(1).strip()
    return response.strip()


# ---------------------------------------------------------------------------
# Single frame: LLM call → Manim code string
# ---------------------------------------------------------------------------

def _generate_manim_code(
    frame: FramePlan,
    plan: GenerationPlan,
    prompt_template: str,
) -> str:
    """Synchronous LLM call. Returns raw Manim Python code string."""
    primary_color = plan.shared_style.get("strokeColor", "#4F86C6")
    prompt = (
        prompt_template
        .replace("{{DIAGRAM_DESCRIPTION}}", frame.description)
        .replace("{{PRIMARY_COLOR}}", primary_color)
    )
    return call_llm(prompt)


# ---------------------------------------------------------------------------
# Single frame: render Manim code → PNG path
# ---------------------------------------------------------------------------

def _render_frame(code: str, frame_index: int, output_dir: str) -> Optional[str]:
    """
    Write Manim Python code to disk, run the renderer, return the PNG path.

    Directory layout under output_dir:
        frame_<N>/
            scene.py        ← generated code
            media/          ← Manim writes here
                images/
                    scene/
                        GeneratedScene_ManimCE_vX.X.X.png
    """
    frame_dir = os.path.join(output_dir, f"frame_{frame_index}")
    os.makedirs(frame_dir, exist_ok=True)

    scene_file = os.path.join(frame_dir, "scene.py")
    with open(scene_file, "w") as f:
        f.write(code)

    media_dir = os.path.join(frame_dir, "media")

    cmd = [
        "manim", "render",
        "-ql",                   # low quality — fast, sufficient for slides
        "--save_last_frame",     # PNG of the final frame only (no full video)
        "--media_dir", media_dir,
        scene_file,
        "GeneratedScene",
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=90,
        )

        if result.returncode != 0:
            print(
                f"[manim] Frame {frame_index} render failed:\n"
                f"{result.stderr[-600:]}"
            )
            return None

        pngs = list(Path(media_dir).rglob("*.png"))
        if not pngs:
            print(f"[manim] Frame {frame_index}: render OK but no PNG found")
            return None

        # Pick the most recently written PNG
        return str(max(pngs, key=lambda p: p.stat().st_mtime))

    except subprocess.TimeoutExpired:
        print(f"[manim] Frame {frame_index} timed out (90 s)")
        return None
    except FileNotFoundError:
        print("[manim] 'manim' not found — run: pip install manim")
        return None
    except Exception as e:
        print(f"[manim] Frame {frame_index} unexpected error: {e}")
        return None


# ---------------------------------------------------------------------------
# Single frame: orchestrate LLM + render (async wrapper)
# ---------------------------------------------------------------------------

async def _generate_one_manim_frame(
    frame: FramePlan,
    frame_index: int,
    plan: GenerationPlan,
    prompt_template: str,
    output_dir: str,
) -> Optional[str]:
    raw = await asyncio.to_thread(_generate_manim_code, frame, plan, prompt_template)
    code = _extract_code(raw)
    return await asyncio.to_thread(_render_frame, code, frame_index, output_dir)


# ---------------------------------------------------------------------------
# All frames in parallel
# ---------------------------------------------------------------------------

async def generate_manim_frames(
    plan: GenerationPlan,
    prompt_template: str,
    output_dir: str,
) -> list[Optional[str]]:
    """
    Generate one PNG per frame using Manim.

    Args:
        plan:            The GenerationPlan produced by the planner.
        prompt_template: Contents of manim_prompt.md, loaded by the caller.
        output_dir:      Directory where per-frame subdirectories will be created.

    Returns:
        List of absolute PNG paths, one per frame.
        None entries indicate frames that failed to render.
    """
    tasks = [
        _generate_one_manim_frame(frame, i, plan, prompt_template, output_dir)
        for i, frame in enumerate(plan.frames)
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    paths: list[Optional[str]] = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"[manim] Frame {i} exception: {result}")
            paths.append(None)
        else:
            paths.append(result)

    return paths
