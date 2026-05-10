"""
Generation service — frame-rendering helpers and the video pipeline entry point.

Orchestration (intent classification, search, routing) now lives in routers/generate.py.
This module owns:
  - Conversation context builders (build_conversation_context, build_interactive_context)
  - Frame rendering helpers (_interleave_slides, _append_summary_slide, _run_frame_generation)
  - run_video_pipeline_from_intent() — video pipeline entry point for pre-computed intent
  - Utility: count_llm_calls()
"""

import json
import logging
import os
import time
from pathlib import Path
from typing import AsyncGenerator, Optional

from core.config import (
    MANIM_INTENT_TYPES,
    SVG_INTENT_TYPES,
    INTERACTIVE_CONTEXT_TURNS,
)
from core.database import get_db
from services.frame_generation.planner import (
    GenerationPlan,
    _vocab_plan_to_generation_plan,
    create_vocab_plan,
    _log,
)
from services.frame_generation.manim.manim_generator import generate_manim_frames, manim_available
from services.frame_generation.svg.svg_generator import generate_svg_frames, svg_available
from services.frame_generation.slide_generator import generate_slide, generate_summary_slide

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent / "frame_generation" / "prompts"


def _load_prompt(filename: str) -> str:
    return (_PROMPTS_DIR / filename).read_text(encoding="utf-8")


_MANIM_PROMPT_TEMPLATE = _load_prompt("manim_prompt.md")
_SVG_PROMPT_TEMPLATE   = _load_prompt("svg_prompt.md")


# ── Utilities ─────────────────────────────────────────────────────────────────

def count_llm_calls(log: list) -> int:
    return sum(1 for e in log if e.get("event") in ("llm_call", "llm_call_fast"))


def _parse_narrations_from_file(narration_path: str) -> list[str]:
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
    slides_dir = os.path.join(output_dir, "slides")
    os.makedirs(slides_dir, exist_ok=True)

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

    all_images, all_captions, all_narrations = [], [], []
    for idx, (png, cap, narr) in enumerate(zip(png_paths, captions, narrations)):
        for slide_path, slide_cap, slide_narr in insertions.get(idx, []):
            all_images.append(slide_path)
            all_captions.append(slide_cap)
            all_narrations.append(slide_narr)
        all_images.append(png)
        all_captions.append(cap)
        all_narrations.append(narr)

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


# ── Conversation context builders ─────────────────────────────────────────────

def build_conversation_context(
    parent_session_id: Optional[str],
    pause_session_id:  Optional[str] = None,
    pause_frame_index: Optional[int] = None,
    pause_caption:     Optional[str] = None,
) -> str:
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

    chain.reverse()
    return chain


def build_interactive_context(
    parent_session_id: Optional[str],
) -> str:
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
                    lines.append(f"  Explanation: {block['content'][:300]}")
                elif block.get("type") == "entity":
                    entity_type = block.get("entity_type", "")
                    props = block.get("props", {})
                    if entity_type == "mermaid_viewer":
                        lines.append(f"  Widget: diagram — {props.get('caption', entity_type)}")
                    elif entity_type == "code_walkthrough":
                        lines.append(f"  Widget: code walkthrough ({props.get('language', '')})")
                    elif entity_type == "math_formula":
                        lines.append(f"  Widget: formula — {props.get('latex', props.get('caption', ''))}")
                    elif entity_type == "chart":
                        lines.append(f"  Widget: {props.get('type', 'chart')} chart — {props.get('title', props.get('caption', ''))}")
                    elif entity_type == "timeline":
                        lines.append(f"  Widget: timeline ({len(props.get('events', []))} events)")
                    else:
                        lines.append(f"  Widget: {entity_type}")

        lines.append("")

    lines += [
        "────────────────────────────────────────────────────────────────────",
        "",
    ]
    return "\n".join(lines)


# ── Video pipeline ────────────────────────────────────────────────────────────

