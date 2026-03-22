"""
Component Generator — Stage 1.5 of the SVG pipeline.

Sits between the Planner and the parallel frame generators.

Flow:
  1. Receive the GenerationPlan (which has element_vocabulary).
  2. For each entity in element_vocabulary:
       a. Check the pre-built component_library for a matching icon.
       b. If found → use it directly (no LLM call).
       c. If not found → add to the "novel entities" batch.
  3. If there are novel entities → one LLM call generates all of them.
  4. Return dict[entity_key → SVGComponent] for ALL entities.

Callers pass this dict to every parallel frame LLM call.
Each frame LLM receives the actual SVG markup and wraps it in
    <g transform="translate(X, Y)">...</g>
to position the icon — guaranteeing pixel-identical icons across frames.
"""

import asyncio
import json
import os
import re

from services.excalidraw.planner import GenerationPlan, call_llm
from services.excalidraw.svg.component_library import SVGComponent, get_builtin_component


# ---------------------------------------------------------------------------
# JSON extraction (same pattern as planner._extract_json)
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> dict:
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))
    obj = re.search(r"\{.*\}", text, re.DOTALL)
    if obj:
        return json.loads(obj.group())
    raise ValueError(f"No JSON found in component LLM response:\n{text[:300]}")


# ---------------------------------------------------------------------------
# Novel entity generation via LLM
# ---------------------------------------------------------------------------

def _build_entity_list(entities: dict[str, str]) -> str:
    """Format the entity dict into the {{ENTITY_LIST}} block for the prompt."""
    lines = []
    for key, spec in entities.items():
        lines.append(f'  "{key}": "{spec}"')
    return "\n".join(lines)


def _generate_novel_components_sync(
    entities: dict[str, str],
    fill: str,
    stroke: str,
) -> dict[str, SVGComponent]:
    """
    Synchronous LLM call to generate SVG components for entities not in
    the pre-built library.  Returns a dict[key → SVGComponent].
    Falls back to a plain labeled box for any entity that fails to parse.
    """
    template_path = os.path.join(
        os.path.dirname(__file__), "..", "prompts", "component_prompt.md"
    )
    with open(template_path) as f:
        template = f.read()

    prompt = (
        template
        .replace("{{FILL_COLOR}}", fill)
        .replace("{{STROKE_COLOR}}", stroke)
        .replace("{{ENTITY_LIST}}", _build_entity_list(entities))
    )

    raw = call_llm(prompt)

    try:
        data = _extract_json(raw)
    except (ValueError, json.JSONDecodeError) as e:
        print(f"[component_generator] LLM JSON parse error: {e}")
        data = {}

    result: dict[str, SVGComponent] = {}
    for key in entities:
        entry = data.get(key, {})
        svg = entry.get("svg", "")
        width = int(entry.get("width", 120))
        height = int(entry.get("height", 80))

        if not svg or not svg.strip().startswith("<g"):
            # Fallback: plain labeled box
            label = key.replace("_", " ").title()
            svg = (
                f'<g>\n'
                f'  <rect x="0" y="0" width="{width}" height="{height}" '
                f'fill="{fill}" stroke="{stroke}" stroke-width="2" rx="8"/>\n'
                f'  <text x="{width // 2}" y="{height // 2}" text-anchor="middle" '
                f'dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" '
                f'font-size="13" font-weight="bold" fill="{stroke}">{label}</text>\n'
                f'</g>'
            )

        result[key] = SVGComponent(svg=svg, width=width, height=height)

    return result


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def generate_svg_components(
    plan: GenerationPlan,
) -> dict[str, SVGComponent]:
    """
    Build the component library for this plan.

    Steps:
      1. For every entity in plan.element_vocabulary, try the pre-built library.
      2. Collect entities with no built-in match into `novel`.
      3. If novel is non-empty, make ONE LLM call to generate all of them.
      4. Merge and return the full dict.

    Returns an empty dict if element_vocabulary is empty (no SVG components
    are needed — plan has no multi-frame shared entities).
    """
    if not plan.element_vocabulary:
        return {}

    stroke = plan.shared_style.strokeColor
    fill   = plan.shared_style.backgroundColor

    builtin: dict[str, SVGComponent] = {}
    novel:   dict[str, str]          = {}  # key → spec string

    for key, spec in plan.element_vocabulary.items():
        comp = get_builtin_component(key, spec, fill, stroke)
        if comp:
            builtin[key] = comp
            print(f"[component_generator] '{key}' → pre-built icon")
        else:
            novel[key] = spec
            print(f"[component_generator] '{key}' → LLM generation queued")

    generated: dict[str, SVGComponent] = {}
    if novel:
        print(f"[component_generator] Calling LLM for {len(novel)} novel component(s): {list(novel.keys())}")
        generated = await asyncio.to_thread(
            _generate_novel_components_sync, novel, fill, stroke
        )

    return {**builtin, **generated}


# ---------------------------------------------------------------------------
# Prompt injection helper (used by svg_generator._generate_svg_code)
# ---------------------------------------------------------------------------

def build_component_injection(component_library: dict[str, SVGComponent]) -> str:
    """
    Build the text block injected into each frame LLM prompt.

    Instructs the model to use the pre-built components by wrapping them
    in <g transform="translate(X, Y)"> at the desired canvas position.
    """
    if not component_library:
        return ""

    lines = [
        "\n\nPre-built SVG components — USE THESE EXACTLY. "
        "Do NOT redraw these entities from scratch. "
        "To place a component on the canvas:\n"
        "  <g transform=\"translate(X, Y)\">\n"
        "    [paste the component SVG here unchanged]\n"
        "  </g>\n"
        "where X, Y is the top-left corner of the component on the canvas.\n"
    ]

    for key, comp in component_library.items():
        lines.append(
            f'\n"{key}"  (bounding box: {comp.width}w × {comp.height}h, anchor: top-left)\n'
            f"SVG:\n{comp.svg}\n"
        )

    lines.append(
        "\nIMPORTANT positioning rules when using components:\n"
        "- Component center_x = translate_X + component_width / 2\n"
        "- Component center_y = translate_Y + component_height / 2\n"
        "- Arrows between components connect at EDGE midpoints:\n"
        "    Right edge of A: (translate_X_A + width_A,  translate_Y_A + height_A/2)\n"
        "    Left  edge of B: (translate_X_B,             translate_Y_B + height_B/2)\n"
        "- Use the grid formulas from the prompt to compute translate_X/Y for N components.\n"
        "- Never place components so they overlap each other.\n"
    )

    return "".join(lines)
