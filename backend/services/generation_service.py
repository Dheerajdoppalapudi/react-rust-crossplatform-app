"""
Generation pipeline — all frame-generation business logic.

The route handler in routers/generation.py is responsible for:
  - DB setup (session/conversation creation)
  - Context var lifecycle (request_log, token_usage, request_llm_service)
  - Calling run_generation_pipeline()
  - Persisting results to DB and returning the HTTP response

This module owns everything in between.
"""

import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

from core.config import (
    MERMAID_INTENT_TYPES,
    MANIM_INTENT_TYPES,
    SVG_INTENT_TYPES,
)
from core.database import get_db
from services.Frame_generation.excalidraw_enhancer import enhance
from services.Frame_generation.planner import (
    GenerationPlan,
    _vocab_plan_to_generation_plan,
    create_vocab_plan,
    generate_all_frames,
    _log,
)
from services.Frame_generation.combiner import combine_frames
from services.Frame_generation.mermaid.mermaid_generator import (
    generate_mermaid_frames,
    _sidecar_available,
)
from services.Frame_generation.manim.manim_generator import generate_manim_frames, manim_available
from services.Frame_generation.svg.svg_generator import generate_svg_frames, svg_available
from services.Frame_generation.svg.component_generator import generate_svg_components

logger = logging.getLogger(__name__)

# ── Prompt templates — loaded once at import time ─────────────────────────────

_PROMPTS_DIR = Path(__file__).parent / "Frame_generation" / "prompts"


def _load_prompt(filename: str) -> str:
    return (_PROMPTS_DIR / filename).read_text(encoding="utf-8")


_PROMPT_TEMPLATE         = _load_prompt("prompt_template.md")
_MERMAID_PROMPT_TEMPLATE = _load_prompt("mermaid_prompt.md")
_MANIM_PROMPT_TEMPLATE   = _load_prompt("manim_prompt.md")
_SVG_PROMPT_TEMPLATE     = _load_prompt("svg_prompt.md")


# ── Utilities ─────────────────────────────────────────────────────────────────

def count_llm_calls(log: list) -> int:
    """Count LLM calls recorded in the lifecycle log."""
    return sum(1 for e in log if e.get("event") in ("llm_call", "llm_call_fast"))


def _parse_narrations_from_file(narration_path: str) -> list[str]:
    """Read narration.txt and return a list of per-frame narration strings."""
    if not os.path.exists(narration_path):
        return []
    with open(narration_path) as f:
        text = f.read()
    blocks: list[str] = []
    current: list[str] = []
    for line in text.splitlines():
        if line.strip().startswith("Frame ") and ":" in line and current:
            narration = " ".join(l for l in current if not l.strip().startswith("Frame ")).strip()
            blocks.append(narration)
            current = [line]
        else:
            current.append(line)
    if current:
        narration = " ".join(l for l in current if not l.strip().startswith("Frame ")).strip()
        blocks.append(narration)
    return blocks



