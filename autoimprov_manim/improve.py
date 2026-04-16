"""
improve.py — AutoResearch loop for Manim math prompt self-improvement.

Run:
    bash run.sh improve.py

Each iteration:
  1. Snapshot both prompts → history/iter_N/
  2. Run full pipeline on 3 math test prompts
  3. Vision judge (gpt-4o) scores each PNG thumbnail → issues + attributions
  4. Compute final score (hard + judge)
  5. Ratchet: keep prompt only if score improved, else restore
  6. Mutator (o3) rewrites the target prompt with targeted fixes
  7. Repeat

After MAX_ITERATIONS, prompts/manim_prompt.md (and optionally planning_math.md)
will have been improved by the best-scoring mutations.
"""

import asyncio, base64, json, os, re, shutil
from datetime import datetime
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

# ── CONFIG ────────────────────────────────────────────────────────────────────
TARGET_PROMPT  = "manim"        # "manim" or "planning" — which prompt to optimize
MAX_ITERATIONS = 5              # start small; increase for overnight runs

GEN_MODEL      = "gpt-4.1"     # must match MODEL in run.py — used for planning + Manim generation
JUDGE_MODEL    = "gpt-4o"      # vision judge — reliable structured output, follows YES/NO format
MUTATOR_MODEL  = "o3"          # prompt rewriter — strong reasoning for prompt engineering

API_KEY = os.environ["OPENAI_API_KEY"]

# All three prompts must be math-path intents — they must classify to "math".
TEST_PROMPTS = [
    ("math", "explain gradient descent visually using a loss surface"),
    ("math", "visualise how the fourier transform decomposes a square wave into sine components"),
    ("math", "show how the chain rule works step by step with a concrete example"),
]
# ─────────────────────────────────────────────────────────────────────────────

_HERE        = Path(__file__).parent
_PROMPTS_DIR = _HERE / "prompts"
_HISTORY_DIR = _HERE / "history"
_OUTPUT_ROOT = _HERE / "output"

_PROMPT_FILES = {
    "manim":    _PROMPTS_DIR / "manim_prompt.md",
    "planning": _PROMPTS_DIR / "planning_math.md",   # math-path planner
}

client = OpenAI(api_key=API_KEY)

# Import pipeline from run.py
import sys
sys.path.insert(0, str(_HERE))
from run import run_pipeline


# ── Snapshot / Restore ────────────────────────────────────────────────────────

def snapshot(iter_n: int):
    """Copy both prompt files to history/iter_N/ before mutating."""
    snap_dir = _HISTORY_DIR / f"iter_{iter_n:03d}"
    snap_dir.mkdir(parents=True, exist_ok=True)
    for name, path in _PROMPT_FILES.items():
        shutil.copy2(path, snap_dir / path.name)


def restore(iter_n: int):
    """Restore both prompt files from history/iter_N/ (bad mutation — roll back)."""
    snap_dir = _HISTORY_DIR / f"iter_{iter_n:03d}"
    for name, path in _PROMPT_FILES.items():
        snap_file = snap_dir / path.name
        if snap_file.exists():
            shutil.copy2(snap_file, path)


# ── Vision judge ──────────────────────────────────────────────────────────────

