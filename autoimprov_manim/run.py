import asyncio, json, re, logging, os, subprocess, sys
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
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)
log = logging.getLogger(__name__)

# ── CONFIG ────────────────────────────────────────────────────────────────────
PROMPT  = "explain gradient descent visually using a loss surface"
API_KEY = os.environ["OPENAI_API_KEY"]
MODEL   = "gpt-4.1"
# Manim binary — use backend env which has manim installed
_MANIM_BIN = Path(__file__).parent.parent / "backend" / "env" / "bin" / "manim"
MANIM_CMD  = str(_MANIM_BIN) if _MANIM_BIN.exists() else "manim"
# ─────────────────────────────────────────────────────────────────────────────

_HERE        = Path(__file__).parent
_PROMPTS_DIR = _HERE / "prompts"
_OUTPUT_ROOT = _HERE / "output"

client   = OpenAI(api_key=API_KEY)
_LLM_SEM = asyncio.Semaphore(1)


def call_llm(prompt: str, max_tokens: int = 8192) -> str:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


async def _call_llm_async(prompt: str, max_tokens: int = 8192, label: str = "") -> str:
    """Throttled async wrapper — 1 LLM call in flight at a time."""
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


def _extract_code(text: str) -> str:
    """Strip markdown fences, return raw Python."""
    fence = re.search(r"```(?:python)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        return fence.group(1).strip()
    return text.strip()


# ── Stage 1A: classify ────────────────────────────────────────────────────────

async def run_classify(prompt: str) -> tuple[str, int]:
    """planning_classify.md → (intent_type, frame_count). Defaults to 'math'."""
    template = (_PROMPTS_DIR / "planning_classify.md").read_text(encoding="utf-8")
    p = (template
         .replace("{{USER_PROMPT}}", prompt)
         .replace("{{CONVERSATION_CONTEXT}}", ""))
    raw = await _call_llm_async(p, 512, label="planning_classify")
    data = _extract_json(raw)
    intent_type = data.get("intent_type", "math")
    frame_count = max(2, min(5, int(data.get("frame_count", 3))))
    return intent_type, frame_count


# ── Stage 1B: math plan ───────────────────────────────────────────────────────

async def run_math_plan_with_prompt(prompt: str) -> dict:
    """Two-step classify → planning_math pipeline."""
    intent_type, frame_count = await run_classify(prompt)
    template = (_PROMPTS_DIR / "planning_math.md").read_text(encoding="utf-8")
    p = (template
         .replace("{{USER_PROMPT}}", prompt)
         .replace("{{CONVERSATION_CONTEXT}}", "")
         .replace("{{INTENT_TYPE}}", intent_type)
         .replace("{{FRAME_COUNT}}", str(frame_count))
         .replace("{{VISUAL_STRATEGY}}", ""))    # planner fills this in
    print(f"  [planning_math] intent={intent_type}  frames={frame_count}  prompt: {prompt[:50]}...", flush=True)
    raw = await _call_llm_async(p, 8192, label="planning_math")
    plan = _extract_json(raw)
    plan["intent_type"] = intent_type
    plan["frame_count"] = frame_count
    return plan


# ── Bridge: plan → frame context strings ─────────────────────────────────────

def _build_frame_contexts(plan: dict) -> list[dict]:
    """
    Build the DIAGRAM_DESCRIPTION string for each frame — mirrors the backend's
    _generate_manim_code() context block.
    """
    all_captions   = [f.get("caption", "") for f in plan.get("frames", [])]
    visual_strategy = plan.get("visual_strategy", "")
    continuity     = plan.get("continuity_plan", {})
    visual_objects = plan.get("visual_objects", [])
    primary_color  = plan.get("shared_style", {}).get("strokeColor", "#1971c2")

    frames = []
    for f in plan.get("frames", []):
        idx = f.get("index", 0)

        # Persistent objects visible this frame
        persistent = [
            obj for obj in visual_objects
            if idx in (obj.get("persists_frames") or [])
        ]
        continuity_block = ""
        if persistent:
            lines = "\n".join(
                f'  - {o["id"]} ({o.get("type","")}): {o.get("description","")} '
                f'[color: {o.get("style", {}).get("color", "WHITE")}]'
                for o in persistent
            )
            continuity_block = f"\nPersistent visual objects on screen this frame:\n{lines}\n"

        transition_block = ""
        if continuity.get("transition_strategy"):
            transition_block = f"Continuity strategy: {continuity['transition_strategy']}\n"

        strategy_block = f"Visual strategy: {visual_strategy}\n" if visual_strategy else ""

        description = (
            f"Frame {idx + 1} of {plan['frame_count']}: \"{f.get('caption', '')}\"\n"
            f"Lesson outline: {' → '.join(all_captions)}\n"
            f"{strategy_block}"
            f"{transition_block}"
            f"{continuity_block}\n"
            f"{f.get('teaching_intent', '')}\n"
            f"Narration: {f.get('narration', '')}"
        )
        frames.append({
            "index":         idx,
            "description":   description,
            "caption":       f.get("caption", ""),
            "primary_color": primary_color,
        })
    return frames


# ── Manim code sanitizer ──────────────────────────────────────────────────────

def _sanitize_manim_code(code: str) -> tuple[str, list]:
    """Auto-fix common LLM mistakes before rendering."""
    fixes = []

    for pattern in [
        re.compile(r',?\s*["\']?numbers_to_include["\']?\s*:\s*\[[^\]]*\]', re.DOTALL),
        re.compile(r',?\s*numbers_to_include\s*=\s*\[[^\]]*\]', re.DOTALL),
    ]:
        if pattern.search(code):
            code = pattern.sub("", code)
            fixes.append("removed numbers_to_include")

    bare_opacity = re.compile(r'(?<![a-zA-Z_])opacity\s*=\s*([0-9.]+)')
    if bare_opacity.search(code):
        code = bare_opacity.sub(r'fill_opacity=\1', code)
        fixes.append("fixed bare opacity= → fill_opacity=")

    if 'background_color' not in code and 'def construct' in code:
        code = code.replace(
            'def construct(self):',
            'def construct(self):\n        self.camera.background_color = "#1e1e2e"',
            1,
        )
        fixes.append("added missing background_color")

    return code, fixes


def _has_latex(code: str) -> bool:
    return bool(re.search(r'\b(MathTex|SingleStringMathTex)\s*\(', code))


def _classify_error(stderr: str) -> str:
    if "VMobjectFromSVGPath" in stderr and "has no attribute" in stderr:
        return "svg_path_attr"
    if "MathTex" in stderr or "latex" in stderr.lower():
        return "latex"
    if "AttributeError" in stderr:
        return "attr_error"
    if "TypeError" in stderr:
        return "type_error"
    return "unknown"


_RETRY_HINTS = {
    "latex": (
        "⚠️ RETRY — used MathTex/Tex (LaTeX not installed). "
        "Use ONLY Text() with Unicode: ², √, π, ∂, Σ, ±, ×, →\n\n"
    ),
    "svg_path_attr": (
        "⚠️ RETRY — indexed into a Text object and called .text on a glyph. "
        "NEVER index Text objects. Treat every Text(...) as one atomic unit.\n\n"
    ),
    "attr_error": (
        "⚠️ RETRY — used an attribute that doesn't exist on a Manim object. "
        "Only use: .move_to(), .next_to(), .shift(), .to_edge(), .animate, .set_color(), .set_opacity(), .scale()\n\n"
    ),
    "type_error": (
        "⚠️ RETRY — wrong argument type. "
        "Use fill_opacity= or stroke_opacity= (never opacity=). Colors must be Manim constants.\n\n"
    ),
    "unknown": (
        "⚠️ RETRY — failed to render. Generate simpler, safer code. "
        "Stick to Text(), Rectangle(), Circle(), Arrow(), Axes(), VGroup().\n\n"
    ),
}


# ── Render: Manim code → mp4 + thumbnail png ─────────────────────────────────

def _render_frame(code: str, frame_index: int, run_dir: Path) -> tuple[str | None, str | None, str]:
    """
    Write code to disk, run manim with --save_last_frame (produces both mp4 and png).
    Returns (mp4_path_or_None, png_path_or_None, stderr).
    """
    frame_dir = run_dir / f"frame_{frame_index}"
    frame_dir.mkdir(parents=True, exist_ok=True)

    scene_file = frame_dir / "scene.py"
    scene_file.write_text(code, encoding="utf-8")
    (frame_dir / "scene_raw.py").write_text(code, encoding="utf-8")   # pre-sanitize copy

    media_dir = frame_dir / "media"

    cmd = [
        MANIM_CMD, "render",
        "-ql",                    # low quality — fast iteration
        "--save_last_frame",      # also writes a PNG thumbnail → used by the judge
        "--media_dir", str(media_dir),
        str(scene_file),
        "GeneratedScene",
    ]

    print(f"  [manim frame {frame_index}] rendering (low quality)...", flush=True)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        log.error("frame %d: manim timed out", frame_index)
        return None, None, "TimeoutExpired"
    except FileNotFoundError:
        log.error("manim CLI not found at %s", MANIM_CMD)
        return None, None, "FileNotFoundError: manim CLI missing"

    if result.returncode != 0:
        log.error("frame %d render failed:\n%s", frame_index, result.stderr[-600:])
        return None, None, result.stderr

    mp4s = list(media_dir.rglob("*.mp4"))
    pngs = list(media_dir.rglob("*.png"))

    mp4  = str(max(mp4s, key=lambda p: p.stat().st_mtime)) if mp4s else None
    png  = str(max(pngs, key=lambda p: p.stat().st_mtime)) if pngs else None

    if mp4:
        print(f"  [manim frame {frame_index}] ✓ mp4={Path(mp4).name}  png={Path(png).name if png else 'none'}", flush=True)
    return mp4, png, ""


# ── Stage 2: one frame tracked ───────────────────────────────────────────────

async def _generate_one_frame_tracked(frame: dict, manim_template: str, run_dir: Path) -> dict:
    """LLM → Manim code → render → returns {mp4, png, retried, code}."""
    idx           = frame["index"]
    primary_color = frame.get("primary_color", "#1971c2")

    prompt = (manim_template
              .replace("{{DIAGRAM_DESCRIPTION}}", frame["description"])
              .replace("{{PRIMARY_COLOR}}", primary_color))

    print(f"  [manim frame {idx}] generating code...", flush=True)
    try:
        raw = await _call_llm_async(prompt, label=f"manim_prompt frame={idx}")
    except Exception as e:
        log.error("frame %d: LLM call failed: %s", idx, e)
        return {"mp4": None, "png": None, "retried": False, "code": ""}

    code = _extract_code(raw)
    code, fixes = _sanitize_manim_code(code)
    if fixes:
        log.info("frame %d: sanitizer applied: %s", idx, fixes)

    # Retry immediately if LaTeX detected (will always crash)
    if _has_latex(code):
        print(f"  [manim frame {idx}] LaTeX detected — retrying", flush=True)
        retry_prompt = _RETRY_HINTS["latex"] + prompt
        try:
            raw = await _call_llm_async(retry_prompt, label=f"manim_prompt frame={idx} latex-retry")
        except Exception as e:
            log.error("frame %d: latex retry LLM failed: %s", idx, e)
            return {"mp4": None, "png": None, "retried": True, "code": code}
        code = _extract_code(raw)
        code, _ = _sanitize_manim_code(code)

    try:
        mp4, png, stderr = await asyncio.to_thread(_render_frame, code, idx, run_dir)
    except Exception as e:
        print(f"  [manim frame {idx}] render crashed: {e}", flush=True)
        log.error("frame %d: render raised: %s", idx, e, exc_info=True)
        return {"mp4": None, "png": None, "retried": False, "code": code}

    if mp4 is None:
        error_cat   = _classify_error(stderr)
        retry_hint  = _RETRY_HINTS.get(error_cat, _RETRY_HINTS["unknown"])
        print(f"  [manim frame {idx}] render failed ({error_cat}) — retrying", flush=True)
        retry_prompt = retry_hint + prompt
        try:
            raw = await _call_llm_async(retry_prompt, label=f"manim_prompt frame={idx} render-retry")
        except Exception as e:
            log.error("frame %d: retry LLM failed: %s", idx, e)
            return {"mp4": None, "png": None, "retried": True, "code": code}
        code = _extract_code(raw)
        code, _ = _sanitize_manim_code(code)
        try:
            mp4, png, _ = await asyncio.to_thread(_render_frame, code, idx, run_dir)
        except Exception as e:
            print(f"  [manim frame {idx}] retry render crashed: {e}", flush=True)
            log.error("frame %d: retry render raised: %s", idx, e, exc_info=True)
            return {"mp4": None, "png": None, "retried": True, "code": code}

    if mp4:
        print(f"  [manim frame {idx}] ✓ saved", flush=True)
    else:
        print(f"  [manim frame {idx}] ✗ failed after retry", flush=True)

    return {"mp4": mp4, "png": png, "retried": mp4 is None, "code": code}


# ── Pipeline entry point ──────────────────────────────────────────────────────

async def run_pipeline(prompt: str, run_dir: Path | None = None) -> dict:
    """
    Full pipeline for one prompt.
    Returns: {mp4_paths, png_paths, retry_flags, descriptions, plan, run_dir}
    """
    if run_dir is None:
        run_dir = _OUTPUT_ROOT / datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir.mkdir(parents=True, exist_ok=True)

    plan   = await run_math_plan_with_prompt(prompt)
    frames = _build_frame_contexts(plan)

    manim_template = (_PROMPTS_DIR / "manim_prompt.md").read_text(encoding="utf-8")
    descriptions   = [f["description"] for f in frames]

    results = await asyncio.gather(
        *[_generate_one_frame_tracked(f, manim_template, run_dir) for f in frames],
        return_exceptions=True,
    )

    mp4_paths, png_paths, retry_flags = [], [], []
    for r in results:
        if isinstance(r, Exception):
            print(f"  ✗ frame task raised: {r}", flush=True)
            log.error("frame task exception: %s", r, exc_info=r)
            mp4_paths.append(None)
            png_paths.append(None)
            retry_flags.append(False)
        else:
            mp4_paths.append(r["mp4"])
            png_paths.append(r["png"])
            retry_flags.append(r["retried"])

    return {
        "mp4_paths":   mp4_paths,
        "png_paths":   png_paths,
        "retry_flags": retry_flags,
        "descriptions": descriptions,
        "plan":        plan,
        "run_dir":     str(run_dir),
    }


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    run_dir = _OUTPUT_ROOT / datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir.mkdir(parents=True, exist_ok=True)

    result = await run_pipeline(PROMPT, run_dir)

    print("\nDone.")
    for i, (mp4, png) in enumerate(zip(result["mp4_paths"], result["png_paths"])):
        print(f"  frame {i}: mp4={mp4 or 'FAILED'}  png={png or 'none'}")
    print(f"\nOutput: {run_dir}")


if __name__ == "__main__":
    asyncio.run(main())
