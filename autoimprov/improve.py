"""
improve.py — AutoResearch loop for SVG prompt self-improvement.

Run:
    python improve.py

Each iteration:
  1. Snapshot both prompts → history/iter_N/
  2. Run full pipeline on 3 test prompts
  3. Vision judge (GPT-5) scores each frame → issues + attributions
  4. Compute final score (hard + judge)
  5. Ratchet: keep prompt only if score improved, else restore
  6. Mutator (GPT-5) rewrites the target prompt with one targeted fix
  7. Repeat

After MAX_ITERATIONS, prompts/svg_prompt.md (and optionally planning_vocab.md)
will have been improved by the best-scoring mutations.
"""

import asyncio, base64, json, shutil
from datetime import datetime
from pathlib import Path
from openai import OpenAI

# ── CONFIG ────────────────────────────────────────────────────────────────────
TARGET_PROMPT  = "svg"          # "svg" or "vocab" — which prompt to optimize
MAX_ITERATIONS = 5              # start small; increase for overnight runs

GEN_MODEL      = "gpt-4.1"     # planning + SVG generation (fast, parallel)
JUDGE_MODEL    = "o4-mini"     # vision judge — vision + reasoning, good at layout analysis
MUTATOR_MODEL  = "o3"          # prompt rewriter — strong reasoning for prompt engineering

API_KEY = "OPENAI_KEY_REMOVED"

TEST_PROMPTS = [
    ("illustration", "explain how an electric mouse works using illustrations"),
    ("process",      "explain how DNS resolution works step by step"),
    ("comparison",   "compare how TCP and UDP handle data differently"),
]
# ─────────────────────────────────────────────────────────────────────────────

_HERE        = Path(__file__).parent
_PROMPTS_DIR = _HERE / "prompts"
_HISTORY_DIR = _HERE / "history"
_OUTPUT_ROOT = _HERE / "output"

