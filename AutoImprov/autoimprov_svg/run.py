import asyncio, json, re, logging, os
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(Path(__file__).parent / "run.log", mode="w", encoding="utf-8"),
    ],
)
# Suppress httpx/openai transport noise (HTTP headers, base64 bodies)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)
log = logging.getLogger(__name__)

# ── CONFIG ────────────────────────────────────────────────────────────────────
PROMPT    = "explain how photosynthesis works using illustrations"
API_KEY   = os.environ["OPENAI_API_KEY"]
MODEL     = "gpt-4.1"
# ─────────────────────────────────────────────────────────────────────────────

_HERE        = Path(__file__).parent
_PROMPTS_DIR = _HERE / "prompts"
_OUTPUT_ROOT = _HERE / "output"

client = OpenAI(api_key=API_KEY)

# Serialize all LLM calls — prevents 429s on 30k TPM accounts
_LLM_SEM = asyncio.Semaphore(1)


def call_llm(prompt: str, max_tokens: int = 8192) -> str:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


async def _call_llm_async(prompt: str, max_tokens: int = 8192, label: str = "") -> str:
    """Throttled async wrapper — only 1 LLM call in flight at a time."""
    async with _LLM_SEM:
        if label:
            print(f"  → LLM call: {label}", flush=True)
        result = await asyncio.to_thread(call_llm, prompt, max_tokens)
        if label:
            print(f"  ✓ done: {label} ({len(result)} chars)", flush=True)
        return result


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


# ── Stage 1A: classify intent ────────────────────────────────────────────────

async def run_classify(prompt: str) -> tuple[str, int]:
    """Call planning_classify.md → intent_type, frame_count."""
    template = (_PROMPTS_DIR / "planning_classify.md").read_text(encoding="utf-8")
    p = (template
         .replace("{{USER_PROMPT}}", prompt)
         .replace("{{CONVERSATION_CONTEXT}}", ""))
    raw = await _call_llm_async(p, 512, label="planning_classify")
    data = _extract_json(raw)
    intent_type = data.get("intent_type", "illustration")
    frame_count = max(2, min(8, int(data.get("frame_count", 3))))
    return intent_type, frame_count


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


# ── Text collision resolver ───────────────────────────────────────────────────

_SVG_NS   = "http://www.w3.org/2000/svg"
_XLINK_NS = "http://www.w3.org/1999/xlink"


def _text_bbox(elem: ET.Element) -> dict:
    """Estimate the visual bounding box of a <text> SVG element."""
    x = float(elem.get("x", 0) or 0)
    y = float(elem.get("y", 0) or 0)   # SVG y = baseline

    font_size = 18.0
    fs = elem.get("font-size", "")
    if fs:
        try:
            font_size = float(re.sub(r"[^\d.]", "", fs))
        except ValueError:
            pass
    m = re.search(r"font-size\s*:\s*([\d.]+)", elem.get("style", ""))
    if m:
        font_size = float(m.group(1))

    text    = "".join(elem.itertext()).strip()
    width   = len(text) * font_size * 0.55

    anchor = elem.get("text-anchor", elem.get("textAnchor", "start"))
    if anchor == "middle":
        x -= width / 2
    elif anchor == "end":
        x -= width

    # top/bot relative to canvas (y is baseline)
    top = y - font_size * 0.85
    bot = y + font_size * 0.25

    return {"elem": elem, "x": x, "w": width, "top": top, "bot": bot}


def _boxes_overlap(a: dict, b: dict, pad: int = 4) -> bool:
    h = a["x"] < b["x"] + b["w"] + pad and b["x"] < a["x"] + a["w"] + pad
    v = a["top"] < b["bot"] + pad       and b["top"] < a["bot"] + pad
    return h and v


def resolve_text_collisions(svg: str) -> str:
    """
    Detect overlapping <text> elements and push the lower one down
    until all pairs are clear. Expands canvas height if needed.
    Falls back silently on any parse error.
    """
    ET.register_namespace("",      _SVG_NS)
    ET.register_namespace("xlink", _XLINK_NS)
    try:
        root = ET.fromstring(svg)
    except ET.ParseError as e:
        log.warning("resolve_text_collisions: parse error — %s", e)
        return svg

    # Support both namespaced (<svg:text>) and plain (<text>) tags
    tag = f"{{{_SVG_NS}}}text"
    texts = list(root.iter(tag))
    if not texts:
        texts = list(root.iter("text"))

    if len(texts) < 2:
        return svg

    boxes   = [_text_bbox(t) for t in texts]
    changed = False

    for _ in range(10):   # max 10 passes — enough for dense diagrams
        hit = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                if _boxes_overlap(boxes[i], boxes[j]):
                    hit = True
                    changed = True
                    # Move the lower element down by the overlap + 8 px gap
                    if boxes[i]["top"] >= boxes[j]["top"]:
                        lower, upper = boxes[i], boxes[j]
                    else:
                        lower, upper = boxes[j], boxes[i]
                    shift = upper["bot"] - lower["top"] + 8
                    new_y = float(lower["elem"].get("y", 0)) + shift
                    lower["elem"].set("y", str(round(new_y, 1)))
                    lower["top"] += shift
                    lower["bot"] += shift
        if not hit:
            break

    if not changed:
        return svg

    # Grow canvas height if any label was pushed below the original bottom
    try:
        max_bot = max(b["bot"] for b in boxes) + 60
        old_h   = float(re.sub(r"[^\d.]", "", root.get("height", "0") or "0"))
        if max_bot > old_h:
            new_h = str(int(max_bot))
            root.set("height", new_h)
            vb = root.get("viewBox", "")
            if vb:
                root.set("viewBox", re.sub(r"\d+\s*$", new_h, vb.strip()))
    except Exception:
        pass

    return ET.tostring(root, encoding="unicode")


