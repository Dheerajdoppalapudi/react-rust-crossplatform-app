"""
Manim Generator — frame generation for math, physics, and science content.

Pipeline per frame:
  1. LLM call  → Manim Python code  (parallel, via asyncio.gather)
  2. Write code to a temp .py file
  3. subprocess: manim render -qh scene.py GeneratedScene
  4. Return absolute path to the rendered .mp4 video

All N frames run in parallel. Failed frames return None (same graceful
fallback pattern as mermaid_generator).

Caller (main.py) is responsible for routing: this path is taken when
intent_type is "math". Manim must be installed: pip install manim
"""

import asyncio
import logging
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

from services.Frame_generation.planner import GenerationPlan, FramePlan, call_llm

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Resolve manim CLI path relative to the running Python interpreter
# so it works regardless of whether the venv is "activated" in the shell.
# e.g. /path/to/env/bin/python → /path/to/env/bin/manim
# ---------------------------------------------------------------------------

def _manim_cmd() -> str:
    """Return the absolute path to the manim CLI in the current Python env."""
    candidate = Path(sys.executable).parent / "manim"
    if candidate.exists():
        return str(candidate)
    return "manim"  # fallback to PATH lookup


# ---------------------------------------------------------------------------
# Availability check
# ---------------------------------------------------------------------------

def manim_available() -> bool:
    """Return True if the manim CLI is installed and reachable."""
    try:
        result = subprocess.run(
            [_manim_cmd(), "--version"],
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
    primary_color = getattr(plan.shared_style, "strokeColor", "#4F86C6")

    all_captions = [f.caption for f in plan.frames]
    frame_context = (
        f"Frame {frame.index + 1} of {plan.frame_count}: \"{frame.caption}\"\n"
        f"Lesson outline: {' → '.join(all_captions)}\n\n"
        f"{frame.description}"
    )

    prompt = (
        prompt_template
        .replace("{{DIAGRAM_DESCRIPTION}}", frame_context)
        .replace("{{PRIMARY_COLOR}}", primary_color)
    )
    return call_llm(prompt, prompt_name=f"manim_prompt.md (frame {frame.index})")


# ---------------------------------------------------------------------------
# Single frame: render Manim code → .mp4 path
# ---------------------------------------------------------------------------

def _render_frame(code: str, frame_index: int, output_dir: str) -> Optional[str]:
    """
    Write Manim Python code to disk, run the renderer, return the .mp4 path.

    Directory layout under output_dir:
        frame_<N>/
            scene.py        ← generated code
            media/          ← Manim writes here
                videos/
                    scene/
                        1080p60/
                            GeneratedScene.mp4
    """
    frame_dir = os.path.join(output_dir, f"frame_{frame_index}")
    os.makedirs(frame_dir, exist_ok=True)

    scene_file = os.path.join(frame_dir, "scene.py")
    with open(scene_file, "w") as f:
        f.write(code)

    media_dir = os.path.join(frame_dir, "media")

    cmd = [
        _manim_cmd(), "render",
        "-qh",                   # high quality (1080p60) — matches final video resolution
        "--media_dir", media_dir,
        scene_file,
        "GeneratedScene",
    ]

    logger.debug("Rendering Manim frame %d  dir=%s", frame_index, frame_dir)
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=180,   # 1080p60 renders can take 2–3 min on slower machines
        )

        if result.returncode != 0:
            logger.error(
                "Manim render failed  frame=%d\nSTDERR:\n%s",
                frame_index, result.stderr[-800:],
            )
            return None

        mp4s = list(Path(media_dir).rglob("*.mp4"))
        if not mp4s:
            logger.error("Manim render completed but no .mp4 found  frame=%d  media_dir=%s", frame_index, media_dir)
            return None

        # Pick the most recently written .mp4
        best = str(max(mp4s, key=lambda p: p.stat().st_mtime))
        logger.info("Manim frame %d rendered → %s", frame_index, best)
        return best

    except subprocess.TimeoutExpired:
        logger.error("Manim render timed out (180 s)  frame=%d", frame_index)
        return None
    except FileNotFoundError:
        logger.error("'manim' CLI not found — run: pip install manim")
        return None
    except Exception as e:
        logger.error("Manim frame %d unexpected error: %s", frame_index, e, exc_info=True)
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
        List of absolute .mp4 paths, one per frame.
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
            logger.error("Manim frame %d raised exception: %s", i, result, exc_info=result)
            paths.append(None)
        else:
            paths.append(result)

    ok = sum(1 for p in paths if p)
    logger.info("Manim generation complete  ok=%d/%d", ok, len(paths))
    return paths