_PROMPT_FILES = {
    "svg":   _PROMPTS_DIR / "svg_prompt.md",
    "vocab": _PROMPTS_DIR / "planning_vocab.md",
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
    Score one frame using the vision judge.

    If png_path is None (render failed), returns score=0 with rendering attribution.
    Otherwise sends the PNG image + description to JUDGE_MODEL.

    Returns: {score: float 0-1, issues: [str], attributions: ["rendering"|"planning"]}
    """
    if png_path is None:
        return {
            "score": 0.0,
            "issues": ["Frame failed to render — cairosvg error or invalid SVG"],
            "attributions": ["rendering"],
        }

    judge_prompt = f"""You are a strict visual quality judge evaluating an educational SVG diagram frame.

Frame description (what it should show):
{description}

─── PART 1: Binary checks — answer YES or NO only, one per line ───
1. Are all named entities from the description visually present and recognisable?
2. Is all text readable and within canvas bounds (nothing clipped or overflowing)?
3. Are arrows/connections drawn between the correct elements?
4. Is the layout balanced — no overlapping shapes, adequate spacing between elements?
5. Does the overall visual match the teaching intent described?
6. Does the frame visually communicate at least 70% of the educational concept without needing audio — a student who sees only this frame should understand the core idea even without narration?

─── PART 2: Deep analysis — be specific and ruthless ───
After the 6 YES/NO lines, write: ISSUES:
List every problem you see (no limit). For each issue:
- Describe it precisely: which entity, which position, what is wrong
- Include measurements if relevant: "text overflows ~40px beyond right edge"
- Classify as [rendering] (SVG drawing/layout failure) or [planning] (missing/wrong concept)

Cover these dimensions:
SHAPE QUALITY: Do entities look like what they represent? (e.g. does a "server" look like a server — 3D rack appearance, horizontal stripes? Does a "database" look like a cylinder?)
  - If a shape is just a plain rectangle with a label where it should be a recognisable icon, flag it.
COMPONENT DETAIL: Are sub-components present? (e.g. server should have rack lines, database should have elliptical top, browser should have address bar)
COLOR: Are colors appropriate, distinct, and visually pleasing? Note any clashes, poor contrast, or missed fill assignments.
LAYOUT MATH: Flag exact overlaps, insufficient spacing (< 20px between elements), elements near or outside canvas edges.
ARROWS/CONNECTIONS: Are they pointing to the right place? Is the arrowhead visible? Is there a label where needed?
TEXT: Font size too small (< 11px), truncated, or colliding with shapes?
TEACHING CLARITY (the 70% rule): Does the visual tell the story without audio?
  - Are key relationships (flow, sequence, cause→effect, A-vs-B contrast) visible in the diagram — not just implied by labels?
  - Is the most important concept the visual focal point, or is it buried?
  - Are any concepts from the description completely absent from the visual?
  - Flag each missing concept as [planning] if it was never described to the renderer, or [rendering] if it was described but not drawn.

If no issues in a dimension, skip that dimension. If everything is perfect, write "- none".

Format exactly:
YES
NO
YES
YES
YES
YES
ISSUES:
- server icon is a plain rect with no rack stripes or 3D depth [rendering]
- database icon missing elliptical top cap [rendering]
- "Browser" label overflows the shape boundary by ~30px [rendering]
- arrow from browser to server has no arrowhead marker [rendering]
- TCP ACK arrow (the core teaching concept) is missing — student cannot understand reliability without it [rendering]
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

    # Parse YES/NO answers
    lines = [l.strip() for l in raw.splitlines() if l.strip()]
    answers = []
    issues = []
    attributions = []
    in_issues = False

    for line in lines:
        if line.upper().startswith("ISSUES:"):
            in_issues = True
            continue
        if in_issues:
            if line.startswith("-"):
                issue_text = line.lstrip("- ").strip()
                if "[rendering]" in issue_text.lower():
                    attributions.append("rendering")
                    issue_text = issue_text.replace("[rendering]", "").replace("[Rendering]", "").strip()
                elif "[planning]" in issue_text.lower():
                    attributions.append("planning")
                    issue_text = issue_text.replace("[planning]", "").replace("[Planning]", "").strip()
                else:
                    attributions.append("rendering")  # default
                if issue_text.lower() != "none":
                    issues.append(issue_text)
        else:
            if line.upper() in ("YES", "NO"):
                answers.append(line.upper() == "YES")

    score = sum(answers) / 6.0 if len(answers) == 6 else 0.5
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
                "png_paths": [], "retry_flags": [], "svg_texts": [],
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
            "intent":      result.get("intent"),
            "prompt":      result.get("prompt"),
            "judge_avg":   sum(prompt_judge_scores) / len(prompt_judge_scores) if prompt_judge_scores else 0.0,
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
    """Switch from svg to vocab if last 3 iterations are mostly planning failures."""
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

def mutate_prompt(target: str, issues: list[str], attributions: list[str]) -> str:
    """
    Ask MUTATOR_MODEL to propose ONE targeted improvement to the target prompt.
    Reads the full current prompt, returns the full updated prompt text.
    """
    prompt_path = _PROMPT_FILES[target]
    current_text = prompt_path.read_text(encoding="utf-8")

    issues_text = "\n".join(f"- {iss}" for iss in issues) if issues else "- No specific issues captured — improve overall shape recognisability and layout precision"
    attr_summary = f"{attributions.count('rendering')} rendering failures, {attributions.count('planning')} planning failures"

    mutator_prompt = f"""You are an expert prompt engineer. Your job is to improve the SVG generation prompt below so that it produces better-looking educational diagrams.

The judge evaluated the generated frames and found these specific failures:

{issues_text}

Attribution summary: {attr_summary}

YOUR TASK: Rewrite the prompt to fix as many of the above failures as possible.

FREEDOM — you may do any of the following:
- Add new rules, sections, or examples
- Remove rules that are vague, contradictory, or unhelpful
- Restructure or reorder sections for clarity
- Replace prose descriptions with precise mathematical formulas or coordinate recipes
- Add detailed sub-component recipes for entity types (e.g. exactly how to draw a server, database, browser using SVG primitives with relative measurements)
- Add layout patterns with worked examples (centering math, spacing formulas, column/row calculations)
- Add color guidance (contrast rules, fill hierarchy, palette constraints)
- Add double-line or depth techniques for 3D-looking shapes
- Redesign any section from scratch if it is causing the failures

CONSTRAINTS — you must not:
- Change or remove the `{{{{DIAGRAM_DESCRIPTION}}}}` placeholder — it is the pipeline injection point
- Make changes that are unrelated to the observed failures — stay issue-directed
- Return anything other than the complete updated prompt text — no explanation, no markdown fences, no preamble

The failures above are your directive. Use whatever technique produces a prompt that an LLM will follow to draw recognisable, well-laid-out, visually appealing SVG diagrams.

CURRENT PROMPT:
{current_text}
"""

    try:
        response = client.chat.completions.create(
            model=MUTATOR_MODEL,
            max_tokens=16000,
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
    score_history: list[dict] = []

    print(f"\n{'='*60}")
    print(f"AutoResearch Loop")
    print(f"Target: {target}  |  Iterations: {MAX_ITERATIONS}")
    print(f"Test prompts: {len(TEST_PROMPTS)}")
    print(f"{'='*60}\n")

    for i in range(1, MAX_ITERATIONS + 1):
        print(f"\n{'─'*50}")
        print(f"Iteration {i}/{MAX_ITERATIONS}  |  Target: {target}  |  Best so far: {best_score:.3f}")
        print(f"{'─'*50}")

        # 1. Snapshot current prompts
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
            print(f"    [{pp['intent']}] judge_avg={pp['judge_avg']:.3f}")

        # 4. Ratchet
        improved = score_result["final"] > best_score
        if improved:
            print(f"  ✓ Improved: {best_score:.3f} → {score_result['final']:.3f} — keeping")
            best_score = score_result["final"]
        else:
            print(f"  ✗ No improvement ({score_result['final']:.3f} ≤ {best_score:.3f}) — restoring")
            restore(i)

        save_mutation_log(i, target, score_result["all_issues"], improved)

        # 5. Check if should switch target
        if target == "svg" and should_switch_target(score_history):
            print(f"\n  → Switching target: svg_prompt → planning_vocab (planning failures dominating)")
            target = "vocab"

        # 6. Mutate for next iteration (skip on last iteration)
        if i < MAX_ITERATIONS:
            print(f"\n  Mutating {target} prompt...", flush=True)
            new_prompt = mutate_prompt(target, score_result["all_issues"], score_result["attributions"])
            _PROMPT_FILES[target].write_text(new_prompt, encoding="utf-8")
            print(f"  Mutation applied ({len(new_prompt)} chars)")

    # Final summary
    print(f"\n{'='*60}")
    print(f"Done. Best score: {best_score:.3f}")
    print(f"Iterations run: {MAX_ITERATIONS}")
    print(f"History saved in: {_HISTORY_DIR}")
    print(f"\nScore progression:")
    for j, s in enumerate(score_history, 1):
        marker = "✓" if j == 1 or s["final"] > score_history[j-2]["final"] else "✗"
        print(f"  iter {j:02d}: {s['final']:.3f}  {marker}")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
