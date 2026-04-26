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
import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import cairosvg
    _CAIROSVG_AVAILABLE = True
except (ImportError, OSError):
    _CAIROSVG_AVAILABLE = False

try:
    from lxml import etree as _lxml_etree
    _LXML_AVAILABLE = True
except ImportError:
    _LXML_AVAILABLE = False

from services.frame_generation.planner import GenerationPlan, FramePlan, call_llm


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

    Four classes of fix, applied in order:

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

    4. lxml recovery pass — re-parse and re-serialise with lxml's recover=True
       parser, which auto-closes unclosed tags, drops invalid tokens, and fixes
       structural issues that the regex passes above can't catch. This eliminates
       most "unclosed token" and "not well-formed" errors without needing a retry.

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

    # Step 4 — lxml structural repair (unclosed tags, invalid tokens, etc.)
    if _LXML_AVAILABLE:
        try:
            parser = _lxml_etree.XMLParser(
                recover=True,
                remove_blank_text=False,
                resolve_entities=False,
            )
            tree = _lxml_etree.fromstring(svg.encode("utf-8"), parser)
            repaired = _lxml_etree.tostring(tree, encoding="unicode", xml_declaration=False)
            if repaired and repaired.strip().startswith("<"):
                svg = repaired
                logger.debug("svg_sanitizer: lxml repair applied")
        except Exception as e:
            logger.debug("svg_sanitizer: lxml repair failed (%s) — using pre-lxml output", e)

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
    frame_index: int = 0,
) -> str:
    """Synchronous LLM call that returns the raw LLM response for one SVG frame."""
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

    if plan.element_vocabulary:
        lines = []
        for k, v in plan.element_vocabulary.items():
            if isinstance(v, dict):
                parts = []
                if "shape" in v:   parts.append(v["shape"])
                if "fill"  in v:   parts.append(f'fill {v["fill"]}')
                if "label" in v:   parts.append(f'label \'{v["label"]}\'')
                if "estimated_width" in v and "estimated_height" in v:
                    parts.append(f'{v["estimated_width"]}x{v["estimated_height"]}')
                spec_str = ", ".join(parts) if parts else k.replace("_", " ").title()
            else:
                spec_str = str(v)
            lines.append(f'  - "{k}": {spec_str}')
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

    # Cache the large static instruction block; only the frame description is dynamic.
    split_idx = prompt_template.find("{{DIAGRAM_DESCRIPTION}}")
    cache_prefix = prompt_template[:split_idx] if split_idx != -1 else ""

    return call_llm(
        prompt, 8000,
        prompt_name=f"svg_prompt.md (frame {frame_index})",
        cache_prefix=cache_prefix,
    )


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

    # Read viewBox height from the SVG so variable-height frames render correctly.
    # Falls back to 900 if the viewBox attribute is absent or malformed.
    height_match = re.search(r'viewBox=["\']0 0 \d+ (\d+)["\']', clean_svg)
    svg_height = int(height_match.group(1)) if height_match else 900

    try:
        cairosvg.svg2png(
            url=svg_path,
            write_to=png_path,
            output_width=1200,
            output_height=svg_height,
        )
        return png_path, None
    except Exception as e:
        logger.error("svg_generator frame %d render error: %s", frame_index, e)
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
        f"- Output ONLY raw SVG starting with <svg and ending with </svg>. Nothing after </svg>.\n"
        f"- No gradients, no filters, no CSS style blocks, no external resources\n"
        f"- Every filled shape must be emitted BEFORE the text that appears on or near it\n"
        f"- Pair each shape immediately with its label — never batch all shapes then all labels\n"
        f"- Flat fills only (no opacity, no semi-transparent overlaps)\n"
        f"- All text within x: 40–1160, y: 30–860\n"
        f"XML VALIDITY — the previous failure was an XML parse error. Follow strictly:\n"
        f"- Self-close every empty element: <rect .../> <line .../> <circle .../>\n"
        f"- Close every container: <g>...</g> <text>...</text> <defs>...</defs>\n"
        f"- Escape ALL special chars in text/attributes: & → &amp;  < → &lt;  > → &gt;\n"
        f"- Never use HTML entities (&nbsp; &copy; &rarr; etc) — use the Unicode character directly\n"
        f"- If complexity risks truncation, simplify shapes — a complete simple SVG beats an incomplete complex one\n"
    )
    return call_llm(correction_prompt, 8000, prompt_name=f"svg_prompt.md (frame {frame.index} retry)")


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

    On failure (bad extraction OR cairosvg crash) a single corrective retry
    is attempted with the specific error included in the prompt. Only the
    failing frame retries — successful frames are never re-run.
    """
    raw = await asyncio.to_thread(_generate_svg_code, frame, plan, prompt_template, frame_index)
    svg_text = _extract_svg(raw)

    # ── Retry if extraction produced no valid SVG ────────────────────────────
    if not svg_text.lower().startswith("<svg"):
        logger.warning("svg_generator frame %d: no valid SVG in LLM response — retrying", frame_index)
        raw = await asyncio.to_thread(
            _generate_svg_code_retry, frame, plan,
            failure_reason="Your response did not contain valid SVG markup. "
                           "The response must start with <svg and end with </svg>. "
                           "Do not include markdown fences, prose, or any text outside the SVG tags.",
        )
        svg_text = _extract_svg(raw)
        if not svg_text.lower().startswith("<svg"):
            logger.warning("svg_generator frame %d: retry also failed to produce valid SVG — skipping", frame_index)
            return None

    # ── Render SVG → PNG ─────────────────────────────────────────────────────
    png_path, render_error = await asyncio.to_thread(_render_frame, svg_text, frame_index, output_dir)

    # ── Retry if cairosvg crashed ─────────────────────────────────────────────
    if png_path is None:
        logger.warning("svg_generator frame %d: render failed — retrying with correction", frame_index)
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
            logger.warning("svg_generator frame %d: retry produced no valid SVG — skipping", frame_index)
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

    Two-phase to maximise Anthropic prompt cache hits:
      Phase 1 — fire frame 0 alone and await it. This writes the cache entry
                 for the 36KB static prompt template (cache_write at 1.25×).
      Phase 2 — fire remaining frames in parallel. They all hit cache_read
                 (0.1× input token rate) instead of paying cache_write again.
    Trade-off: ~10s sequential latency on frame 0 vs ~$0.12 saved per video.

    Returns a list of absolute PNG paths (None = failed frame).
    """
    if not plan.frames:
        return []

    # Phase 1 — warm the cache with frame 0
    first = await _generate_one_svg_frame(
        plan.frames[0], 0, plan, prompt_template, output_dir
    )

    if len(plan.frames) == 1:
        return [first]

    # Phase 2 — remaining frames in parallel (cache entry now exists)
    rest_tasks = [
        _generate_one_svg_frame(frame, i, plan, prompt_template, output_dir)
        for i, frame in enumerate(plan.frames[1:], start=1)
    ]
    rest_results = await asyncio.gather(*rest_tasks, return_exceptions=True)

    paths: list[Optional[str]] = [first]
    for i, result in enumerate(rest_results, start=1):
        if isinstance(result, Exception):
            logger.error("svg_generator frame %d exception: %s", i, result)
            paths.append(None)
        else:
            paths.append(result)

    return paths