def _encode_png(png_path: str) -> str:
    """Base64-encode a PNG for the vision API."""
    with open(png_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def llm_judge(png_path: str | None, description: str) -> dict:
    """
    Score one Manim frame thumbnail using the vision judge.

    If png_path is None (render failed), returns score=0 with rendering attribution.
    Otherwise sends the PNG image + description to JUDGE_MODEL.

    Returns: {score: float 0-1, issues: [str], attributions: ["rendering"|"planning"]}
    """
    if png_path is None:
        return {
            "score": 0.0,
            "issues": ["Frame failed to render — Manim error or LaTeX/attribute crash"],
            "attributions": ["rendering"],
        }

    judge_prompt = f"""You are a strict visual quality judge evaluating a Manim math animation frame (a PNG thumbnail of the last frame).

Frame description (what it should show):
{description}

─── PART 1: Binary checks — answer YES or NO only, one per line ───
1. Are all mathematical concepts mentioned in the description visually present and labelled?
2. Is all text readable, within canvas bounds, and not overlapping other elements?
3. Are arrows, axes, and curves drawn correctly and pointing/connecting the right things?
4. Is the layout clean — no overlapping shapes, adequate spacing, elements not near edges?
5. Does the visual match the teaching intent described — a student can follow the math story?
6. Does the frame communicate at least 70% of the mathematical concept without audio — the core idea is clear from the visual alone?
7. Are all text labels free of collisions — no label overlaps another label, a curve, or an axis?

─── PART 2: Deep analysis — be specific and ruthless ───
After the 7 YES/NO lines, write: ISSUES:
List every problem you see (no limit). For each issue:
- Describe it precisely: which element, which position, what is wrong
- Classify as [rendering] (Manim drawing/layout failure) or [planning] (missing/wrong concept)

Cover these dimensions:
MATH CORRECTNESS: Are the shapes, curves, equations, axes and values mathematically accurate?
  - e.g. does a parabola look like a parabola? Is the loss surface bowl-shaped? Are axis labels correct?
  - Flag any wrong shape, wrong direction, or mis-labelled value.
ANIMATION STATE: The thumbnail shows the LAST frame. Does it show the completed state of the animation?
  - e.g. the final step of a derivation should show all intermediate lines, not just the start
  - Flag if key intermediate elements seem absent from the final frame.
TEXT QUALITY: Are all Text() objects readable? Are they placed logically (not inside a curve, not clipped)?
  - LaTeX MathTex should not appear (LaTeX is not installed) — use only Text() with Unicode
  - Flag any boxes/question marks in place of symbols — these indicate a font fallback failure
AXES & CURVES: For Axes objects, are tick labels visible? Are plotted functions smooth and correct?
  - Check that axis limits are appropriate for the concept being shown
COLOR: Is the background dark (#1e1e2e or similar)? Are key objects using contrasting colors?
  - Is the primary concept highlighted vs secondary elements shown dimmer?
LAYOUT: Is the scene centered? Are elements using the full canvas without being clipped?
  - Flag elements within 0.3 units of the canvas edge
TEACHING CLARITY (the 70% rule): Does the visual alone tell the mathematical story?
  - Are relationships (growth, convergence, decomposition, transformation) visually apparent?
  - Are key steps or transitions labelled so a student can follow the reasoning?
  - Flag each missing concept as [planning] if never described, or [rendering] if described but not drawn.

If no issues in a dimension, skip that dimension. If everything is perfect, write "- none".

Format exactly:
YES
NO
YES
YES
YES
YES
YES
ISSUES:
- loss surface shape is flat — should be bowl-shaped 3D paraboloid [rendering]
- axis labels "x" and "y" overlap the axis lines [rendering]
- gradient descent arrows are missing — core concept not visualised [planning]
- text "∂L/∂w" renders as a box — Unicode glyph not supported by default font [rendering]
"""

    try:
        response = client.chat.completions.create(
            model=JUDGE_MODEL,
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{_encode_png(png_path)}",
                            "detail": "high",
                        },
                    },
                    {"type": "text", "text": judge_prompt},
                ],
            }],
        )
        raw = response.choices[0].message.content.strip()
    except Exception as e:
        print(f"    judge call failed: {e}", flush=True)
        return {"score": 0.5, "issues": [f"Judge error: {e}"], "attributions": ["rendering"]}

    # Parse YES/NO answers — robust to gpt-4o formatting:
    #   "1. YES", "YES — explanation", "**YES**", "Yes", numbered issues, etc.
    lines = [l.strip() for l in raw.splitlines() if l.strip()]
    answers = []
    issues = []
    attributions = []
    in_issues = False

    for line in lines:
        if re.search(r'ISSUES\s*:', line, re.IGNORECASE):
            in_issues = True
            continue
        if in_issues:
            if line.startswith("-") or re.match(r'^\d+[\.\)]\s', line):
                issue_text = re.sub(r'^\d+[\.\)]\s*', '', line).lstrip("- ").strip()
                if "[rendering]" in issue_text.lower():
                    attributions.append("rendering")
                    issue_text = re.sub(r'\[rendering\]', '', issue_text, flags=re.IGNORECASE).strip()
                elif "[planning]" in issue_text.lower():
                    attributions.append("planning")
                    issue_text = re.sub(r'\[planning\]', '', issue_text, flags=re.IGNORECASE).strip()
                else:
                    attributions.append("rendering")
                if issue_text.lower() not in ("none", ""):
                    issues.append(issue_text)
        else:
            clean = re.sub(r'^\*{0,2}\d+[\.\)]\s*\*{0,2}', '', line).strip()
            clean = re.sub(r'\*+', '', clean).strip()
            first_word = clean.split()[0].upper() if clean else ""
            if first_word in ("YES", "NO"):
                answers.append(first_word == "YES")

    print(f"    judge parse: {len(answers)}/7 answers, {len(issues)} issues", flush=True)
    if len(answers) != 7:
        print(f"    [WARN] unexpected judge response format. Raw (first 400):\n{raw[:400]}", flush=True)

    score = sum(answers) / 7.0 if len(answers) == 7 else 0.5
    return {"score": score, "issues": issues, "attributions": attributions}


