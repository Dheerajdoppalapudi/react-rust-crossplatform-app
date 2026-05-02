"""
SVG Generator — frame generation for all non-math content.

Static (cairosvg) pipeline per frame:
  1. LLM call  → raw SVG string  (parallel, via asyncio.gather)
  2. Extract SVG markup from the LLM response
  3. Save .svg file to disk
  4. Convert SVG → PNG using cairosvg  (output: 1200×<svg_height>)
  5. If step 2 or 4 fails → one correction retry with the specific error
  6. Return absolute path to the PNG

Animated (Playwright) pipeline per frame:
  1-3. Same as above (LLM → SVG → disk)
  4. Build HTML page with SVG + inline RAF animation engine
  5. Playwright: install clock → setContent → tick msPerFrame × N → screenshot × N
  6. ffmpeg: PNG sequence → MP4 clip
  7. Return absolute path to the MP4

Animation is driven by requestAnimationFrame — NOT CSS animation-duration or SVG SMIL.
Playwright's page.clock.tick() controls only RAF; CSS/SMIL ignore it.

All N frames run in parallel. Failed frames return None (same graceful fallback
pattern as manim_generator). Only frames that actually fail are retried.

Requires:
  pip install cairosvg             (always needed)
  pip install playwright           (for animated output)
  playwright install chromium      (one-time ~150 MB download)
"""

import asyncio
import json
import logging
import math
import os
import re
import subprocess
from typing import Optional

logger = logging.getLogger(__name__)

# ── Optional dependency guards ────────────────────────────────────────────────

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

try:
    from playwright.async_api import async_playwright   # noqa: F401 — just check import
    _PLAYWRIGHT_AVAILABLE = True
except ImportError:
    _PLAYWRIGHT_AVAILABLE = False

from services.frame_generation.planner import GenerationPlan, FramePlan, call_llm


# ── Animation constants ───────────────────────────────────────────────────────

FPS = 24
LOOP_PERIODS  = {"fast": 0.65, "medium": 1.0, "slow": 1.55}
NUM_PARTICLES = 5


# ── Availability checks ───────────────────────────────────────────────────────

def svg_available() -> bool:
    """Return True if cairosvg is installed and the SVG path is usable."""
    return _CAIROSVG_AVAILABLE


# ── SVG sanitizer — strip attributes that crash cairosvg ─────────────────────

_STRIP_IF_EMPTY = re.compile(
    r'\b(stroke-dasharray|marker-end|marker-start|marker-mid'
    r'|stroke-dashoffset|stroke-miterlimit|clip-path|filter|mask'
    r'|xlink:href|href)\s*=\s*""',
    re.IGNORECASE,
)
_BARE_AMPERSAND = re.compile(
    r'&(?!(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)'
)
_CONTROL_CHARS = re.compile(r'[\x00-\x08\x0B\x0C\x0E-\x1F]')


def _fix_text_nodes(svg: str) -> str:
    def _escape(m: re.Match) -> str:
        return m.group(0).replace('<', '&lt;').replace('>', '&gt;')
    return re.sub(r'(?<=>)([^<]+)(?=<)', _escape, svg)


def _sanitize_svg(svg: str) -> str:
    svg = _CONTROL_CHARS.sub("", svg)
    svg = _STRIP_IF_EMPTY.sub("", svg)
    svg = _BARE_AMPERSAND.sub("&amp;", svg)
    svg = _fix_text_nodes(svg)

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


# ── SVG extraction helper ─────────────────────────────────────────────────────

def _extract_svg(text: str) -> str:
    fence = re.search(r"```(?:svg|xml)?\s*(<svg[\s>].*?</svg>)\s*```", text, re.DOTALL | re.IGNORECASE)
    if fence:
        return fence.group(1).strip()
    raw = re.search(r"<svg[\s>].*?</svg>", text, re.DOTALL | re.IGNORECASE)
    if raw:
        return raw.group(0).strip()
    return text.strip()


# ── Single frame: build prompt with style injection ───────────────────────────

def _generate_svg_code(
    frame: FramePlan,
    plan: GenerationPlan,
    prompt_template: str,
    frame_index: int = 0,
) -> str:
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

    split_idx = prompt_template.find("{{DIAGRAM_DESCRIPTION}}")
    cache_prefix = prompt_template[:split_idx] if split_idx != -1 else ""

    return call_llm(
        prompt, 8000,
        prompt_name=f"svg_prompt.md (frame {frame_index})",
        cache_prefix=cache_prefix,
    )


