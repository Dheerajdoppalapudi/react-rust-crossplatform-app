"""
Component Generator — Stage 1.5 of the SVG pipeline.

Sits between Phase A (vocabulary plan) and Phase B (spatial plan).

Flow:
  1. Receive VocabularyPlan (entity identity: entity_type, visual, fill, label).
  2. For each entity in element_vocabulary:
       a. Check the pre-built component DB for a matching icon (keyword match).
       b. If found → use it directly (no LLM call).
       c. If not found → batch it for the LLM.
  3. One LLM call generates SVG fragments for all novel entities.
  4. Return:
       - component_library: dict[entity_key → SVGComponent]  (SVG fragments)
       - dimension_map:     dict[entity_key → {width, height, right_edge_y, bottom_edge_x}]

Phase B (spatial planner) uses the dimension_map to compute pixel-accurate coordinates.
Prompt 3 (SVG renderer) uses the component_library SVG fragments directly.
"""

import asyncio
import json
import os
import re

from services.Frame_generation.planner import VocabularyPlan, call_llm
from services.Frame_generation.svg.component_library import SVGComponent, get_builtin_component


# ---------------------------------------------------------------------------
# JSON extraction
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> dict:
    """Same strategy as planner._extract_json — only tries the first '{'."""
    decoder = json.JSONDecoder()

    fence = re.search(r"```(?:json)?\s*(\{.*?)\s*```", text, re.DOTALL)
    if fence:
        try:
            obj, _ = decoder.raw_decode(fence.group(1).strip())
            return obj
        except json.JSONDecodeError:
            pass

    start = text.find("{")
    if start == -1:
        raise ValueError(f"No JSON found in component LLM response:\n{text[:300]}")
    try:
        obj, _ = decoder.raw_decode(text, start)
        return obj
    except json.JSONDecodeError as e:
        raise ValueError(
            f"JSON parse error at char {e.pos}: {e.msg}\n"
            f"Near: …{text[max(0, e.pos - 80):e.pos + 80]}…"
        ) from e


# ---------------------------------------------------------------------------
# Entity list builder — uses identity fields, not geometry
# ---------------------------------------------------------------------------

def _build_entity_list(entities: dict) -> str:
    """
    Format the entity vocabulary into the {{ENTITY_LIST}} block for Prompt 2.

    New format uses entity_type + visual (identity), not shape geometry.
    Handles both new-format dicts (entity_type/visual/fill/label) and
    legacy string specs for backward compatibility.
    """
    lines = []
    for key, spec in entities.items():
        if isinstance(spec, dict):
            entity_type = spec.get("entity_type", "generic")
            visual      = spec.get("visual", "")
            label       = spec.get("label", key.replace("_", " ").title())
            fill        = spec.get("fill", "#a5d8ff")
            # Build a rich description for Prompt 2
            desc_parts = [f'entity_type={entity_type}', f'label=\'{label}\'', f'fill={fill}']
            if visual:
                desc_parts.append(f'visual="{visual}"')
            lines.append(f'  "{key}": "{", ".join(desc_parts)}"')
        else:
            # Legacy string spec — pass through as-is
            lines.append(f'  "{key}": "{spec}"')
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Novel entity generation via LLM
# ---------------------------------------------------------------------------

