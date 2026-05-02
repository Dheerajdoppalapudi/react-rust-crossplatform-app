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
    MANIM_INTENT_TYPES,
    SVG_INTENT_TYPES,
    INTERACTIVE_CONTEXT_TURNS,
)
from core.database import get_db
from services.frame_generation.planner import (
    GenerationPlan,
    _vocab_plan_to_generation_plan,
    classify_intent,
    create_vocab_plan,
    _log,
)
from services.frame_generation.manim.manim_generator import generate_manim_frames, manim_available
from services.frame_generation.svg.svg_generator import generate_svg_frames, svg_available
from services.frame_generation.slide_generator import generate_slide, generate_summary_slide

logger = logging.getLogger(__name__)

# ── Prompt templates — loaded once at import time ─────────────────────────────

_PROMPTS_DIR = Path(__file__).parent / "frame_generation" / "prompts"


def _load_prompt(filename: str) -> str:
    return (_PROMPTS_DIR / filename).read_text(encoding="utf-8")


_MANIM_PROMPT_TEMPLATE = _load_prompt("manim_prompt.md")
_SVG_PROMPT_TEMPLATE   = _load_prompt("svg_prompt.md")


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



def _interleave_slides(
    png_paths: list,
    captions: list[str],
    narrations: list[str],
    slide_specs: list[dict],
    output_dir: str,
    accent_color: str,
) -> tuple[list, list[str], list[str]]:
    """
    Generate slide PNGs and interleave them with diagram frames.

    Args:
        png_paths:    per-diagram-frame PNG paths (may include None for failed frames)
        captions:     per-diagram-frame captions
        narrations:   per-diagram-frame narration strings
        slide_specs:  list of slide_frames dicts from the planner
        output_dir:   session output directory; slides go into output_dir/slides/
        accent_color: fallback accent if a slide spec omits accent_color

    Returns:
        (all_images, all_captions, all_narrations) with slides interleaved.
        Slide entries use their narration field as the per-frame narration text.
    """
    slides_dir = os.path.join(output_dir, "slides")
    os.makedirs(slides_dir, exist_ok=True)

    # Build insertion map: diagram_index → list of (slide_png, slide_caption, slide_narration)
    insertions: dict[int, list] = {}
    for i, spec in enumerate(slide_specs or []):
        insert_before = spec.get("insert_before", 0)
        slide_filename = f"slide_{i:03d}.png"
        slide_path = os.path.join(slides_dir, slide_filename)
        try:
            generate_slide(spec, slide_path)
        except Exception as e:
            logger.error("slide_generator failed for slide %d: %s", i, e, exc_info=True)
            continue
        slide_narration = spec.get("narration", "")
        slide_caption   = spec.get("title") or spec.get("heading") or "Slide"
        insertions.setdefault(insert_before, []).append(
            (slide_path, slide_caption, slide_narration)
        )

    # Build interleaved lists
    all_images, all_captions, all_narrations = [], [], []
    for idx, (png, cap, narr) in enumerate(zip(png_paths, captions, narrations)):
        for slide_path, slide_cap, slide_narr in insertions.get(idx, []):
            all_images.append(slide_path)
            all_captions.append(slide_cap)
            all_narrations.append(slide_narr)
        all_images.append(png)
        all_captions.append(cap)
        all_narrations.append(narr)

    # Slides with insert_before >= len(png_paths) go at the end (before summary)
    for idx in sorted(k for k in insertions if k >= len(png_paths)):
        for slide_path, slide_cap, slide_narr in insertions[idx]:
            all_images.append(slide_path)
            all_captions.append(slide_cap)
            all_narrations.append(slide_narr)

    return all_images, all_captions, all_narrations


def _append_summary_slide(
    all_images: list,
    all_captions: list[str],
    all_narrations: list[str],
    notes: str,
    accent_color: str,
    output_dir: str,
) -> tuple[list, list[str], list[str]]:
    """
    Generate a 'Key Takeaways' summary slide from plan.notes and append it.
    """
    if not notes:
        return all_images, all_captions, all_narrations

    bullets = [line.strip().lstrip("•-").strip() for line in notes.splitlines() if line.strip()]
    if not bullets:
        return all_images, all_captions, all_narrations

    slides_dir = os.path.join(output_dir, "slides")
    os.makedirs(slides_dir, exist_ok=True)
    summary_path = os.path.join(slides_dir, "summary.png")

    try:
        generate_summary_slide(bullets=bullets, accent_color=accent_color, out_path=summary_path)
    except Exception as e:
        logger.error("summary slide generation failed: %s", e, exc_info=True)
        return all_images, all_captions, all_narrations

    summary_narration = "To summarize what we covered: " + " ".join(bullets[:3])
    all_images.append(summary_path)
    all_captions.append("Key Takeaways")
    all_narrations.append(summary_narration)
    return all_images, all_captions, all_narrations


