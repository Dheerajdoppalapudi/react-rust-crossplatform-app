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
from typing import Optional, Tuple

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


def _sanitize_manim_code(code: str) -> Tuple[str, list]:
    """
    Auto-fix common LLM mistakes before sending code to the renderer.
    Returns (fixed_code, list_of_fixes_applied).

    Only fixes patterns that cause silent visual bugs or TypeErrors.
    Does NOT attempt to fix LaTeX (MathTex) — that triggers a retry instead.
    """
    fixes = []

    # 1. Remove numbers_to_include from Axes / NumberLine configs (LaTeX crash)
    for pattern in [
        re.compile(r',?\s*["\']?numbers_to_include["\']?\s*:\s*\[[^\]]*\]', re.DOTALL),
        re.compile(r',?\s*numbers_to_include\s*=\s*\[[^\]]*\]', re.DOTALL),
    ]:
        if pattern.search(code):
            code = pattern.sub("", code)
            fixes.append("removed numbers_to_include (LaTeX crash)")

    # 2. Fix bare opacity= kwarg that is not fill_opacity= or stroke_opacity=
    bare_opacity = re.compile(r'(?<![a-zA-Z_])opacity\s*=\s*([0-9.]+)')
    if bare_opacity.search(code):
        code = bare_opacity.sub(r'fill_opacity=\1', code)
        fixes.append("fixed bare opacity= → fill_opacity=")

    # 3. Ensure background color is set (add it right after construct opening if missing)
    if 'background_color' not in code and 'def construct' in code:
        code = code.replace(
            'def construct(self):',
            'def construct(self):\n        self.camera.background_color = "#1e1e2e"',
            1,
        )
        fixes.append("added missing background_color")

    if fixes:
        logger.info("Sanitized Manim code  fixes=%s", fixes)

    return code, fixes


def _has_latex_usage(code: str) -> bool:
    """Return True if the code contains banned LaTeX Mobjects."""
    return bool(re.search(r'\b(MathTex|SingleStringMathTex)\s*\(', code))


def _classify_render_error(stderr: str) -> str:
    """
    Return a short error category string based on Manim's stderr output.
    Used to choose the most targeted retry hint.
    """
    if "VMobjectFromSVGPath" in stderr and "has no attribute" in stderr:
        return "svg_path_attr"
    if "MathTex" in stderr or "latex" in stderr.lower() or "LaTeX" in stderr:
        return "latex"
    if "AttributeError" in stderr:
        return "attr_error"
    if "TypeError" in stderr:
        return "type_error"
    return "unknown"


