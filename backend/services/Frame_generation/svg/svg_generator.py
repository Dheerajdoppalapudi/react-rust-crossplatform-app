"""
SVG Generator — frame generation for illustration, concept_analogy, and comparison content.

Pipeline per frame:
  1. LLM call  → raw SVG string  (parallel, via asyncio.gather)
  2. Extract SVG markup from the LLM response
  3. Save .svg file to disk
  4. Convert SVG → PNG using cairosvg  (output: 1200×900)
  5. If step 2 or 4 fails → one correction retry with the specific error
  6. Return absolute path to the PNG

All N frames run in parallel. Failed frames return None (same graceful
fallback pattern as manim_generator). Only frames that actually fail are
retried — successful frames are never touched again.

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

from services.Frame_generation.planner import GenerationPlan, FramePlan, call_llm
from services.Frame_generation.svg.component_library import SVGComponent
from services.Frame_generation.svg.component_generator import generate_svg_components, build_component_injection


# ---------------------------------------------------------------------------
# Availability check
# ---------------------------------------------------------------------------

def svg_available() -> bool:
    """Return True if cairosvg is installed and the SVG path is usable."""
    return _CAIROSVG_AVAILABLE


# ---------------------------------------------------------------------------
# SVG sanitizer — strip attributes that crash cairosvg
# ---------------------------------------------------------------------------

# Attributes whose empty-string value causes cairosvg to throw a parse error.
# The LLM sets these to "" to "reset" them, but cairosvg needs either a valid
# value or the attribute to be absent entirely.
_STRIP_IF_EMPTY = re.compile(
    r'\b(stroke-dasharray|marker-end|marker-start|marker-mid'
    r'|stroke-dashoffset|stroke-miterlimit|clip-path|filter|mask'
    r'|xlink:href|href)\s*=\s*""',
    re.IGNORECASE,
)

# Matches a bare & that is NOT already the start of a valid XML entity.
# Valid entities: &amp; &lt; &gt; &quot; &apos; &#123; &#xAB;
# Everything else (e.g. "AT&T", "R&D") must become &amp;
_BARE_AMPERSAND = re.compile(
    r'&(?!(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)'
)

# XML 1.0 forbids control characters except tab (0x09), newline (0x0A),
# and carriage return (0x0D). LLMs occasionally emit these inside text or
# attribute values — cairosvg's XML parser throws "invalid token" for them.
_CONTROL_CHARS = re.compile(r'[\x00-\x08\x0B\x0C\x0E-\x1F]')


def _fix_text_nodes(svg: str) -> str:
    """
    Escape bare < and > characters inside SVG text content.

    Text nodes sit between a closing > and the next opening <.
    The LLM sometimes writes things like:
        <text>a < b</text>   or   <text>x > 0</text>
    which are invalid XML tokens — cairosvg's parser rejects them.

    We only touch content between tags (text nodes), never the tags themselves.
    """
    def _escape(m: re.Match) -> str:
        # Replace only bare < and > (& was already fixed before this runs)
        return m.group(0).replace('<', '&lt;').replace('>', '&gt;')

    # Match text between > and <, excluding whitespace-only runs
    return re.sub(r'(?<=>)([^<]+)(?=<)', _escape, svg)


def _sanitize_svg(svg: str) -> str:
    """
    Fix common LLM mistakes that cause cairosvg XML parse errors.

    Three classes of fix, applied in order:

    1. Strip empty presentation attributes  (e.g. stroke-dasharray="")
       cairosvg tries to parse the empty string as a value and raises
       ValueError.  Removing the attribute entirely is safe — the element
       just inherits or uses the default.

    2. Escape bare ampersands in text/attribute content  (e.g. AT&T → AT&amp;T)
       & is only legal in XML as the start of an entity reference (&amp; etc.).
       LLMs frequently emit raw company names, URLs, and formulas with bare &.

    3. Escape bare < and > inside text nodes  (e.g. a < b → a &lt; b)
       < is never legal outside a tag; > is legal but flagged as an error
       by strict XML parsers like cairosvg.

    Runs on every SVG before cairosvg, so the LLM does not need to be
    perfectly compliant — we catch the most common mistakes here.
    """
    # Step 0 — strip XML-illegal control characters (null bytes, BEL, etc.)
    #           Must run first — these can hide inside any token and confuse
    #           every subsequent regex.
    svg = _CONTROL_CHARS.sub("", svg)

    # Step 1 — strip empty presentation attributes
    svg = _STRIP_IF_EMPTY.sub("", svg)

    # Step 2 — fix bare ampersands (must run before step 3 so we don't
    #           double-escape the & in &lt; / &gt; added by step 3)
    svg = _BARE_AMPERSAND.sub("&amp;", svg)

    # Step 3 — fix bare < > in text nodes
    svg = _fix_text_nodes(svg)

    return svg


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
    component_library: dict[str, SVGComponent] | None = None,
) -> str:
    """
    Synchronous LLM call that returns the raw LLM response for one frame.

    If component_library is provided (non-empty), injects the actual SVG
    markup for each entity so the model copy-pastes exact icons rather than
    re-drawing them from a text description.  This guarantees pixel-identical
    icons across all parallel frames.

    If component_library is empty or None, falls back to injecting the
    text-based element_vocabulary as before.
    """
    stroke = plan.shared_style.strokeColor
    bg     = plan.shared_style.backgroundColor

    style_note = (
        f"\n\nStyle constraints (apply consistently across ALL frames for visual coherence):\n"
        f'- stroke="{stroke}" on ALL shape outlines, lines, and paths\n'
        f'- fill="{bg}" as the primary fill for key shapes (containers, main bodies)\n'
        f'- Canvas background <rect> always fill="white" — NEVER use "{bg}" on the canvas background\n'
        f'- Arrow marker <polygon> fill must also be "{stroke}"\n'
        f'- font-family="Arial, Helvetica, sans-serif" on every <text> element\n'
    )

    if component_library:
        # Inject actual SVG markup — model positions pre-built icons, not text hints
        vocab_note = build_component_injection(component_library)
    elif plan.element_vocabulary:
        # Fallback: text descriptions only (no component library available)
        lines = [f'  - "{k}": {v}' for k, v in plan.element_vocabulary.items()]
        vocab_note = (
            "\n\nElement vocabulary (STRICTLY reproduce each named entity with the same "
            "shape, fill color, approximate size, and label in every frame it appears — "
            "visual consistency across frames depends on this):\n"
            + "\n".join(lines)
        )
    else:
        vocab_note = ""

    description = frame.description + style_note + vocab_note
    prompt = prompt_template.replace("{{DIAGRAM_DESCRIPTION}}", description)
    return call_llm(prompt)


# ---------------------------------------------------------------------------
# Single frame: SVG → PNG via cairosvg
# ---------------------------------------------------------------------------

def _render_frame(svg_text: str, frame_index: int, output_dir: str) -> tuple[Optional[str], Optional[str]]:
    """
    Save SVG markup to disk and convert it to PNG using cairosvg.

    Output PNG is always 1200×900 — matches the canvas size the prompt enforces.
    Returns (png_path, None) on success, or (None, error_message) on failure.
    """
    frame_dir = os.path.join(output_dir, f"frame_{frame_index}")
    os.makedirs(frame_dir, exist_ok=True)

    svg_path = os.path.join(frame_dir, "frame.svg")
    png_path = os.path.join(frame_dir, "frame.png")

    clean_svg = _sanitize_svg(svg_text)
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(clean_svg)

    try:
        cairosvg.svg2png(
            url=svg_path,
            write_to=png_path,
            output_width=1200,
            output_height=900,
        )
        return png_path, None
    except Exception as e:
        print(f"[svg_generator] Frame {frame_index} render error: {e}")
        return None, str(e)


# ---------------------------------------------------------------------------
# Single frame: correction retry prompt
# ---------------------------------------------------------------------------

def _generate_svg_code_retry(
    frame: FramePlan,
    plan: GenerationPlan,
    failure_reason: str,
    failed_svg: str = "",
) -> str:
    """
    One corrective LLM call used only when the first attempt failed.

    Sends the original description + the specific failure back to the model
    so it can fix the exact problem rather than regenerating blindly.
    """
    stroke = plan.shared_style.strokeColor
    bg     = plan.shared_style.backgroundColor

    svg_excerpt = ""
    if failed_svg:
        # Send only the first 2000 chars to avoid token bloat
        excerpt = failed_svg[:2000]
        if len(failed_svg) > 2000:
            excerpt += "\n... (truncated)"
        svg_excerpt = f"\n\nYour previous SVG output (for reference):\n{excerpt}\n"

    correction_prompt = (
        f"The SVG you generated failed with this specific error:\n\n"
        f"ERROR: {failure_reason}\n"
        f"{svg_excerpt}\n"
        f"Original diagram description:\n{frame.description}\n\n"
        f"Style constraints:\n"
        f'- stroke="{stroke}" on ALL shape outlines\n'
        f'- fill="{bg}" as the primary fill for key shapes\n'
        f'- Canvas background fill="white"\n\n'
        f"Please regenerate a corrected SVG. Critical rules:\n"
        f"- Output ONLY raw SVG starting with <svg and ending with </svg>\n"
        f"- No gradients, no filters, no CSS style blocks, no external resources\n"
        f"- Every filled shape must be emitted BEFORE the text that appears on or near it\n"
        f"- Pair each shape immediately with its label — never batch all shapes then all labels\n"
        f"- Flat fills only (no opacity, no semi-transparent overlaps)\n"
        f"- All text within x: 40–1160, y: 30–860\n"
    )
    return call_llm(correction_prompt)


# ---------------------------------------------------------------------------
# Single frame: orchestrate LLM + render (async wrapper)
# ---------------------------------------------------------------------------

async def _generate_one_svg_frame(
    frame: FramePlan,
    frame_index: int,
    plan: GenerationPlan,
    prompt_template: str,
    output_dir: str,
    component_library: dict[str, SVGComponent] | None = None,
) -> Optional[str]:
    """
    Generate and render one SVG frame. Returns absolute PNG path or None.

    Runs the synchronous LLM call and cairosvg render in threads so the
    event loop is never blocked.

    On failure (bad extraction OR cairosvg crash) a single corrective retry
    is attempted with the specific error included in the prompt. Only the
    failing frame retries — successful frames are never re-run.
    """
    raw = await asyncio.to_thread(_generate_svg_code, frame, plan, prompt_template, component_library)
    svg_text = _extract_svg(raw)

    # ── Retry if extraction produced no valid SVG ────────────────────────────
    if not svg_text.lower().startswith("<svg"):
        print(f"[svg_generator] Frame {frame_index}: no valid SVG in LLM response — retrying with correction")
        raw = await asyncio.to_thread(
            _generate_svg_code_retry, frame, plan,
            failure_reason="Your response did not contain valid SVG markup. "
                           "The response must start with <svg and end with </svg>. "
                           "Do not include markdown fences, prose, or any text outside the SVG tags.",
        )
        svg_text = _extract_svg(raw)
        if not svg_text.lower().startswith("<svg"):
            print(f"[svg_generator] Frame {frame_index}: retry also failed to produce valid SVG — skipping frame")
            return None

    # ── Render SVG → PNG ─────────────────────────────────────────────────────
    png_path, render_error = await asyncio.to_thread(_render_frame, svg_text, frame_index, output_dir)

    # ── Retry if cairosvg crashed ─────────────────────────────────────────────
    if png_path is None:
        print(f"[svg_generator] Frame {frame_index}: render failed — retrying with correction")
        raw = await asyncio.to_thread(
            _generate_svg_code_retry, frame, plan,
            failure_reason=(
                f"cairosvg failed to render your SVG. Error: {render_error}. "
                "Common causes: gradients (<linearGradient>/<radialGradient>), "
                "filters (drop-shadow/blur), external image hrefs, malformed path data, "
                "or invalid attribute values. Use only flat fills, inline attributes, "
                "and standard SVG primitives (rect, circle, ellipse, line, path, text)."
            ),
            failed_svg=svg_text,
        )
        svg_text = _extract_svg(raw)
        if not svg_text.lower().startswith("<svg"):
            print(f"[svg_generator] Frame {frame_index}: retry produced no valid SVG — skipping frame")
            return None
        png_path, _ = await asyncio.to_thread(_render_frame, svg_text, frame_index, output_dir)

    return png_path


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

    Pipeline:
      Stage 1.5 — Component generation (sequential, runs once):
        For each entity in element_vocabulary, look up the pre-built icon
        library.  Any entity not in the library is generated via one LLM
        call covering all novel entities together.  Result: a dict of
        entity_key → SVGComponent (actual SVG markup at origin).

      Stage 2 — Frame generation (parallel):
        All N frames run concurrently.  Each receives the component library
        and copy-pastes the exact SVG markup into its frame, guaranteeing
        pixel-identical icons across frames.

    Args:
        plan:            GenerationPlan produced by the planner.
        prompt_template: Contents of svg_prompt.md, loaded by the caller.
        output_dir:      Directory where per-frame subdirectories are created.
    """
    # ── Stage 1.5: build component library ───────────────────────────────────
    component_library: dict[str, SVGComponent] = {}
    if plan.element_vocabulary:
        print(f"[svg_generator] Building component library for {len(plan.element_vocabulary)} entity/entities")
        component_library = await generate_svg_components(plan)
        print(f"[svg_generator] Component library ready: {list(component_library.keys())}")

    # ── Stage 2: all frames in parallel ──────────────────────────────────────
    tasks = [
        _generate_one_svg_frame(frame, i, plan, prompt_template, output_dir, component_library)
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