def build_conversation_context(
    conversation_id:    str,
    current_session_id: str,
    pause_session_id:   Optional[str] = None,
    pause_frame_index:  Optional[int] = None,
    pause_caption:      Optional[str] = None,
) -> str:
    """
    Build the conversation context string injected into the planning prompt.

    Strategy (sliding window):
      - All prior turns except the most recent: prompt + captions only
      - Most recent prior turn:                 prompt + full narration
      - Pause context (if provided):            which frame + caption + narration at that frame
    """
    with get_db() as conn:
        prior_turns = conn.execute(
            "SELECT id, prompt, turn_index, output_dir FROM sessions "
            "WHERE conversation_id = ? AND id != ? AND status = 'done' "
            "ORDER BY turn_index ASC",
            (conversation_id, current_session_id),
        ).fetchall()

    if not prior_turns:
        return ""

    lines: list[str] = [
        "────────────────────────────────────────────────────────────────────",
        "## CONVERSATION HISTORY — what has already been taught",
        "",
        "You are continuing an ongoing conversation. Build upon the lessons below.",
        "Do NOT repeat concepts already covered. Connect new content to prior lessons where natural.",
        "",
    ]

    for i, turn in enumerate(prior_turns):
        output_dir = turn["output_dir"] or ""
        is_last    = (i == len(prior_turns) - 1)

        captions: list[str] = []
        frames_path = os.path.join(output_dir, "frames.json")
        if os.path.exists(frames_path):
            with open(frames_path) as f:
                captions = json.load(f).get("captions", [])

        lines.append(f"Turn {turn['turn_index']}: \"{turn['prompt']}\"")

        if captions:
            lines.append(f"  Frames: {', '.join(captions)}")

        if is_last:
            narration_path = os.path.join(output_dir, "narration.txt")
            if os.path.exists(narration_path):
                with open(narration_path) as f:
                    full_narration = f.read().strip()
                if full_narration:
                    lines.append("  Full narration of this turn:")
                    for narr_line in full_narration.splitlines():
                        lines.append(f"    {narr_line}")

        lines.append("")

    if pause_session_id and pause_frame_index is not None:
        pause_narration_text = ""
        with get_db() as conn:
            pause_row = conn.execute(
                "SELECT output_dir FROM sessions WHERE id = ?", (pause_session_id,)
            ).fetchone()
        if pause_row and pause_row["output_dir"]:
            narrations = _parse_narrations_from_file(
                os.path.join(pause_row["output_dir"], "narration.txt")
            )
            if pause_frame_index < len(narrations):
                pause_narration_text = narrations[pause_frame_index]

        lines += [
            "## USER PAUSE CONTEXT",
            f"The user paused the video at frame {pause_frame_index + 1}"
            + (f" titled \"{pause_caption}\"" if pause_caption else "") + ".",
        ]
        if pause_narration_text:
            lines.append(f"The lesson was saying at that moment: \"{pause_narration_text}\"")
        lines += [
            "Their follow-up question is likely about this specific concept.",
            "Focus your new lesson on resolving the confusion or curiosity raised at this point.",
            "",
        ]

    lines += [
        "────────────────────────────────────────────────────────────────────",
        "",
    ]
    return "\n".join(lines)


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def run_generation_pipeline(
    message:              str,
    session_id:           str,
    output_dir:           str,
    conversation_context: str,
    notes_enabled:        bool,
) -> dict:
    """
    Runs the full generation pipeline: Planning → Frame generation → Save outputs.

    Returns result_payload dict ready to be returned to the client.
    The caller (route handler) is responsible for setting/resetting context vars
    (request_log, token_usage, request_llm_service) before/after this call.
    """
    # ── Stage 1: Planning ─────────────────────────────────────────────────────
    _log({"event": "stage_start", "stage": "planning"})

    vocab_plan = await create_vocab_plan(message, conversation_context)
    _log({"event": "stage_complete", "stage": "planning_phase_a",
          "intent_type": vocab_plan.intent_type, "frame_count": vocab_plan.frame_count})

    component_library: dict = {}

    if vocab_plan.intent_type in SVG_INTENT_TYPES and svg_available():
        _log({"event": "stage_start", "stage": "component_gen"})
        component_library, _ = await generate_svg_components(vocab_plan)
        _log({"event": "stage_complete", "stage": "component_gen",
              "entities": list(component_library.keys())})

    plan = _vocab_plan_to_generation_plan(vocab_plan)

    _log({
        "event": "stage_complete",
        "stage": "planning",
        "intent_type": plan.intent_type,
        "frame_count": plan.frame_count,
        "layout": plan.layout,
    })
    logger.info(
        "Planning complete  session=%s  intent=%s  frames=%d  layout=%s",
        session_id, plan.intent_type, plan.frame_count, plan.layout,
    )

    captions            = [frame.caption for frame in plan.frames]
    suggested_followups = plan.suggested_followups or [] if notes_enabled else []
    notes               = (plan.notes or "")              if notes_enabled else ""

    narration_lines: list[str] = []
    for i, frame in enumerate(plan.frames):
        narration_lines.append(f"Frame {i + 1}: {frame.caption}")
        narration_lines.append(frame.narration)
        narration_lines.append("")

    # ── Stage 2: Frame generation ─────────────────────────────────────────────
    result_payload, ui_output_file = await _run_frame_generation(
        plan, session_id, output_dir, captions, suggested_followups, notes, component_library,
    )

    # ── Save narration ────────────────────────────────────────────────────────
    with open(os.path.join(output_dir, "narration.txt"), "w") as f:
        f.write("\n".join(narration_lines).strip() + "\n")

    result_payload["ui_output_file"] = ui_output_file
    return result_payload


