import asyncio, json, re, logging
from datetime import datetime
from pathlib import Path
from openai import OpenAI

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(Path(__file__).parent / "run.log", mode="w", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

# ── CONFIG ────────────────────────────────────────────────────────────────────
PROMPT    = "explain how photosynthesis works using illustrations"
API_KEY   = "OPENAI_KEY_REMOVED"
MODEL     = "gpt-4.1"
# ─────────────────────────────────────────────────────────────────────────────

_HERE        = Path(__file__).parent
_PROMPTS_DIR = _HERE / "prompts"
_OUTPUT_ROOT = _HERE / "output"

client = OpenAI(api_key=API_KEY)


def call_llm(prompt: str, max_tokens: int = 8192) -> str:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


def _extract_json(text: str) -> dict:
    decoder = json.JSONDecoder()
    fence = re.search(r"```(?:json)?\s*(\{.*?)\s*```", text, re.DOTALL)
    if fence:
        try:
            obj, _ = decoder.raw_decode(fence.group(1).strip())
            return obj
        except json.JSONDecodeError:
            pass
    start = text.find("{")
    obj, _ = decoder.raw_decode(text, start)
    return obj


# ── Stage 1A: vocab plan ──────────────────────────────────────────────────────

async def run_vocab_plan() -> dict:
    template = (_PROMPTS_DIR / "planning_vocab.md").read_text(encoding="utf-8")
    prompt = template.replace("{{USER_PROMPT}}", PROMPT).replace("{{CONVERSATION_CONTEXT}}", "")
    print("[1/2] Planning...", flush=True)
    raw = await asyncio.to_thread(call_llm, prompt, 8192)
    return _extract_json(raw)


# ── Bridge: vocab → frame descriptions (no LLM) ──────────────────────────────

def _build_frame_descriptions(plan: dict) -> list[dict]:
    style  = plan.get("shared_style", {})
    stroke = style.get("strokeColor", "#1e1e1e")
    bg     = style.get("backgroundColor", "#a5d8ff")
    vocab  = plan.get("element_vocabulary", {})

    style_note = (
        f'\n\nStyle: stroke="{stroke}" on all outlines, fill="{bg}" for key shapes, '
        f'canvas background always fill="white", font-family="Arial, Helvetica, sans-serif".'
    )

    vocab_note = ""
    if vocab:
        lines = []
        for k, v in vocab.items():
            parts = []
            if isinstance(v, dict):
                if "entity_type" in v: parts.append(f'type={v["entity_type"]}')
                if "visual"      in v: parts.append(f'visual="{v["visual"]}"')
                if "fill"        in v: parts.append(f'fill={v["fill"]}')
                if "label"       in v: parts.append(f'label=\'{v["label"]}\'')
            lines.append(f'  - "{k}": {", ".join(parts)}')
        vocab_note = "\n\nElement vocabulary:\n" + "\n".join(lines)

    frames = []
    for f in plan["frames"]:
        description = (
            f"{f.get('teaching_intent', '')}\n"
            f"Entities: {', '.join(f.get('entities_used', []))}\n"
            f"Narration: {f.get('narration', '')}"
            + style_note + vocab_note
        )
        frames.append({"index": f.get("index", 0), "description": description, "caption": f.get("caption", "")})
    return frames


# ── SVG helpers ───────────────────────────────────────────────────────────────

_STRIP_EMPTY = re.compile(
    r'\b(stroke-dasharray|marker-end|marker-start|marker-mid|stroke-dashoffset'
    r'|stroke-miterlimit|clip-path|filter|mask|xlink:href|href)\s*=\s*""',
    re.IGNORECASE,
)
_BARE_AMP     = re.compile(r'&(?!(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)')
_CTRL_CHARS   = re.compile(r'[\x00-\x08\x0B\x0C\x0E-\x1F]')


def _sanitize(svg: str) -> str:
    svg = _CTRL_CHARS.sub("", svg)
    svg = _STRIP_EMPTY.sub("", svg)
    svg = _BARE_AMP.sub("&amp;", svg)
    # Escape bare < > inside text nodes
    svg = re.sub(r'(?<=>)([^<]+)(?=<)', lambda m: m.group(0).replace('<', '&lt;').replace('>', '&gt;'), svg)
    return svg


def _extract_svg(text: str) -> str:
    fence = re.search(r"```(?:svg|xml)?\s*(<svg[\s>].*?</svg>)\s*```", text, re.DOTALL | re.IGNORECASE)
    if fence:
        return fence.group(1).strip()
    raw = re.search(r"<svg[\s>].*?</svg>", text, re.DOTALL | re.IGNORECASE)
    return raw.group(0).strip() if raw else text.strip()


def _render(svg_text: str, frame_index: int, run_dir: Path) -> tuple:
    import cairosvg
    frame_dir = run_dir / f"frame_{frame_index}"
    frame_dir.mkdir(parents=True, exist_ok=True)
    svg_path = frame_dir / "frame.svg"
    png_path = frame_dir / "frame.png"
    clean = _sanitize(svg_text)
    svg_path.write_text(clean, encoding="utf-8")
    h = int(m.group(1)) if (m := re.search(r'viewBox=["\']0 0 \d+ (\d+)["\']', clean)) else 900
    try:
        cairosvg.svg2png(url=str(svg_path), write_to=str(png_path), output_width=1200, output_height=h)
        return str(png_path), None
    except Exception as e:
        log.error("cairosvg render error frame %d: %s", frame_index, e, exc_info=True)
        return None, str(e)


# ── Stage 2: one frame (LLM → SVG → PNG, one retry on failure) ───────────────

async def _generate_one_frame(frame: dict, svg_template: str, run_dir: Path) -> str | None:
    idx    = frame["index"]
    prompt = svg_template.replace("{{DIAGRAM_DESCRIPTION}}", frame["description"])

    try:
        raw = await asyncio.to_thread(call_llm, prompt)
    except Exception as e:
        log.error("frame %d: LLM call failed: %s", idx, e, exc_info=True)
        return None

    log.debug("frame %d: LLM response (first 300 chars): %s", idx, raw[:300])
    svg = _extract_svg(raw)

    if not svg.lower().startswith("<svg"):
        log.warning("frame %d: no valid SVG in response — retrying. Got: %s", idx, raw[:300])
        try:
            raw = await asyncio.to_thread(call_llm,
                f"Your response had no valid SVG. Output ONLY raw SVG starting with <svg.\n\n{frame['description']}")
        except Exception as e:
            log.error("frame %d: retry LLM call failed: %s", idx, e, exc_info=True)
            return None
        svg = _extract_svg(raw)
        if not svg.lower().startswith("<svg"):
            log.error("frame %d: retry also produced no valid SVG. Response: %s", idx, raw[:300])
            return None

    png, err = await asyncio.to_thread(_render, svg, idx, run_dir)

    if png is None:
        log.warning("frame %d: render error: %s — retrying", idx, err)
        try:
            raw = await asyncio.to_thread(call_llm,
                f"Your SVG failed to render: {err}\nUse only flat fills and standard SVG primitives.\n\n{frame['description']}")
        except Exception as e:
            log.error("frame %d: retry LLM call failed: %s", idx, e, exc_info=True)
            return None
        svg = _extract_svg(raw)
        if not svg.lower().startswith("<svg"):
            log.error("frame %d: retry produced no valid SVG", idx)
            return None
        png, err2 = await asyncio.to_thread(_render, svg, idx, run_dir)
        if png is None:
            log.error("frame %d: render failed again: %s", idx, err2)

    return png


# ── Stage 2: all frames in parallel ──────────────────────────────────────────

async def run_svg_frames(frames: list[dict], run_dir: Path) -> list:
    svg_template = (_PROMPTS_DIR / "svg_prompt.md").read_text(encoding="utf-8")
    print(f"[2/2] Generating {len(frames)} frame(s)...", flush=True)
    results = await asyncio.gather(*[_generate_one_frame(f, svg_template, run_dir) for f in frames], return_exceptions=True)
    paths = []
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            log.error("frame %d: unhandled exception: %s", i, r, exc_info=r)
            paths.append(None)
        else:
            paths.append(r)
    return paths


# ── Pipeline entry point (importable by improve.py) ──────────────────────────

async def run_pipeline(prompt: str, run_dir: Path | None = None) -> dict:
    """
    Run the full pipeline for one prompt.
    Returns dict with: png_paths, retry_flags, svg_texts, frame_descriptions, plan
    Importable by improve.py for the autoresearch loop.
    """
    if run_dir is None:
        run_dir = _OUTPUT_ROOT / datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir.mkdir(parents=True, exist_ok=True)

    plan   = await run_vocab_plan_with_prompt(prompt)
    frames = _build_frame_descriptions(plan)

    # Track retry flags and svg texts alongside png paths
    svg_template  = (_PROMPTS_DIR / "svg_prompt.md").read_text(encoding="utf-8")
    png_paths     = []
    retry_flags   = []   # True if frame needed a retry
    svg_texts     = []   # raw SVG string per frame (for text-based judge fallback)
    descriptions  = [f["description"] for f in frames]

    results = await asyncio.gather(
        *[_generate_one_frame_tracked(f, svg_template, run_dir) for f in frames],
        return_exceptions=True,
    )
    for r in results:
        if isinstance(r, Exception):
            png_paths.append(None)
            retry_flags.append(False)
            svg_texts.append("")
        else:
            png_paths.append(r["png"])
            retry_flags.append(r["retried"])
            svg_texts.append(r["svg"])

    return {
        "png_paths":    png_paths,
        "retry_flags":  retry_flags,
        "svg_texts":    svg_texts,
        "descriptions": descriptions,
        "plan":         plan,
        "run_dir":      str(run_dir),
    }


async def _generate_one_frame_tracked(frame: dict, svg_template: str, run_dir: Path) -> dict:
    """Like _generate_one_frame but returns {png, retried, svg} for scoring."""
    idx    = frame["index"]
    prompt = svg_template.replace("{{DIAGRAM_DESCRIPTION}}", frame["description"])
    retried = False

    try:
        raw = await asyncio.to_thread(call_llm, prompt)
    except Exception as e:
        log.error("frame %d: LLM call failed: %s", idx, e, exc_info=True)
        return {"png": None, "retried": False, "svg": ""}

    log.debug("frame %d: LLM response (first 300 chars): %s", idx, raw[:300])
    svg = _extract_svg(raw)

    if not svg.lower().startswith("<svg"):
        retried = True
        log.warning("frame %d: no valid SVG — retrying", idx)
        try:
            raw = await asyncio.to_thread(call_llm,
                f"Your response had no valid SVG. Output ONLY raw SVG starting with <svg.\n\n{frame['description']}")
        except Exception as e:
            log.error("frame %d: retry LLM call failed: %s", idx, e, exc_info=True)
            return {"png": None, "retried": retried, "svg": ""}
        svg = _extract_svg(raw)
        if not svg.lower().startswith("<svg"):
            log.error("frame %d: retry also produced no valid SVG", idx)
            return {"png": None, "retried": retried, "svg": ""}

    png, err = await asyncio.to_thread(_render, svg, idx, run_dir)

    if png is None:
        retried = True
        log.warning("frame %d: render error (%s) — retrying", idx, err)
        try:
            raw = await asyncio.to_thread(call_llm,
                f"Your SVG failed to render: {err}\nUse only flat fills and standard SVG primitives.\n\n{frame['description']}")
        except Exception as e:
            log.error("frame %d: retry LLM call failed: %s", idx, e, exc_info=True)
            return {"png": None, "retried": retried, "svg": svg}
        svg = _extract_svg(raw)
        if not svg.lower().startswith("<svg"):
            return {"png": None, "retried": retried, "svg": ""}
        png, _ = await asyncio.to_thread(_render, svg, idx, run_dir)

    return {"png": png, "retried": retried, "svg": svg}


async def run_vocab_plan_with_prompt(prompt: str) -> dict:
    """run_vocab_plan but accepts prompt as argument (for improve.py)."""
    template = (_PROMPTS_DIR / "planning_vocab.md").read_text(encoding="utf-8")
    p = template.replace("{{USER_PROMPT}}", prompt).replace("{{CONVERSATION_CONTEXT}}", "")
    print(f"  [1/2] Planning: {prompt[:60]}...", flush=True)
    raw = await asyncio.to_thread(call_llm, p, 8192)
    return _extract_json(raw)


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    run_dir = _OUTPUT_ROOT / datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir.mkdir(parents=True, exist_ok=True)

    result = await run_pipeline(PROMPT, run_dir)

    print("\nDone.")
    for i, p in enumerate(result["png_paths"]):
        print(f"  frame {i}: {p or 'FAILED'}")
    print(f"\nOutput: {run_dir}")


if __name__ == "__main__":
    asyncio.run(main())