def build_conversation_context(
    parent_session_id: Optional[str],
    pause_session_id:  Optional[str] = None,
    pause_frame_index: Optional[int] = None,
    pause_caption:     Optional[str] = None,
) -> str:
    """
    Build the conversation context string injected into the planning prompt.

    Walks the parent_session_id ancestor chain so branched follow-ups only see
    their own lineage, not sibling branches.

    Strategy:
      - All ancestors except the most recent: prompt + frame captions only
      - Most recent ancestor:                 prompt + full narration
      - Pause context (if provided):          which frame + caption + narration at that frame
    """
    if not parent_session_id:
        return ""

    prior_turns = _collect_ancestor_chain(parent_session_id, INTERACTIVE_CONTEXT_TURNS)

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


def _collect_ancestor_chain(
    parent_session_id: Optional[str],
    limit: int,
) -> list:
    """
    Walk parent_session_id pointers up the tree, collecting up to `limit` ancestors.
    Returns rows ordered oldest-first (root ancestor first, direct parent last).
    """
    chain: list = []
    current_id = parent_session_id

    with get_db() as conn:
        while current_id and len(chain) < limit:
            row = conn.execute(
                "SELECT id, prompt, turn_index, output_dir, parent_session_id "
                "FROM sessions WHERE id = ? AND status = 'done'",
                (current_id,),
            ).fetchone()
            if not row:
                break
            chain.append(row)
            current_id = row["parent_session_id"]

    chain.reverse()  # oldest first
    return chain


def build_interactive_context(
    parent_session_id: Optional[str],
) -> str:
    """
    Build conversation context for interactive follow-up prompts.

    Walks the parent_session_id ancestor chain (not all sessions in conversation)
    so branched follow-ups only see their own lineage, not sibling branches.

    Reads scene_ir.json from each ancestor and extracts:
      - Text block content (what was actually explained)
      - Entity block summaries (what widget was shown and its key props)

    Capped at INTERACTIVE_CONTEXT_TURNS ancestors to stay within token budget.
    """
    if not parent_session_id:
        return ""

    prior_turns = _collect_ancestor_chain(parent_session_id, INTERACTIVE_CONTEXT_TURNS)

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

    for turn in prior_turns:
        output_dir = turn["output_dir"] or ""
        scene_ir_path = os.path.join(output_dir, "scene_ir.json")

        lines.append(f"Turn {turn['turn_index']}: \"{turn['prompt']}\"")

        if os.path.exists(scene_ir_path):
            with open(scene_ir_path) as f:
                scene = json.load(f)

            lines.append(f"  Title: {scene.get('title', '')}")
            lines.append(f"  Intent: {scene.get('intent', '')}")

            for block in scene.get("blocks", []):
                if block.get("type") == "text" and block.get("content"):
                    lines.append(f"  Explanation: {block['content']}")
                elif block.get("type") == "entity":
                    entity_type = block.get("entity_type", "")
                    props = block.get("props", {})
                    # Summarise the entity without dumping all its data
                    if entity_type == "mermaid_viewer":
                        lines.append(f"  Widget: diagram — {props.get('caption', entity_type)}")
                    elif entity_type == "code_walkthrough":
                        lines.append(f"  Widget: code walkthrough ({props.get('language', '')})")
                    elif entity_type == "math_formula":
                        lines.append(f"  Widget: formula — {props.get('latex', props.get('caption', ''))}")
                    elif entity_type == "chart":
                        lines.append(f"  Widget: {props.get('type', 'chart')} chart — {props.get('title', props.get('caption', ''))}")
                    elif entity_type == "graph_canvas":
                        lines.append(f"  Widget: graph ({len(props.get('nodes', []))} nodes, {len(props.get('edges', []))} edges) — {props.get('caption', '')}")
                    elif entity_type == "timeline":
                        lines.append(f"  Widget: timeline ({len(props.get('events', []))} events) — {props.get('caption', '')}")
                    elif entity_type == "map_viewer":
                        lines.append(f"  Widget: map — {props.get('caption', '')}")
                    elif entity_type == "molecule_viewer":
                        lines.append(f"  Widget: molecule ({props.get('format', '')}: {props.get('data', '')[:40]})")
                    elif entity_type == "freeform_html":
                        lines.append(f"  Widget: interactive simulation — {props.get('spec', '')[:80]}")
                    else:
                        lines.append(f"  Widget: {entity_type}")

        lines.append("")

    lines += [
        "────────────────────────────────────────────────────────────────────",
        "",
    ]
    return "\n".join(lines)


# ── Text-only pipeline (video off) ────────────────────────────────────────────