def _render(svg_text: str, frame_index: int, run_dir: Path) -> tuple:
    import cairosvg
    frame_dir = run_dir / f"frame_{frame_index}"
    frame_dir.mkdir(parents=True, exist_ok=True)
    svg_path     = frame_dir / "frame.svg"
    svg_raw_path = frame_dir / "frame_raw.svg"   # pre-fix, for comparison
    png_path = frame_dir / "frame.png"
    clean = _sanitize(svg_text)
    svg_raw_path.write_text(clean, encoding="utf-8")  # save before collision fix
    clean = resolve_text_collisions(clean)
    svg_path.write_text(clean, encoding="utf-8")
    h = int(m.group(1)) if (m := re.search(r'viewBox=["\']0 0 \d+ (\d+)["\']', clean)) else 900
    try:
        cairosvg.svg2png(url=str(svg_path), write_to=str(png_path), output_width=1200, output_height=h)
        return str(png_path), None
    except Exception as e:
        log.error("cairosvg render error frame %d: %s", frame_index, e, exc_info=True)
        return None, str(e)



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
            print(f"  ✗ frame task raised: {r}", flush=True)
            log.error("frame task raised unhandled exception: %s", r, exc_info=r)
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

    print(f"  [svg frame {idx}] generating...", flush=True)
    try:
        raw = await _call_llm_async(prompt, label=f"svg_prompt frame={idx}")
    except Exception as e:
        log.error("frame %d: LLM call failed: %s", idx, e, exc_info=True)
        return {"png": None, "retried": False, "svg": ""}

    svg = _extract_svg(raw)

    if not svg.lower().startswith("<svg"):
        retried = True
        print(f"  [svg frame {idx}] no valid SVG — retrying", flush=True)
        try:
            raw = await _call_llm_async(
                f"Your response had no valid SVG. Output ONLY raw SVG starting with <svg.\n\n{frame['description']}",
                label=f"svg_prompt frame={idx} retry")
        except Exception as e:
            log.error("frame %d: retry LLM call failed: %s", idx, e, exc_info=True)
            return {"png": None, "retried": retried, "svg": ""}
        svg = _extract_svg(raw)
        if not svg.lower().startswith("<svg"):
            log.error("frame %d: retry also produced no valid SVG", idx)
            return {"png": None, "retried": retried, "svg": ""}

    print(f"  [svg frame {idx}] rendering...", flush=True)
    try:
        png, err = await asyncio.to_thread(_render, svg, idx, run_dir)
    except Exception as e:
        print(f"  [svg frame {idx}] render crashed: {e}", flush=True)
        log.error("frame %d: render raised exception: %s", idx, e, exc_info=True)
        return {"png": None, "retried": retried, "svg": svg}

    if png is None:
        retried = True
        print(f"  [svg frame {idx}] render failed ({err}) — retrying", flush=True)
        try:
            raw = await _call_llm_async(
                f"Your SVG failed to render: {err}\nUse only flat fills and standard SVG primitives.\n\n{frame['description']}",
                label=f"svg_prompt frame={idx} render-retry")
        except Exception as e:
            log.error("frame %d: retry LLM call failed: %s", idx, e, exc_info=True)
            return {"png": None, "retried": retried, "svg": svg}
        svg = _extract_svg(raw)
        if not svg.lower().startswith("<svg"):
            return {"png": None, "retried": retried, "svg": ""}
        try:
            png, _ = await asyncio.to_thread(_render, svg, idx, run_dir)
        except Exception as e:
            print(f"  [svg frame {idx}] render crashed on retry: {e}", flush=True)
            log.error("frame %d: render raised exception on retry: %s", idx, e, exc_info=True)
            return {"png": None, "retried": retried, "svg": svg}

    if png:
        print(f"  [svg frame {idx}] ✓ saved {png}", flush=True)
    else:
        print(f"  [svg frame {idx}] ✗ failed after retry", flush=True)

    return {"png": png, "retried": retried, "svg": svg}


async def run_vocab_plan_with_prompt(prompt: str) -> dict:
    """Two-step classify → planning_svg pipeline (called by improve.py)."""
    intent_type, frame_count = await run_classify(prompt)
    template = (_PROMPTS_DIR / "planning_svg.md").read_text(encoding="utf-8")
    p = (template
         .replace("{{USER_PROMPT}}", prompt)
         .replace("{{CONVERSATION_CONTEXT}}", "")
         .replace("{{INTENT_TYPE}}", intent_type)
         .replace("{{FRAME_COUNT}}", str(frame_count)))
    print(f"  [planning_svg] intent={intent_type}  frames={frame_count}  prompt: {prompt[:50]}...", flush=True)
    raw = await _call_llm_async(p, 8192, label="planning_svg")
    plan = _extract_json(raw)
    plan["intent_type"] = intent_type
    plan["frame_count"] = frame_count
    return plan


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