# ── Evaluate: run pipeline on all test prompts ────────────────────────────────

async def evaluate(test_prompts: list[tuple]) -> list[dict]:
    """
    Run the full pipeline on all test prompts.
    Returns list of result dicts, one per test prompt.
    """
    results = []
    for intent, prompt in test_prompts:
        print(f"\n  Evaluating [{intent}]: {prompt[:55]}...", flush=True)
        run_dir = _OUTPUT_ROOT / f"eval_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        try:
            result = await run_pipeline(prompt, run_dir)
            result["intent"] = intent
            result["prompt"] = prompt
        except Exception as e:
            print(f"    pipeline failed: {e}", flush=True)
            result = {
                "intent": intent, "prompt": prompt,
                "mp4_paths": [], "png_paths": [], "retry_flags": [],
                "descriptions": [], "plan": {}, "run_dir": str(run_dir),
            }
        results.append(result)
    return results


# ── Score ─────────────────────────────────────────────────────────────────────

def compute_score(eval_results: list[dict]) -> dict:
    """
    Aggregate scores across all test prompts and frames.

    hard_score  = render_rate×0.5 + no_retry_rate×0.5
    judge_score = average per-frame vision judge score
    final       = hard×0.4 + judge×0.6
    """
    total_frames  = 0
    rendered      = 0
    no_retry      = 0
    judge_scores  = []
    all_issues    = []
    all_attr      = []
    per_prompt    = []

    for result in eval_results:
        png_paths    = result.get("png_paths", [])
        retry_flags  = result.get("retry_flags", [])
        descriptions = result.get("descriptions", [])

        prompt_judge_scores = []
        for i, (png, retried, desc) in enumerate(zip(png_paths, retry_flags, descriptions)):
            total_frames += 1
            if png is not None:
                rendered += 1
            if not retried:
                no_retry += 1

            print(f"    judging frame {i}...", flush=True)
            judgment = llm_judge(png, desc)
            judge_scores.append(judgment["score"])
            prompt_judge_scores.append(judgment["score"])
            all_issues.extend(judgment["issues"])
            all_attr.extend(judgment["attributions"])

        per_prompt.append({
            "intent":    result.get("intent"),
            "prompt":    result.get("prompt"),
            "judge_avg": sum(prompt_judge_scores) / len(prompt_judge_scores) if prompt_judge_scores else 0.0,
        })

    render_rate   = rendered / total_frames if total_frames else 0.0
    no_retry_rate = no_retry / total_frames if total_frames else 0.0
    hard_score    = render_rate * 0.5 + no_retry_rate * 0.5
    judge_avg     = sum(judge_scores) / len(judge_scores) if judge_scores else 0.0
    final         = hard_score * 0.4 + judge_avg * 0.6

    return {
        "final":         round(final, 4),
        "hard":          round(hard_score, 4),
        "judge":         round(judge_avg, 4),
        "render_rate":   round(render_rate, 4),
        "no_retry_rate": round(no_retry_rate, 4),
        "total_frames":  total_frames,
        "all_issues":    all_issues,
        "attributions":  all_attr,
        "per_prompt":    per_prompt,
    }


# ── Switch-target heuristic ───────────────────────────────────────────────────

def should_switch_target(score_history: list[dict]) -> bool:
    """Switch from manim to planning if last 3 iterations are mostly planning failures."""
    if len(score_history) < 3:
        return False
    recent_attr = []
    for s in score_history[-3:]:
        recent_attr.extend(s.get("attributions", []))
    if not recent_attr:
        return False
    planning_ratio = recent_attr.count("planning") / len(recent_attr)
    return planning_ratio > 0.6