async def run_text_pipeline(
    message:              str,
    session_id:           str,
    output_dir:           str,
    conversation_context: str,
) -> dict:
    """
    Lightweight single-LLM-call path used when the user has video generation off.

    Calls classify_intent (Haiku) which returns notes + suggested_followups
    alongside intent metadata. Writes a minimal frames.json and returns a
    result payload with render_path='text'.
    """
    _log({"event": "stage_start", "stage": "text_classify"})

    intent_type, frame_count, notes_list, followups, _domain = await classify_intent(
        message, conversation_context
    )
    notes = "\n".join(notes_list) if notes_list else ""
    suggested_followups = followups or []

    _log({"event": "stage_complete", "stage": "text_classify",
          "intent_type": intent_type, "frame_count": frame_count})
    logger.info(
        "Text pipeline complete  session=%s  intent=%s  notes=%d  followups=%d",
        session_id, intent_type, len(notes_list), len(suggested_followups),
    )

    os.makedirs(output_dir, exist_ok=True)
    with open(os.path.join(output_dir, "frames.json"), "w") as f:
        json.dump({
            "render_path":         "text",
            "images":              [],
            "captions":            [],
            "notes":               notes,
            "suggested_followups": suggested_followups,
        }, f, indent=2)

    return {
        "session_id":          session_id,
        "render_path":         "text",
        "frame_count":         0,
        "intent_type":         intent_type,
        "captions":            [],
        "images":              [],
        "notes":               notes,
        "suggested_followups": suggested_followups,
    }


# ── Main pipeline ─────────────────────────────────────────────────────────────

# Maps frontend render_mode value → canonical intent_type for the planner
_FORCED_INTENT: dict[str, str] = {
    "manim": "math",
    "svg":   "illustration",
}


async def run_generation_pipeline(
    message:              str,
    session_id:           str,
    output_dir:           str,
    conversation_context: str,
    notes_enabled:        bool,
    forced_render_mode:   Optional[str] = None,
) -> dict:
    """
    Runs the full generation pipeline: Planning → Frame generation → Save outputs.

    Returns result_payload dict ready to be returned to the client.
    The caller (route handler) is responsible for setting/resetting context vars
    (request_log, token_usage, request_llm_service) before/after this call.
    """
    # ── Stage 1: Planning ─────────────────────────────────────────────────────
    _log({"event": "stage_start", "stage": "planning"})

    # Always run classify — it produces notes/followups cheaply.
    # If the user forced a render mode, we override intent_type/frame_count after.
    intent_type, frame_count, notes_list, followups, _domain = await classify_intent(
        message, conversation_context
    )
    notes = "\n".join(notes_list) if notes_list else ""
    suggested_followups = followups or []

    if forced_render_mode and forced_render_mode in _FORCED_INTENT:
        intent_type = _FORCED_INTENT[forced_render_mode]
        frame_count = 4
        logger.info("Intent forced  render_mode=%s  intent=%s  frames=%d", forced_render_mode, intent_type, frame_count)
    else:
        logger.info("Intent classified  intent=%s  frames=%d", intent_type, frame_count)

    _log({"event": "stage_complete", "stage": "planning_classify",
          "intent_type": intent_type, "frame_count": frame_count,
          "forced": forced_render_mode or "auto"})

    # Call 2 — intent-specific planning
    vocab_plan = await create_vocab_plan(message, conversation_context, intent_type, frame_count)
    plan = _vocab_plan_to_generation_plan(vocab_plan)

    _log({"event": "stage_complete", "stage": "planning",
          "intent_type": plan.intent_type, "frame_count": plan.frame_count, "layout": plan.layout})
    logger.info(
        "Planning complete  session=%s  intent=%s  frames=%d  layout=%s",
        session_id, plan.intent_type, plan.frame_count, plan.layout,
    )

    captions         = [frame.caption for frame in plan.frames]
    frame_narrations = [frame.narration for frame in plan.frames]

    narration_lines: list[str] = []
    for i, frame in enumerate(plan.frames):
        narration_lines.append(f"Frame {i + 1}: {frame.caption}")
        narration_lines.append(frame.narration)
        narration_lines.append("")

    # ── Stage 2: Frame generation ─────────────────────────────────────────────
    result_payload, ui_output_file = await _run_frame_generation(
        plan, session_id, output_dir, captions, frame_narrations,
        suggested_followups, notes,
    )

    # ── Save narration (includes slide narrations from interleaving) ──────────
    final_narrations = result_payload.get("_narrations", [])
    if final_narrations:
        final_captions_list = result_payload.get("captions", captions)
        interleaved_lines: list[str] = []
        for i, (cap, narr) in enumerate(zip(final_captions_list, final_narrations)):
            interleaved_lines.append(f"Frame {i + 1}: {cap}")
            interleaved_lines.append(narr)
            interleaved_lines.append("")
        with open(os.path.join(output_dir, "narration.txt"), "w") as f:
            f.write("\n".join(interleaved_lines).strip() + "\n")
    else:
        with open(os.path.join(output_dir, "narration.txt"), "w") as f:
            f.write("\n".join(narration_lines).strip() + "\n")
    result_payload.pop("_narrations", None)

    result_payload["ui_output_file"] = ui_output_file
    return result_payload