# ── Single frame: SVG → PNG via cairosvg ─────────────────────────────────────

def _render_frame(svg_text: str, frame_index: int, output_dir: str) -> tuple[Optional[str], Optional[str]]:
    frame_dir = os.path.join(output_dir, f"frame_{frame_index}")
    os.makedirs(frame_dir, exist_ok=True)

    svg_path = os.path.join(frame_dir, "frame.svg")
    png_path = os.path.join(frame_dir, "frame.png")

    clean_svg = _sanitize_svg(svg_text)
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(clean_svg)

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


# ── Single frame: correction retry prompt ────────────────────────────────────

def _generate_svg_code_retry(
    frame: FramePlan,
    plan: GenerationPlan,
    failure_reason: str,
    failed_svg: str = "",
) -> str:
    stroke = plan.shared_style.strokeColor
    bg     = plan.shared_style.backgroundColor

    svg_excerpt = ""
    if failed_svg:
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


# ── Animated rendering: timing + HTML builder ────────────────────────────────

def _compute_timings(reveal_order: list, animation_spec: dict, duration: float) -> dict:
    """Evenly space reveal times across the middle 80% of the frame duration."""
    animated = [
        k for k in reveal_order
        if animation_spec.get(k, {}).get("behavior", "enter") != "static"
    ]
    if not animated:
        return {}
    if len(animated) == 1:
        return {animated[0]: duration * 0.2}
    return {
        key: duration * (0.1 + 0.8 * i / (len(animated) - 1))
        for i, key in enumerate(animated)
    }


# JavaScript RAF animation engine — string template filled at render time.
# Uses {{}}-escaped braces for literal JS braces inside the format string.
_RAF_ENGINE_TEMPLATE = """\
(function() {{
  var ANIMATIONS   = {animations_json};
  var DURATION     = {duration};
  var LOOP_PERIODS = {{ fast: 0.65, medium: 1.0, slow: 1.55 }};
  var NUM_PARTICLES = 5;

  function easeBackOut(t) {{
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }}
  function clamp(v, lo, hi) {{ return Math.max(lo, Math.min(hi, v)); }}

  // Pre-show static entities and entities not mentioned in animation spec
  ANIMATIONS.forEach(function(a) {{
    var el = document.getElementById('ent-' + a.id);
    if (el && a.behavior === 'static') {{ el.style.opacity = '1'; }}
  }});
  document.querySelectorAll('[id^="ent-"]').forEach(function(el) {{
    var key = el.id.replace('ent-', '');
    if (!ANIMATIONS.find(function(a) {{ return a.id === key; }})) {{
      el.style.opacity = '1';
    }}
  }});

  // Build particle systems for loop entities
  var particleSystems = [];
  ANIMATIONS.filter(function(a) {{ return a.behavior === 'loop'; }})
    .forEach(function(anim) {{
      var pathEl = document.getElementById('flow-' + anim.id);
      if (!pathEl || typeof pathEl.getTotalLength !== 'function') return;

      var totalLen = pathEl.getTotalLength();
      var period   = LOOP_PERIODS[anim.speed] || 1.0;
      var color    = pathEl.getAttribute('stroke') || '#333333';
      var radius   = {{ fast: 4, medium: 5, slow: 6 }}[anim.speed] || 5;

      var circles = [];
      for (var i = 0; i < NUM_PARTICLES; i++) {{
        var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('r', String(radius));
        c.setAttribute('fill', color);
        c.setAttribute('opacity', '0');
        c._startOffset = i / NUM_PARTICLES;
        pathEl.parentNode.appendChild(c);
        circles.push(c);
      }}

      particleSystems.push({{
        key:      anim.id,
        pathEl:   pathEl,
        totalLen: totalLen,
        period:   period,
        circles:  circles,
        appearAt: anim.appearAt || 0,
      }});
    }});

  var startTime = null;

  function frame(ts) {{
    if (startTime === null) startTime = ts;
    var t = (ts - startTime) / 1000;

    // Enter animations: easeBackOut on opacity + scale over 0.45 s
    ANIMATIONS.filter(function(a) {{ return a.behavior === 'enter'; }})
      .forEach(function(anim) {{
        var el = document.getElementById('ent-' + anim.id);
        if (!el) return;
        var p = clamp((t - (anim.appearAt || 0)) / 0.45, 0, 1);
        var e = easeBackOut(p);
        el.style.opacity   = String(clamp(e, 0, 1));
        el.style.transform = 'scale(' + (0.82 + 0.18 * clamp(e, 0, 1)) + ')';
      }});

    // Loop: fade in group + move particles along flow path
    particleSystems.forEach(function(sys) {{
      var groupEl = document.getElementById('ent-' + sys.key);
      if (groupEl) {{
        var p = clamp((t - sys.appearAt) / 0.4, 0, 1);
        groupEl.style.opacity = String(p);
      }}
      if (t < sys.appearAt) return;
      sys.circles.forEach(function(c) {{
        var frac = ((t - sys.appearAt) / sys.period + c._startOffset) % 1;
        var pt   = sys.pathEl.getPointAtLength(frac * sys.totalLen);
        c.setAttribute('cx', String(pt.x));
        c.setAttribute('cy', String(pt.y));
        c.setAttribute('opacity', '1');
      }});
    }});

    requestAnimationFrame(frame);
  }}

  requestAnimationFrame(frame);
}})();
"""