# ── Mutator ───────────────────────────────────────────────────────────────────

def mutate_prompt(target: str, issues: list[str], attributions: list[str],
                  score_result: dict | None = None, score_history: list[dict] | None = None) -> str:
    """
    Ask MUTATOR_MODEL to rewrite the target prompt based on judge feedback.
    Reads the full current prompt, returns the full updated prompt text.
    """
    prompt_path = _PROMPT_FILES[target]
    current_text = prompt_path.read_text(encoding="utf-8")

    issues_text = "\n".join(f"- {iss}" for iss in issues) if issues else "- No specific issues captured — improve overall math clarity and layout precision"
    attr_summary = f"{attributions.count('rendering')} rendering failures, {attributions.count('planning')} planning failures"

    # Build per-intent breakdown
    intent_breakdown = ""
    if score_result:
        lines = []
        for pp in score_result.get("per_prompt", []):
            lines.append(f"  [{pp['intent']}] judge_avg={pp['judge_avg']:.2f}  prompt: {pp['prompt'][:55]}")
        if lines:
            intent_breakdown = "Per-topic scores (focus fixes on the lowest):\n" + "\n".join(lines)

    # Build score trend context
    score_context = ""
    if score_history and len(score_history) >= 2:
        trend = " → ".join(f"{s['final']:.3f}" for s in score_history[-4:])
        best  = max(s["final"] for s in score_history)
        score_context = f"Score trend (recent): {trend}  |  Best so far: {best:.3f}\nCurrent score: {score_result['final']:.3f}" if score_result else ""

    # Identify what's passing — don't touch those sections
    passing = []
    if score_result:
        if score_result.get("render_rate", 0) >= 1.0:
            passing.append("render_rate=100% (Manim code runs without errors — don't change safety rules)")
        if score_result.get("no_retry_rate", 0) >= 0.9:
            passing.append("no_retry_rate≥90% (code validity is solid — don't over-restrict Manim API)")

    passing_text = ("What is already working well — DO NOT regress these:\n" +
                    "\n".join(f"  ✓ {p}" for p in passing)) if passing else ""

    target_label = "Manim animation" if target == "manim" else "math planning"
    mutator_prompt = f"""You are an expert prompt engineer. Your job is to improve the {target_label} prompt below so that it produces better-quality educational math animations.

{score_context}

{intent_breakdown}

The judge found these specific failures (top 10 by severity):
{issues_text}

Attribution summary: {attr_summary}

{passing_text}

KEY CONSTRAINTS FOR MANIM PROMPTS:
- LaTeX is NOT installed in the render environment — NEVER suggest MathTex or Tex
- Only Text() with Unicode math symbols is available: ², √, π, ∂, Σ, ±, ×, →, ∫, θ, α, β
- Only index Text() objects with subscripts, NEVER index them like arrays (t[0], t[1] causes crashes)
- Manim version is community edition — only standard Manim API, no plugins
- background_color must always be set in construct()

YOUR TASK: Rewrite the prompt to fix as many of the above failures as possible.

FREEDOM — you may do any of the following:
- Add new rules, sections, or examples
- Remove rules that are vague, contradictory, or unhelpful
- Restructure or reorder sections for clarity
- Add concrete Manim code examples for patterns that keep failing
- Add layout guidance (camera frame size is 8×4.5 units by default)
- Add color guidance (dark background, bright primary objects, dimmer secondary)
- Redesign any section from scratch if it is causing the failures

CONSTRAINTS — you must not:
- Change or remove the `{{{{DIAGRAM_DESCRIPTION}}}}` placeholder — it is the pipeline injection point
- Change or remove the `{{{{PRIMARY_COLOR}}}}` placeholder — it is the pipeline injection point
- Suggest MathTex, Tex, or any LaTeX-dependent Manim class
- Regress anything listed in "what is already working well" above
- Return anything other than the complete updated prompt text — no explanation, no markdown fences, no preamble

CURRENT PROMPT:
{current_text}
"""

    try:
        response = client.chat.completions.create(
            model=MUTATOR_MODEL,
            max_completion_tokens=16000,
            messages=[{"role": "user", "content": mutator_prompt}],
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"    mutator call failed: {e} — keeping current prompt", flush=True)
        return current_text