async def _run_frame_generation(
    plan:                GenerationPlan,
    session_id:          str,
    output_dir:          str,
    captions:            list[str],
    frame_narrations:    list[str],
    suggested_followups: list[str],
    notes:               str,
) -> tuple[dict, Optional[str]]:
    """
    Dispatch to the correct frame renderer: Manim (math) or SVG (everything else).
    Returns (result_payload, ui_output_file_path).
    """
    accent = plan.shared_style.backgroundColor

    # ── Manim ─────────────────────────────────────────────────────────────────
    if plan.intent_type in MANIM_INTENT_TYPES and manim_available():
        logger.info("Render path → manim  session=%s  frames=%d", session_id, plan.frame_count)
        _log({"event": "stage_start", "stage": "frame_generation", "path": "manim",
              "frame_count": plan.frame_count})

        manim_dir = os.path.join(output_dir, "manim")
        png_paths = await generate_manim_frames(plan, _MANIM_PROMPT_TEMPLATE, manim_dir)
        _log({"event": "stage_complete", "stage": "frame_generation", "path": "manim"})

        from services.frame_generation.planner import request_log
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

        all_images, all_captions, all_narrations = _interleave_slides(
            png_paths, captions, frame_narrations, plan.slide_frames, output_dir, accent
        )
        all_images, all_captions, all_narrations = _append_summary_slide(
            all_images, all_captions, all_narrations, notes, accent, output_dir
        )

        with open(os.path.join(output_dir, "frames.json"), "w") as f:
            json.dump({"render_path": "manim", "images": all_images, "captions": all_captions,
                       "suggested_followups": suggested_followups, "notes": notes}, f, indent=2)

        return {
            "session_id":          session_id,
            "render_path":         "manim",
            "frame_count":         len(all_images),
            "intent_type":         plan.intent_type,
            "captions":            all_captions,
            "images":              all_images,
            "ui_file_type":        "python",
            "suggested_followups": suggested_followups,
            "notes":               notes,
            "_narrations":         all_narrations,
        }, ui_output_file

    # ── SVG (all non-math intents) ────────────────────────────────────────────
    if not svg_available():
        logger.error("cairosvg unavailable and no fallback — session=%s", session_id)
        raise RuntimeError("SVG renderer (cairosvg) is not installed.")

    if plan.intent_type in MANIM_INTENT_TYPES:
        logger.warning("Manim not available — falling back to SVG  session=%s", session_id)

    logger.info("Render path → svg  session=%s  frames=%d  intent=%s",
                session_id, plan.frame_count, plan.intent_type)
    _log({"event": "stage_start", "stage": "frame_generation", "path": "svg",
          "frame_count": plan.frame_count})

    svg_dir    = os.path.join(output_dir, "svg")
    frame_narrations_per_frame = [f.narration for f in plan.frames]
    frame_paths = await generate_svg_frames(
        plan, _SVG_PROMPT_TEMPLATE, svg_dir,
        frame_narrations=frame_narrations_per_frame,
    )
    _log({"event": "stage_complete", "stage": "frame_generation", "path": "svg"})

    all_images, all_captions, all_narrations = _interleave_slides(
        frame_paths, captions, frame_narrations, plan.slide_frames, output_dir, accent
    )
    all_images, all_captions, all_narrations = _append_summary_slide(
        all_images, all_captions, all_narrations, notes, accent, output_dir
    )

    ui_output_file = os.path.join(output_dir, "final_output.json")
    with open(os.path.join(output_dir, "frames.json"), "w") as f:
        json.dump({"render_path": "svg", "images": all_images, "captions": all_captions,
                   "suggested_followups": suggested_followups, "notes": notes}, f, indent=2)
    with open(ui_output_file, "w") as f:
        json.dump({"render_path": "svg", "images": all_images, "captions": all_captions}, f, indent=2)

    return {
        "session_id":          session_id,
        "render_path":         "svg",
        "frame_count":         len(all_images),
        "intent_type":         plan.intent_type,
        "captions":            all_captions,
        "images":              all_images,
        "ui_file_type":        "images",
        "suggested_followups": suggested_followups,
        "notes":               notes,
        "_narrations":         all_narrations,
    }, ui_output_file