def _build_fallback_prompt(original_prompt: str, error_category: str = "unknown") -> str:
    """Prepend a targeted error hint before the original prompt for retry attempts."""
    hints = {
        "latex": (
            "⚠️ RETRY — previous attempt used MathTex/Tex (LaTeX not installed).\n"
            "RULE: use ONLY Text() with Unicode: ², √, π, ∂, Σ, ±, ×, →\n\n"
        ),
        "svg_path_attr": (
            "⚠️ RETRY — previous attempt indexed into a Text object and called .text on a glyph.\n"
            "RULE: NEVER index Text objects (text[0], text[1], for char in text).\n"
            "RULE: NEVER call .text, .get_text(), or string methods on Text submobjects.\n"
            "Treat every Text(...) as one atomic unit — never slice or iterate it.\n"
            "For brace labels, create a separate Text() object and use next_to(brace, DOWN).\n\n"
        ),
        "attr_error": (
            "⚠️ RETRY — previous attempt used an attribute that doesn't exist on a Manim object.\n"
            "RULE: only use documented Manim CE methods: .move_to(), .next_to(), .shift(), "
            ".to_edge(), .get_center(), .get_right(), .get_left(), .get_top(), .animate, "
            ".set_color(), .set_opacity(), .scale(). No other attribute access on Mobjects.\n\n"
        ),
        "type_error": (
            "⚠️ RETRY — previous attempt passed a wrong argument type.\n"
            "RULE: opacity must be fill_opacity= or stroke_opacity= (not opacity=).\n"
            "RULE: colors must be Manim constants (BLUE, RED, GREEN, etc.) or hex strings.\n\n"
        ),
        "unknown": (
            "⚠️ RETRY — previous attempt failed to render. Generate simpler, safer code.\n"
            "Stick to Text(), Rectangle(), Circle(), Arrow(), Axes(), VGroup(), and basic animations.\n\n"
        ),
    }
    return hints.get(error_category, hints["unknown"]) + original_prompt


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

    # Continuity context — tell each frame what objects persist across frames
    continuity_block = ""
    if plan.visual_objects:
        persistent = [
            obj for obj in plan.visual_objects
            if frame.index in (obj.get("persists_frames") or [])
        ]
        if persistent:
            obj_lines = "\n".join(
                f'  - {obj["id"]} ({obj["type"]}): {obj.get("description", "")} '
                f'[color: {obj.get("style", {}).get("color", "WHITE")}]'
                for obj in persistent
            )
            continuity_block = f"\nPersistent visual objects on screen this frame:\n{obj_lines}\n"

    transition_block = ""
    if plan.continuity_plan.get("transition_strategy"):
        transition_block = f"Continuity strategy: {plan.continuity_plan['transition_strategy']}\n"

    strategy_block = f"Visual strategy: {plan.visual_strategy}\n" if plan.visual_strategy else ""

    frame_context = (
        f"Frame {frame.index + 1} of {plan.frame_count}: \"{frame.caption}\"\n"
        f"Lesson outline: {' → '.join(all_captions)}\n"
        f"{strategy_block}"
        f"{transition_block}"
        f"{continuity_block}\n"
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

def _render_frame(code: str, frame_index: int, output_dir: str) -> Tuple[Optional[str], str]:
    """
    Write Manim Python code to disk, run the renderer.
    Returns (mp4_path_or_None, stderr_text).
    stderr is always returned so the caller can classify the error for targeted retry.
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
            return None, result.stderr

        mp4s = list(Path(media_dir).rglob("*.mp4"))
        if not mp4s:
            logger.error("Manim render completed but no .mp4 found  frame=%d  media_dir=%s", frame_index, media_dir)
            return None, result.stderr

        # Pick the most recently written .mp4
        best = str(max(mp4s, key=lambda p: p.stat().st_mtime))
        logger.info("Manim frame %d rendered → %s", frame_index, best)
        return best, ""

    except subprocess.TimeoutExpired:
        logger.error("Manim render timed out (180 s)  frame=%d", frame_index)
        return None, "TimeoutExpired"
    except FileNotFoundError:
        logger.error("'manim' CLI not found — run: pip install manim")
        return None, "FileNotFoundError: manim CLI missing"
    except Exception as e:
        logger.error("Manim frame %d unexpected error: %s", frame_index, e, exc_info=True)
        return None, str(e)


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
    # Attempt 1 — normal generation
    raw = await asyncio.to_thread(_generate_manim_code, frame, plan, prompt_template)
    code = _extract_code(raw)
    code, fixes = _sanitize_manim_code(code)
    if fixes:
        logger.info("Frame %d sanitized: %s", frame_index, fixes)

    mp4, stderr = await asyncio.to_thread(_render_frame, code, frame_index, output_dir)
    if mp4 is not None:
        return mp4

    # Classify the error and build a targeted retry prompt
    error_category = _classify_render_error(stderr)
    logger.warning("Frame %d render failed (category=%s) — retrying with targeted prompt", frame_index, error_category)

    fallback_template = _build_fallback_prompt(prompt_template, error_category)
    raw2 = await asyncio.to_thread(_generate_manim_code, frame, plan, fallback_template)
    code2 = _extract_code(raw2)
    code2, fixes2 = _sanitize_manim_code(code2)
    if fixes2:
        logger.info("Frame %d retry sanitized: %s", frame_index, fixes2)

    retry_dir = output_dir + "_retry"
    mp4_2, _ = await asyncio.to_thread(_render_frame, code2, frame_index, retry_dir)
    if mp4_2 is not None:
        logger.info("Frame %d recovered on retry (category=%s)", frame_index, error_category)
    else:
        logger.error("Frame %d failed on both attempts (category=%s)", frame_index, error_category)
    return mp4_2


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