# ── History helpers ───────────────────────────────────────────────────────────

def save_score(iter_n: int, score_result: dict):
    snap_dir = _HISTORY_DIR / f"iter_{iter_n:03d}"
    snap_dir.mkdir(parents=True, exist_ok=True)
    with open(snap_dir / "score.json", "w") as f:
        json.dump(score_result, f, indent=2)


def save_mutation_log(iter_n: int, target: str, issues: list[str], kept: bool):
    snap_dir = _HISTORY_DIR / f"iter_{iter_n:03d}"
    snap_dir.mkdir(parents=True, exist_ok=True)
    lines = [
        f"Iteration: {iter_n}",
        f"Target prompt: {target}",
        f"Kept: {kept}",
        "",
        "Issues that triggered this mutation:",
    ] + [f"  - {iss}" for iss in issues] + [""]
    (snap_dir / "mutation.txt").write_text("\n".join(lines))


# ── Main loop ─────────────────────────────────────────────────────────────────

async def main():
    target       = TARGET_PROMPT
    best_score   = 0.0
    best_iter    = 0
    score_history: list[dict] = []

    print(f"\n{'='*60}")
    print(f"AutoResearch Loop — Manim Math Path")
    print(f"Target: {target}  |  Iterations: {MAX_ITERATIONS}")
    print(f"Test prompts: {len(TEST_PROMPTS)}")
    print(f"{'='*60}\n")

    for i in range(1, MAX_ITERATIONS + 1):
        print(f"\n{'─'*50}")
        print(f"Iteration {i}/{MAX_ITERATIONS}  |  Target: {target}  |  Best so far: {best_score:.3f}")
        print(f"{'─'*50}")

        # 1. Snapshot current prompts (before mutation)
        snapshot(i)

        # 2. Run pipeline on all test prompts
        eval_results = await evaluate(TEST_PROMPTS)

        # 3. Score
        score_result = compute_score(eval_results)
        score_history.append(score_result)
        save_score(i, score_result)

        print(f"\n  Score: {score_result['final']:.3f}  "
              f"(hard={score_result['hard']:.3f}, judge={score_result['judge']:.3f}, "
              f"render={score_result['render_rate']:.0%}, no_retry={score_result['no_retry_rate']:.0%})")

        for pp in score_result["per_prompt"]:
            print(f"    [{pp['intent']}] judge_avg={pp['judge_avg']:.3f}  {pp['prompt'][:50]}")

        # 4. Ratchet — restore to best-known snapshot if no improvement
        improved = score_result["final"] > best_score
        if improved:
            print(f"  ✓ Improved: {best_score:.3f} → {score_result['final']:.3f} — keeping")
            best_score = score_result["final"]
            best_iter  = i
        else:
            if best_iter > 0:
                print(f"  ✗ No improvement ({score_result['final']:.3f} ≤ {best_score:.3f}) — restoring to iter {best_iter}")
                restore(best_iter)
            else:
                print(f"  ✗ No improvement — restoring current snapshot")
                restore(i)

        save_mutation_log(i, target, score_result["all_issues"], improved)

        # 5. Check if should switch target
        if target == "manim" and should_switch_target(score_history):
            print(f"\n  → Switching target: manim_prompt → planning_math (planning failures dominating)")
            target = "planning"

        # 6. Mutate for next iteration (skip on last iteration)
        if i < MAX_ITERATIONS:
            print(f"\n  Mutating {target} prompt...", flush=True)
            top_issues = score_result["all_issues"][:10]
            top_attrs  = score_result["attributions"][:10]
            new_prompt = mutate_prompt(target, top_issues, top_attrs, score_result, score_history)
            _PROMPT_FILES[target].write_text(new_prompt, encoding="utf-8")
            print(f"  Mutation applied ({len(new_prompt)} chars)")

    # Final summary
    print(f"\n{'='*60}")
    print(f"Done. Best score: {best_score:.3f}")
    print(f"Iterations run: {MAX_ITERATIONS}")
    print(f"History saved in: {_HISTORY_DIR}")
    print(f"\nScore progression:")
    for j, s in enumerate(score_history, 1):
        marker = "✓" if j > 1 and s["final"] > score_history[j-2]["final"] else ("baseline" if j == 1 else " ")
        print(f"  iter {j:02d}: {s['final']:.3f}  {marker}")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
