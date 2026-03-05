"""
Mermaid Generator — alternative to generate_all_frames for structured diagram types.

Used when intent_type is "process", "architecture", or "timeline".

Pipeline per frame:
  1. LLM call → raw Mermaid text  (parallel, via asyncio.gather)
  2. POST to Node sidecar         (parallel, via asyncio.to_thread)
  3. Return {"elements": [...]}   (same shape as slim JSON — safe through combiner + enhancer)

If the sidecar is unreachable, _sidecar_available() returns False and the caller
falls back to the slim JSON path. If an individual frame fails, it returns an
empty elements list (same graceful fallback as generate_all_frames).
"""

import asyncio
import re
import requests

from services.excalidraw.planner import GenerationPlan, call_llm

SIDECAR_URL = "http://localhost:3001"


# ---------------------------------------------------------------------------
# Sidecar availability check
# ---------------------------------------------------------------------------

def _sidecar_available() -> bool:
    """
    Quick check: is the Node mermaid-converter sidecar running?

    Called once before generate_mermaid_frames. If False, the caller should
    fall back to the slim JSON path so the pipeline never hard-blocks on a
    missing Node process.
    """
    try:
        r = requests.get(f"{SIDECAR_URL}/health", timeout=2)
        return r.status_code == 200
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Mermaid text extraction helper
# ---------------------------------------------------------------------------

def _extract_mermaid(text: str) -> str:
    """
    Pull raw Mermaid syntax out of an LLM response.

    Handles the two common cases:
      1. Raw Mermaid (ideal — what we asked for)
      2. Mermaid wrapped in markdown code fences (```mermaid ... ``` or ``` ... ```)
    """
    # Strip markdown fences if present
    fence = re.search(r"```(?:mermaid)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        return fence.group(1).strip()
    return text.strip()


# ---------------------------------------------------------------------------
# Single frame: LLM → Mermaid → sidecar → elements
# ---------------------------------------------------------------------------

async def _generate_one_mermaid_frame(
    frame,
    mermaid_prompt_template: str,
) -> dict:
    """
    Generate Excalidraw elements for one frame via the Mermaid path.

    1. Injects the frame description into mermaid_prompt.md.
    2. Calls the LLM to produce Mermaid syntax.
    3. POSTs the Mermaid text to the Node sidecar.
    4. Returns {"elements": [...]} — identical shape to a slim JSON dict.
    """
    prompt = mermaid_prompt_template.replace("{{DIAGRAM_DESCRIPTION}}", frame.description)
    raw = await asyncio.to_thread(call_llm, prompt)
    mermaid_text = _extract_mermaid(raw)

    def _call_sidecar():
        r = requests.post(
            f"{SIDECAR_URL}/convert",
            json={"mermaid": mermaid_text},
            timeout=15,
        )
        r.raise_for_status()
        return r.json()

    response = await asyncio.to_thread(_call_sidecar)
    return {"elements": response.get("elements", [])}


# ---------------------------------------------------------------------------
# All frames in parallel
# ---------------------------------------------------------------------------

async def generate_mermaid_frames(
    plan: GenerationPlan,
    mermaid_prompt_template: str,
) -> list[dict]:
    """
    Generate Excalidraw elements for all frames via the Mermaid path.

    Mirrors the interface of generate_all_frames in planner.py:
      - Input:  GenerationPlan + mermaid prompt template string
      - Output: List of {"elements": [...]} dicts, one per frame, in order

    All N LLM + sidecar calls run in parallel via asyncio.gather.
    Failed frames fall back to blank (empty elements list).
    """
    tasks = [
        _generate_one_mermaid_frame(frame, mermaid_prompt_template)
        for frame in plan.frames
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    slims = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"[mermaid_generator] Frame {i} failed: {result}")
            slims.append({"elements": []})
        else:
            slims.append(result)

    return slims