def _generate_novel_components_sync(
    entities: dict,
    fill: str,
    stroke: str,
) -> dict[str, SVGComponent]:
    """
    One LLM call to generate SVG fragments for entities not in the pre-built DB.
    Returns dict[entity_key → SVGComponent]. Falls back to a plain labeled box
    for any entity that fails to parse cleanly.
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
    for key, orig_spec in entities.items():
        entry = data.get(key, {})
        svg   = entry.get("svg", "")

        # Dimensions come entirely from Prompt 2 output — no fallback estimates
        width         = int(entry.get("width",          120))
        height        = int(entry.get("height",          80))
        right_edge_y  = int(entry.get("right_edge_y",  height // 2))
        bottom_edge_x = int(entry.get("bottom_edge_x", width  // 2))

        if not svg or not svg.strip().startswith("<g"):
            # Fallback: plain labeled box
            label = (
                orig_spec.get("label", key.replace("_", " ").title())
                if isinstance(orig_spec, dict)
                else key.replace("_", " ").title()
            )
            svg = (
                f'<g>\n'
                f'  <rect x="0" y="0" width="{width}" height="{height}" '
                f'fill="{fill}" stroke="{stroke}" stroke-width="2" rx="8"/>\n'
                f'  <text x="{width // 2}" y="{height // 2}" text-anchor="middle" '
                f'dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" '
                f'font-size="13" font-weight="bold" fill="{stroke}">{label}</text>\n'
                f'</g>'
            )

        result[key] = SVGComponent(
            svg=svg, width=width, height=height,
            right_edge_y=right_edge_y, bottom_edge_x=bottom_edge_x,
        )

    return result


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def generate_svg_components(
    vocab_plan,   # VocabularyPlan or GenerationPlan — both have element_vocabulary + shared_style
) -> tuple[dict[str, SVGComponent], dict[str, dict]]:
    """
    Build the component library from the vocabulary plan.

    Accepts VocabularyPlan (Phase A output) — entity identity only,
    no geometry fields expected or used.

    Returns:
        component_library — dict[entity_key → SVGComponent]
            SVG fragments for use by Prompt 3 (svg_generator)
        dimension_map — dict[entity_key → {width, height, right_edge_y, bottom_edge_x}]
            Exact pixel dimensions for use by Phase B (spatial planner)

    Steps:
      1. Try pre-built DB for each entity (keyword match on entity_type/key).
      2. Batch novel entities → one LLM call.
      3. Merge, build dimension_map, return both.
    """
    if not vocab_plan.element_vocabulary:
        return {}, {}

    stroke = vocab_plan.shared_style.strokeColor
    fill   = vocab_plan.shared_style.backgroundColor

    builtin:  dict[str, SVGComponent] = {}
    novel:    dict = {}                     # key → original spec

    for key, spec in vocab_plan.element_vocabulary.items():
        comp = get_builtin_component(key, spec, fill, stroke)
        if comp:
            builtin[key] = comp
            print(f"[component_generator] '{key}' → pre-built icon ({comp.width}×{comp.height})")
        else:
            novel[key] = spec
            print(f"[component_generator] '{key}' → LLM generation queued")

    generated: dict[str, SVGComponent] = {}
    if novel:
        print(f"[component_generator] Calling LLM for {len(novel)} novel component(s): {list(novel.keys())}")
        generated = await asyncio.to_thread(
            _generate_novel_components_sync, novel, fill, stroke
        )

    component_library = {**builtin, **generated}

    # Build dimension_map — the ground-truth sizes Phase B uses for spatial math
    dimension_map = {
        key: {
            "width":         comp.width,
            "height":        comp.height,
            "right_edge_y":  comp.right_edge_y,
            "bottom_edge_x": comp.bottom_edge_x,
        }
        for key, comp in component_library.items()
    }

    return component_library, dimension_map


# ---------------------------------------------------------------------------
# Component injection helper (used by svg_generator)
# ---------------------------------------------------------------------------

def build_component_injection(
    description: str,
    component_library: dict[str, SVGComponent],
) -> str:
    """
    Replace the COMPONENT POSITIONS section in the Phase B description with
    actual SVG fragments and pre-computed edge-math values.

    Phase B writes:
        COMPONENT POSITIONS:
          browser: translate_x=340 translate_y=380
          dns_resolver: translate_x=540 translate_y=380

    This function reads those (X, Y) values, then replaces the section with
    the full SVG markup + pre-computed arrow edge coordinates — so Prompt 3
    never has to derive or guess any dimension.

    Falls back to appending a block if no COMPONENT POSITIONS section exists.
    """
    if not component_library:
        return description

    components_match = re.search(
        r'(COMPONENT POSITIONS.*?)(?=\nLAYER\s+\d|\nCOMPONENT POSITIONS \(injected|\Z)',
        description, re.DOTALL
    )

    if not components_match:
        return description + _build_appended_block(component_library)

    # Parse translate_x=N translate_y=N entries
    translate_pattern = re.compile(
        r'"?(\w+)"?\s*:\s*translate_x=(\d+)\s+translate_y=(\d+)'
    )
    entity_positions: dict[str, tuple[int, int]] = {}
    for m in translate_pattern.finditer(components_match.group(1)):
        entity_positions[m.group(1)] = (int(m.group(2)), int(m.group(3)))

    lines = ["COMPONENT POSITIONS (injected by pipeline — use these values exactly):"]
    for key, comp in component_library.items():
        X, Y = entity_positions.get(key, (0, 0))
        lines += [
            f"  {key}: translate_x={X} translate_y={Y}",
            f"    Bounding box: width={comp.width}  height={comp.height}",
            f"    right_edge_y={comp.right_edge_y}  bottom_edge_x={comp.bottom_edge_x}",
            f"    Arrow — right  edge: x1={X + comp.width}  y1={Y + comp.right_edge_y}",
            f"    Arrow — left   edge: x1={X}               y1={Y + comp.right_edge_y}",
            f"    Arrow — bottom edge: x1={X + comp.bottom_edge_x}  y1={Y + comp.height}",
            f"    Arrow — top    edge: x1={X + comp.bottom_edge_x}  y1={Y}",
            f"    SVG:",
            f"    {comp.svg}",
        ]

    replacement = "\n".join(lines)
    return description[:components_match.start()] + replacement + description[components_match.end():]


def _build_appended_block(component_library: dict[str, SVGComponent]) -> str:
    """Fallback when Phase B omitted a COMPONENT POSITIONS section."""
    lines = ["\n\nCOMPONENT POSITIONS (injected by pipeline — translate coordinates unknown, place manually):\n"]
    for key, comp in component_library.items():
        lines.append(
            f"  {key}: width={comp.width}  height={comp.height}"
            f"  right_edge_y={comp.right_edge_y}  bottom_edge_x={comp.bottom_edge_x}\n"
            f"  SVG:\n  {comp.svg}\n"
        )
    return "".join(lines)