def _build_animation_html(
    svg_text: str,
    reveal_order: list,
    animation_spec: dict,
    duration: float,
) -> str:
    timings = _compute_timings(reveal_order, animation_spec, duration)

    animations = []
    for key, spec in animation_spec.items():
        behavior = spec.get("behavior", "enter")
        animations.append({
            "id":       key,
            "behavior": behavior,
            "speed":    spec.get("speed") or spec.get("loop_speed") or "medium",
            "appearAt": timings.get(key, 0.0),
        })

    animations_json = json.dumps(animations)
    raf_engine = _RAF_ENGINE_TEMPLATE.format(
        animations_json=animations_json,
        duration=duration,
    )

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body {{ margin:0; padding:0; background:white; overflow:hidden; }}
  svg  {{ display:block; }}
  [id^="ent-"] {{ opacity:0; transform-origin:center center; }}
</style>
</head>
<body>
{svg_text}
<script>{raf_engine}</script>
</body></html>"""


# ── Playwright renderer ───────────────────────────────────────────────────────

async def _playwright_render(html: str, duration: float, tmp_dir: str, svg_text: str):
    from playwright.async_api import async_playwright

    height_match = re.search(r'viewBox=["\']0 0 \d+ (\d+)["\']', svg_text)
    svg_height   = int(height_match.group(1)) if height_match else 900

    ms_per_frame = round(1000 / FPS)
    total_frames = math.ceil(duration * FPS)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page    = await browser.new_page()
        await page.set_viewport_size({"width": 1200, "height": svg_height})
        await page.clock.install(time=0)
        await page.set_content(html, wait_until="domcontentloaded")

        for f in range(total_frames):
            await page.clock.run_for(ms_per_frame)
            fp = os.path.join(tmp_dir, f"f{f:05d}.png")
            await page.screenshot(path=fp, type="png")

        await browser.close()


def _get_ffmpeg_exe() -> str:
    """Return path to ffmpeg binary — prefers imageio-ffmpeg bundle, falls back to system PATH."""
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def _png_seq_to_mp4(tmp_dir: str, output_mp4: str):
    cmd = [
        _get_ffmpeg_exe(), "-y", "-hide_banner", "-loglevel", "error",
        "-framerate", str(FPS),
        "-i", os.path.join(tmp_dir, "f%05d.png"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast",
        output_mp4,
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode())


# ── Animated frame renderer (Playwright path) ─────────────────────────────────

async def _render_animated_frame(
    svg_text: str,
    reveal_order: list,
    animation_spec: dict,
    duration_seconds: float,
    frame_index: int,
    output_dir: str,
) -> tuple[Optional[str], Optional[str]]:
    """
    Render an animated SVG frame as an MP4 clip via Playwright.
    Falls back to cairosvg static PNG if Playwright is unavailable or fails.
    Returns (path, error_message).
    """
    from core.config import SVG_ANIMATION_ENABLED

    if not SVG_ANIMATION_ENABLED or not _PLAYWRIGHT_AVAILABLE:
        return _render_frame(svg_text, frame_index, output_dir)

    frame_dir = os.path.join(output_dir, f"frame_{frame_index}")
    os.makedirs(frame_dir, exist_ok=True)
    output_mp4 = os.path.join(frame_dir, "frame.mp4")
    tmp_dir    = os.path.join(frame_dir, "png_seq")
    os.makedirs(tmp_dir, exist_ok=True)

    # Also save SVG for debugging/reference
    svg_path = os.path.join(frame_dir, "frame.svg")
    clean_svg = _sanitize_svg(svg_text)
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(clean_svg)

    try:
        html = _build_animation_html(clean_svg, reveal_order, animation_spec, duration_seconds)
        await _playwright_render(html, duration_seconds, tmp_dir, clean_svg)
        _png_seq_to_mp4(tmp_dir, output_mp4)
        logger.info("svg_generator animated frame %d → %s (%.1fs)", frame_index, output_mp4, duration_seconds)
        return output_mp4, None
    except Exception as e:
        logger.warning(
            "svg_generator animated render failed (frame %d): %s — falling back to static PNG",
            frame_index, e,
        )
        return _render_frame(clean_svg, frame_index, output_dir)


# ── Single frame: orchestrate LLM + render ───────────────────────────────────

def _narration_to_duration(narration: str) -> float:
    """Estimate frame duration in seconds from narration word count."""
    words = len(narration.split()) if narration else 0
    from core.config import TTS_WORDS_PER_SECOND
    seconds = words / TTS_WORDS_PER_SECOND
    # Minimum 4 s, maximum 30 s per frame
    return max(4.0, min(30.0, seconds))


async def _generate_one_svg_frame(
    frame: FramePlan,
    frame_index: int,
    plan: GenerationPlan,
    prompt_template: str,
    output_dir: str,
) -> Optional[str]:
    """
    Generate and render one SVG frame. Returns absolute path (PNG or MP4) or None.

    Runs the synchronous LLM call and render in threads so the event loop is
    never blocked.

    On failure (bad extraction OR render crash) a single corrective retry is
    attempted with the specific error included in the prompt.
    """
    raw = await asyncio.to_thread(_generate_svg_code, frame, plan, prompt_template, frame_index)
    svg_text = _extract_svg(raw)

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

    # Decide render path
    from core.config import SVG_ANIMATION_ENABLED
    use_animation = SVG_ANIMATION_ENABLED and _PLAYWRIGHT_AVAILABLE

    if use_animation:
        duration  = _narration_to_duration(frame.narration)
        out_path, render_error = await _render_animated_frame(
            svg_text,
            frame.reveal_order,
            frame.animation_spec,
            duration,
            frame_index,
            output_dir,
        )
    else:
        out_path, render_error = await asyncio.to_thread(
            _render_frame, svg_text, frame_index, output_dir
        )

    if out_path is None:
        logger.warning("svg_generator frame %d: render failed — retrying with correction", frame_index)
        raw = await asyncio.to_thread(
            _generate_svg_code_retry, frame, plan,
            failure_reason=(
                f"The renderer failed to process your SVG. Error: {render_error}. "
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

        if use_animation:
            duration = _narration_to_duration(frame.narration)
            out_path, _ = await _render_animated_frame(
                svg_text, frame.reveal_order, frame.animation_spec,
                duration, frame_index, output_dir,
            )
        else:
            out_path, _ = await asyncio.to_thread(
                _render_frame, svg_text, frame_index, output_dir
            )

    return out_path


# ── All frames in parallel ────────────────────────────────────────────────────

async def generate_svg_frames(
    plan: GenerationPlan,
    prompt_template: str,
    output_dir: str,
    frame_narrations: list[str] = None,
) -> list[Optional[str]]:
    """
    Generate one frame file (PNG or MP4) per frame using SVG.

    Two-phase to maximise Anthropic prompt cache hits:
      Phase 1 — fire frame 0 alone and await it. This writes the cache entry
                 for the 36KB static prompt template (cache_write at 1.25×).
      Phase 2 — fire remaining frames in parallel. They all hit cache_read
                 (0.1× input token rate) instead of paying cache_write again.
    Trade-off: ~10s sequential latency on frame 0 vs ~$0.12 saved per video.

    frame_narrations: optional per-frame narration strings used to estimate
        animation duration. Falls back to a default duration if not provided.

    Returns a list of absolute paths (None = failed frame).
    """
    if not plan.frames:
        return []

    # Inject narration into FramePlan.narration if not already set by planner
    if frame_narrations:
        for i, frame in enumerate(plan.frames):
            if i < len(frame_narrations) and not frame.narration:
                frame.narration = frame_narrations[i]

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