async def _run_frame_generation(
    plan:               GenerationPlan,
    session_id:         str,
    output_dir:         str,
    captions:           list[str],
    suggested_followups: list[str],
    notes:              str,
    component_library:  dict,
) -> tuple[dict, Optional[str]]:
    """
    Dispatch to the correct frame renderer based on intent and availability.
    Returns (result_payload, ui_output_file_path).
    """
    ui_output_file: Optional[str] = None

    # ── Manim ─────────────────────────────────────────────────────────────────
    if plan.intent_type in MANIM_INTENT_TYPES and manim_available():
        logger.info("Render path → manim  session=%s  intent=%s", session_id, plan.intent_type)
        _log({"event": "stage_start", "stage": "frame_generation", "path": "manim",
              "frame_count": plan.frame_count})

        manim_dir = os.path.join(output_dir, "manim")
        png_paths = await generate_manim_frames(plan, _MANIM_PROMPT_TEMPLATE, manim_dir)
        _log({"event": "stage_complete", "stage": "frame_generation", "path": "manim"})

        # Collect generated Python code from the lifecycle log
        from services.Frame_generation.planner import request_log
        lifecycle_log = request_log.get() or []
        manim_calls   = [e for e in lifecycle_log if e.get("event") == "llm_call"]
        frame_codes   = [e["full_response"] for e in manim_calls[1:]]
        py_content    = "\n\n# " + "=" * 70 + "\n\n".join(
            f"# Frame {i+1}: {captions[i] if i < len(captions) else ''}\n\n{code}"
            for i, code in enumerate(frame_codes)
        )
        ui_output_file = os.path.join(output_dir, "final_output.py")
        with open(ui_output_file, "w") as f:
            f.write(py_content)

        with open(os.path.join(output_dir, "frames.json"), "w") as f:
            json.dump({"render_path": "manim", "images": png_paths, "captions": captions,
                       "suggested_followups": suggested_followups, "notes": notes}, f, indent=2)

        return {
            "session_id":          session_id,
            "render_path":         "manim",
            "frame_count":         plan.frame_count,
            "intent_type":         plan.intent_type,
            "captions":            captions,
            "images":              png_paths,
            "ui_file_type":        "python",
            "suggested_followups": suggested_followups,
            "notes":               notes,
        }, ui_output_file

    # ── SVG ───────────────────────────────────────────────────────────────────
    if plan.intent_type in SVG_INTENT_TYPES and svg_available():
        logger.info("Render path → svg  session=%s  intent=%s", session_id, plan.intent_type)
        _log({"event": "stage_start", "stage": "frame_generation", "path": "svg",
              "frame_count": plan.frame_count})

        svg_dir   = os.path.join(output_dir, "svg")
        png_paths = await generate_svg_frames(plan, _SVG_PROMPT_TEMPLATE, svg_dir, component_library)
        _log({"event": "stage_complete", "stage": "frame_generation", "path": "svg"})

        ui_output_file = os.path.join(output_dir, "final_output.json")
        with open(os.path.join(output_dir, "frames.json"), "w") as f:
            json.dump({"render_path": "svg", "images": png_paths, "captions": captions,
                       "suggested_followups": suggested_followups, "notes": notes}, f, indent=2)
        with open(ui_output_file, "w") as f:
            json.dump({"render_path": "svg", "images": png_paths, "captions": captions}, f, indent=2)

        return {
            "session_id":          session_id,
            "render_path":         "svg",
            "frame_count":         plan.frame_count,
            "intent_type":         plan.intent_type,
            "captions":            captions,
            "images":              png_paths,
            "ui_file_type":        "images",
            "suggested_followups": suggested_followups,
            "notes":               notes,
        }, ui_output_file

    # ── Mermaid sidecar down → fall back to SVG ───────────────────────────────
    if plan.intent_type in MERMAID_INTENT_TYPES and not _sidecar_available() and svg_available():
        logger.warning(
            "Mermaid sidecar unavailable — falling back to svg  session=%s  intent=%s",
            session_id, plan.intent_type,
        )
        _log({"event": "info", "message": "Mermaid sidecar unavailable — falling back to SVG"})
        _log({"event": "stage_start", "stage": "frame_generation", "path": "svg_fallback",
              "frame_count": plan.frame_count})

        svg_dir   = os.path.join(output_dir, "svg")
        png_paths = await generate_svg_frames(plan, _SVG_PROMPT_TEMPLATE, svg_dir, component_library)
        _log({"event": "stage_complete", "stage": "frame_generation", "path": "svg_fallback"})

        ui_output_file = os.path.join(output_dir, "final_output.json")
        with open(os.path.join(output_dir, "frames.json"), "w") as f:
            json.dump({"render_path": "svg", "images": png_paths, "captions": captions,
                       "suggested_followups": suggested_followups, "notes": notes}, f, indent=2)
        with open(ui_output_file, "w") as f:
            json.dump({"render_path": "svg", "images": png_paths, "captions": captions}, f, indent=2)

        return {
            "session_id":          session_id,
            "render_path":         "svg",
            "frame_count":         plan.frame_count,
            "intent_type":         plan.intent_type,
            "captions":            captions,
            "images":              png_paths,
            "ui_file_type":        "images",
            "suggested_followups": suggested_followups,
            "notes":               notes,
        }, ui_output_file

    # ── Mermaid or slim JSON ──────────────────────────────────────────────────
    use_mermaid = plan.intent_type in MERMAID_INTENT_TYPES and _sidecar_available()
    path_label  = "mermaid" if use_mermaid else "slim_json"

    if not use_mermaid:
        if plan.intent_type in MANIM_INTENT_TYPES:
            logger.warning("Manim not available — falling back to slim_json  session=%s", session_id)
        elif plan.intent_type in SVG_INTENT_TYPES:
            logger.warning("cairosvg unavailable — falling back to slim_json  session=%s", session_id)
            _log({"event": "info", "message": "cairosvg unavailable — falling back to slim JSON"})
        else:
            logger.info("Render path → slim_json  session=%s  intent=%s", session_id, plan.intent_type)
    else:
        logger.info("Render path → mermaid  session=%s  intent=%s", session_id, plan.intent_type)

    _log({"event": "stage_start", "stage": "frame_generation", "path": path_label,
          "frame_count": plan.frame_count})

    if use_mermaid:
        frame_slims = await generate_mermaid_frames(plan, _MERMAID_PROMPT_TEMPLATE)
    else:
        frame_slims = await generate_all_frames(plan, _PROMPT_TEMPLATE)

    _log({"event": "stage_complete", "stage": "frame_generation", "path": path_label})

    # Stage 3: Combine
    _log({"event": "stage_start", "stage": "combine_frames"})
    combined_slim = combine_frames(frame_slims, captions)
    _log({"event": "stage_complete", "stage": "combine_frames"})

    with open(os.path.join(output_dir, "sample_slim.json"), "w") as f:
        json.dump(combined_slim, f, indent=2)

    # Stage 4: Enhance
    _log({"event": "stage_start", "stage": "enhance_excalidraw"})
    excalidraw_result = enhance(combined_slim)
    _log({"event": "stage_complete", "stage": "enhance_excalidraw",
          "elements_count": len(excalidraw_result.get("elements", []))})

    ui_output_file = os.path.join(output_dir, "final_output.json")
    with open(ui_output_file, "w") as f:
        json.dump(excalidraw_result, f, indent=2)

    with open(os.path.join(output_dir, "frames.json"), "w") as f:
        json.dump({"render_path": path_label, "images": [None] * plan.frame_count,
                   "captions": captions, "suggested_followups": suggested_followups,
                   "notes": notes}, f, indent=2)

    return {
        "session_id":          session_id,
        "excalidraw":          excalidraw_result,
        "elements_count":      len(excalidraw_result["elements"]),
        "frame_count":         plan.frame_count,
        "intent_type":         plan.intent_type,
        "render_path":         path_label,
        "captions":            captions,
        "ui_file_type":        "json",
        "suggested_followups": suggested_followups,
        "notes":               notes,
    }, ui_output_file