async def run_video_pipeline_from_intent(
    intent:               dict,
    synthesis_text:       str,
    session_id:           str,
    output_dir:           str,
    conversation_context: str,
    notes_enabled:        bool = False,
    forced_render_mode:   Optional[str] = None,
) -> AsyncGenerator[dict, None]:
    """
    Video pipeline entry point for pre-computed intent from plan_and_classify().

    Accepts the intent dict and optional synthesis_text (from the synthesiser for
    deep research). Skips the intent classification step (already done).
    """
    t0 = time.time()

    intent_type = intent.get("intent_type", "process")
    frame_count = intent.get("frame_count", 3)
    notes_list  = intent.get("notes", [])
    suggested_followups = intent.get("suggested_followups", [])

    # render_mode override (e.g. user forced "manim" or "svg" from the UI)
    _FORCED_INTENT = {"manim": "math", "svg": "illustration"}
    if forced_render_mode and forced_render_mode in _FORCED_INTENT:
        intent_type = _FORCED_INTENT[forced_render_mode]
        frame_count = 4

    notes = "\n".join(notes_list) if isinstance(notes_list, list) else (notes_list or "")

    # Use synthesis_text (grounded in sources) if available, else enriched_prompt
    effective_message = synthesis_text or intent.get("enriched_prompt", "")

    yield {"type": "stage", "stage": "planning", "label": "Planning visual content…"}
    _log({"event": "stage_start", "stage": "planning"})

    vocab_plan = await create_vocab_plan(effective_message, conversation_context, intent_type, frame_count)
    plan = _vocab_plan_to_generation_plan(vocab_plan)

    _log({"event": "stage_complete", "stage": "planning",
          "intent_type": plan.intent_type, "frame_count": plan.frame_count})

    yield {
        "type":       "stage_done",
        "stage":      "planning",
        "duration_s": round(time.time() - t0, 2),
    }

    captions         = [frame.caption for frame in plan.frames]
    frame_narrations = [frame.narration for frame in plan.frames]

    yield {"type": "stage", "stage": "generating_frames", "label": "Generating frames…"}
    t1 = time.time()

    result_payload, ui_output_file, all_narrations = await _run_frame_generation(
        plan, session_id, output_dir, captions, frame_narrations,
        suggested_followups, notes,
    )

    for i, (img, cap) in enumerate(zip(result_payload["images"], result_payload["captions"])):
        yield {"type": "frame", "index": i, "image": img, "caption": cap}

    yield {
        "type":       "stage_done",
        "stage":      "generating_frames",
        "duration_s": round(time.time() - t1, 2),
    }

    final_captions = result_payload.get("captions", captions)
    interleaved_lines: list[str] = []
    for i, (cap, narr) in enumerate(zip(final_captions, all_narrations)):
        interleaved_lines.append(f"Frame {i + 1}: {cap}")
        interleaved_lines.append(narr)
        interleaved_lines.append("")

    os.makedirs(output_dir, exist_ok=True)
    with open(os.path.join(output_dir, "narration.txt"), "w") as f:
        f.write("\n".join(interleaved_lines).strip() + "\n")

    result_payload["ui_output_file"] = ui_output_file
    yield {"type": "result", "payload": result_payload}


async def _run_frame_generation(
    plan:                GenerationPlan,
    session_id:          str,
    output_dir:          str,
    captions:            list[str],
    frame_narrations:    list[str],
    suggested_followups: list[str],
    notes:               str,
) -> tuple[dict, Optional[str], list[str]]:
    accent = plan.shared_style.backgroundColor

    # ── Manim ─────────────────────────────────────────────────────────────────
    if plan.intent_type in MANIM_INTENT_TYPES and manim_available():
        _log({"event": "stage_start", "stage": "frame_generation", "path": "manim"})
        manim_dir  = os.path.join(output_dir, "manim")
        png_paths  = await generate_manim_frames(plan, _MANIM_PROMPT_TEMPLATE, manim_dir)
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
        }, ui_output_file, all_narrations

    # ── SVG ───────────────────────────────────────────────────────────────────
    if not svg_available():
        raise RuntimeError("SVG renderer (cairosvg) is not installed.")

    if plan.intent_type in MANIM_INTENT_TYPES:
        logger.warning("Manim not available — falling back to SVG  session=%s", session_id)

    _log({"event": "stage_start", "stage": "frame_generation", "path": "svg"})
    svg_dir    = os.path.join(output_dir, "svg")
    frame_paths = await generate_svg_frames(
        plan, _SVG_PROMPT_TEMPLATE, svg_dir,
        frame_narrations=[f.narration for f in plan.frames],
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
    }, ui_output_file, all_narrations
