"""
Excalidraw Enhancer — converts slim JSON to full .excalidraw format.

Usage:
  python excalidraw_enhancer.py input.json output.excalidraw
  python excalidraw_enhancer.py input.json  # writes to input.excalidraw

As module:
  from excalidraw_enhancer import enhance
  result = enhance(slim_dict)
"""

import json
import os
import sys
import random
import time
import string
import math

def _generate_id():
    chars = string.ascii_letters + string.digits + "_-"
    return "".join(random.choice(chars) for _ in range(21))


def _generate_seed():
    return random.randint(1, 2**31 - 1)


def _timestamp():
    return int(time.time() * 1000)


def _index_label(i):
    """Generate excalidraw index labels: a0, a1, a2, ..."""
    return f"a{i}"


# --- Defaults per element type ---

COMMON_DEFAULTS = {
    "angle": 0,
    "strokeColor": "#1e1e1e",
    "backgroundColor": "transparent",
    "fillStyle": "solid",
    "strokeWidth": 1,
    "strokeStyle": "solid",
    "roughness": 1,
    "opacity": 100,
    "groupIds": [],
    "frameId": None,
    "isDeleted": False,
    "boundElements": None,
    "link": None,
    "locked": False,
}

ROUNDNESS_BY_TYPE = {
    "rectangle": {"type": 3},
    "diamond": {"type": 2},
    "ellipse": {"type": 2},
    "arrow": {"type": 2},
    "line": {"type": 2},
    "text": None,
    "freedraw": None,
}

TEXT_DEFAULTS = {
    "fontSize": 20,
    "fontFamily": 5,
    "textAlign": "left",
    "verticalAlign": "top",
    "containerId": None,
    "autoResize": True,
    "lineHeight": 1.25,
}

ARROW_DEFAULTS = {
    "startArrowhead": None,
    "endArrowhead": "arrow",
    "elbowed": False,
    "moveMidPointsWithElement": False,
}

LINE_DEFAULTS = {
    "startArrowhead": None,
    "endArrowhead": None,
    "elbowed": False,
    "moveMidPointsWithElement": False,
}


def _estimate_text_width(text, font_size=20):
    """Rough estimate of text width in pixels."""
    return len(text) * font_size * 0.6


def _build_element(slim, index, ts):
    """Build a full excalidraw element from a slim element definition."""
    elem_type = slim["type"]
    elem_id = slim.get("id") or _generate_id()

    el = {
        "id": elem_id,
        "type": elem_type,
        "x": slim.get("x", 0),
        "y": slim.get("y", 0),
        "width": slim.get("width", 100),
        "height": slim.get("height", 50),
    }

    # Apply common defaults (user overrides win)
    for key, val in COMMON_DEFAULTS.items():
        el[key] = slim.get(key, val if not isinstance(val, list) else list(val))

    # Auto-upgrade fillStyle to hachure when a non-transparent backgroundColor is given
    # but fillStyle wasn't explicitly set — matches professional diagram aesthetics
    if "fillStyle" not in slim:
        bg = slim.get("backgroundColor", "transparent")
        if bg and bg != "transparent":
            el["fillStyle"] = "hachure"

    el["index"] = slim.get("index", _index_label(index))
    el["roundness"] = slim.get("roundness", ROUNDNESS_BY_TYPE.get(elem_type))
    el["seed"] = slim.get("seed", _generate_seed())
    el["version"] = slim.get("version", 1)
    el["versionNonce"] = slim.get("versionNonce", _generate_seed())
    el["updated"] = slim.get("updated", ts)

    # Type-specific defaults
    if elem_type == "text":
        text = slim.get("text", "")
        for key, val in TEXT_DEFAULTS.items():
            el[key] = slim.get(key, val)
        el["text"] = text
        el["originalText"] = slim.get("originalText", text)
        # Auto-size text
        font_size = el["fontSize"]
        lines = text.split("\n")
        el["width"] = slim.get("width", max(_estimate_text_width(line, font_size) for line in lines) if lines else 50)
        el["height"] = slim.get("height", len(lines) * font_size * el["lineHeight"])

    if elem_type in ("arrow", "line"):
        defaults = ARROW_DEFAULTS if elem_type == "arrow" else LINE_DEFAULTS
        for key, val in defaults.items():
            el[key] = slim.get(key, val)
        # Points and bindings are set later in _resolve_arrows (for from/to mode)
        # For freeform mode (explicit points), use them directly
        el["points"] = slim.get("points", [[0, 0], [100, 0]])
        el["lastCommittedPoint"] = None
        # Auto-compute width/height from points bounding box
        if "points" in slim and "width" not in slim:
            all_x = [p[0] for p in el["points"]]
            all_y = [p[1] for p in el["points"]]
            el["width"] = max(all_x) - min(all_x)
            el["height"] = max(all_y) - min(all_y)

    if elem_type == "freedraw":
        el["points"] = slim.get("points", [[0, 0]])
        el["pressures"] = slim.get("pressures", [0.5] * len(el["points"]))
        el["lastCommittedPoint"] = None
        # Auto-compute width/height from points bounding box
        if el["points"]:
            all_x = [p[0] for p in el["points"]]
            all_y = [p[1] for p in el["points"]]
            el["width"] = max(all_x) - min(all_x)
            el["height"] = max(all_y) - min(all_y)

    return el


def _create_bound_text(parent_el, label, index, ts, center_x=None, center_y=None):
    """Create a text element bound to a shape or arrow (for 'label' field).

    For shapes, center is auto-computed from parent bounds.
    For arrows/lines, pass center_x/center_y to use the path midpoint instead.
    """
    text_id = _generate_id()
    font_size = 20
    lines = label.split("\n")
    text_width = max(_estimate_text_width(line, font_size) for line in lines) if lines else 50
    text_height = len(lines) * font_size * 1.25

    if center_x is None:
        center_x = parent_el["x"] + parent_el["width"] / 2
    if center_y is None:
        center_y = parent_el["y"] + parent_el["height"] / 2

    text_el = {
        "id": text_id,
        "type": "text",
        "x": center_x - text_width / 2,
        "y": center_y - text_height / 2,
        "width": text_width,
        "height": text_height,
    }

    for key, val in COMMON_DEFAULTS.items():
        text_el[key] = val if not isinstance(val, list) else list(val)

    text_el["index"] = _index_label(index)
    text_el["roundness"] = None
    text_el["seed"] = _generate_seed()
    text_el["version"] = 1
    text_el["versionNonce"] = _generate_seed()
    text_el["updated"] = ts
    text_el["boundElements"] = None

    for key, val in TEXT_DEFAULTS.items():
        text_el[key] = val
    text_el["textAlign"] = "center"
    text_el["verticalAlign"] = "middle"
    text_el["containerId"] = parent_el["id"]
    text_el["text"] = label
    text_el["originalText"] = label
    text_el["autoResize"] = True

    return text_el, text_id


def _center_of(el):
    """Get center coordinates of an element."""
    return el["x"] + el["width"] / 2, el["y"] + el["height"] / 2


def _best_edge_routing(src, dst):
    """Compute direction-aware arrow routing between two elements.

    Selects which edge of src to exit from and which edge of dst to enter,
    based on the dominant direction between their centers.

    Returns (start_x, start_y, end_rel_x, end_rel_y, start_fp, end_fp)
    where end_rel_x/y are point offsets relative to start (used as points[1]).
    """
    src_cx, src_cy = _center_of(src)
    dst_cx, dst_cy = _center_of(dst)
    dx = dst_cx - src_cx
    dy = dst_cy - src_cy

    if abs(dx) >= abs(dy):
        if dx >= 0:
            # dst is to the right: exit right edge → enter left edge
            start_x, start_y = src["x"] + src["width"], src_cy
            end_rel_x = dst["x"] - start_x
            end_rel_y = dst_cy - start_y
            start_fp, end_fp = [1, 0.5001], [0, 0.5001]
        else:
            # dst is to the left: exit left edge → enter right edge
            start_x, start_y = src["x"], src_cy
            end_rel_x = dst["x"] + dst["width"] - start_x
            end_rel_y = dst_cy - start_y
            start_fp, end_fp = [0, 0.5001], [1, 0.5001]
    else:
        if dy >= 0:
            # dst is below: exit bottom edge → enter top edge
            start_x, start_y = src_cx, src["y"] + src["height"]
            end_rel_x = dst_cx - start_x
            end_rel_y = dst["y"] - start_y
            start_fp, end_fp = [0.5001, 1], [0.5001, 0]
        else:
            # dst is above: exit top edge → enter bottom edge
            start_x, start_y = src_cx, src["y"]
            end_rel_x = dst_cx - start_x
            end_rel_y = dst["y"] + dst["height"] - start_y
            start_fp, end_fp = [0.5001, 0], [0.5001, 1]

    return start_x, start_y, end_rel_x, end_rel_y, start_fp, end_fp


_LABEL_PERP_OFFSET = 18   # pixels to offset label perpendicular to arrow direction


def _arrow_label_pos(el):
    """Return (x, y) for an arrow/line label — path midpoint shifted perpendicular
    to the overall travel direction using CW rotation of the direction vector.

    Direction  →  CW perp  →  label side
      right    →  up       }  bidirectional pairs get opposite sides automatically:
      left     →  down     }  A→B label above, B→A label below
      down     →  right    }  A→B label right,  B→A label left
      up       →  left     }

    This naturally keeps bidirectional arrow labels apart without any
    special-casing for individual pairs.
    """
    points = el.get("points", [[0, 0]])
    if len(points) < 2:
        return el["x"], el["y"]

    # Midpoint along the rendered path segment closest to the middle
    mid_i = len(points) // 2
    p0, p1 = points[mid_i - 1], points[mid_i]
    mid_x = el["x"] + (p0[0] + p1[0]) / 2
    mid_y = el["y"] + (p0[1] + p1[1]) / 2

    # Overall travel direction: first point → last point
    first, last = points[0], points[-1]
    dx, dy = last[0] - first[0], last[1] - first[1]
    length = math.sqrt(dx * dx + dy * dy)
    if length < 1:
        return mid_x, mid_y

    # CW perpendicular unit vector: (dy/length, -dx/length)
    return (mid_x + _LABEL_PERP_OFFSET * dy / length,
            mid_y + _LABEL_PERP_OFFSET * (-dx) / length)


def _resolve_ref(ref, full_elements, id_map):
    """Resolve a from/to reference — supports integer index or string id."""
    if isinstance(ref, int):
        return full_elements[ref]
    if isinstance(ref, str):
        idx = id_map.get(ref)
        if idx is not None:
            return full_elements[idx]
    return None


def _resolve_arrows(slim_elements, full_elements):
    """Resolve from/to references on arrows and compute positions & bindings."""
    # Build id -> index map for string-based references
    id_map = {}
    for i, el in enumerate(full_elements):
        id_map[el["id"]] = i
    # Also map slim-provided ids (before enhancer generated them)
    for i, s in enumerate(slim_elements):
        if "id" in s:
            id_map[s["id"]] = i

    for i, slim in enumerate(slim_elements):
        if slim["type"] not in ("arrow", "line"):
            continue

        el = full_elements[i]
        from_ref = slim.get("from")
        to_ref = slim.get("to")

        if from_ref is not None and to_ref is not None:
            # Connection mode: auto-compute positions between two elements
            src = _resolve_ref(from_ref, full_elements, id_map)
            dst = _resolve_ref(to_ref, full_elements, id_map)

            if src is None or dst is None:
                el["startBinding"] = None
                el["endBinding"] = None
                continue

            # Direction-aware edge selection based on relative center positions
            start_x, start_y, end_rel_x, end_rel_y, start_fp, end_fp = \
                _best_edge_routing(src, dst)

            el["x"] = start_x
            el["y"] = start_y
            el["points"] = [[0, 0], [end_rel_x, end_rel_y]]
            el["width"] = abs(end_rel_x)
            el["height"] = abs(end_rel_y)

            el["startBinding"] = {
                "elementId": src["id"],
                "mode": "orbit",
                "fixedPoint": start_fp,
            }
            el["endBinding"] = {
                "elementId": dst["id"],
                "mode": "orbit",
                "fixedPoint": end_fp,
            }

            # Add arrow to source and dest boundElements
            arrow_ref = {"id": el["id"], "type": el["type"]}
            if src["boundElements"] is None:
                src["boundElements"] = []
            src["boundElements"].append(arrow_ref)
            if dst["boundElements"] is None:
                dst["boundElements"] = []
            dst["boundElements"].append(arrow_ref)
        else:
            # Freeform mode: line/arrow with explicit points, no bindings
            el["startBinding"] = slim.get("startBinding")
            el["endBinding"] = slim.get("endBinding")


# ---------------------------------------------------------------------------
# Semantic shape expansion
# ---------------------------------------------------------------------------
# When the AI emits a semantic type (e.g. "cylinder", "cloud", "actor"),
# the enhancer expands it into a main primitive element (keeps the original id)
# plus a list of purely visual decorator slim-dicts appended at the end.
# Arrows bind to the main element, labels still appear on it as usual.

def _expand_cylinder(slim):
    """Database/cylinder → rectangle body + top ellipse + bottom-rim arc."""
    x, y = slim.get("x", 0), slim.get("y", 0)
    w, h = slim.get("width", 120), slim.get("height", 100)
    eh = max(int(h * 0.28), 16)   # cap ellipse height

    stroke = slim.get("strokeColor", COMMON_DEFAULTS["strokeColor"])
    bg     = slim.get("backgroundColor", "#a5d8ff")
    fill   = slim.get("fillStyle", "hachure")
    sw     = slim.get("strokeWidth", COMMON_DEFAULTS["strokeWidth"])
    cap_style = {"strokeColor": stroke, "backgroundColor": bg,
                 "fillStyle": fill, "strokeWidth": sw}

    # Main element: rectangle body below the cap (keeps original id + label)
    main = {**slim, "type": "rectangle",
            "y": y + eh // 2, "height": h - eh // 2, "roundness": None}

    # Top cap ellipse (full — visible front rim + back rim)
    top = {"type": "ellipse", "x": x, "y": y, "width": w, "height": eh, **cap_style}

    # Bottom rim arc (only the front-facing lower half of the bottom ellipse)
    arc = {"type": "line",
           "x": x, "y": y + h - eh // 2,
           "points": [[0, 0], [w // 2, eh // 2], [w, 0]],
           "strokeColor": stroke, "strokeWidth": sw}

    return main, [top, arc]


def _expand_cloud(slim):
    """Cloud → 4 overlapping solid ellipses (base + 3 bumps)."""
    x, y = slim.get("x", 0), slim.get("y", 0)
    w, h = slim.get("width", 180), slim.get("height", 110)

    stroke = slim.get("strokeColor", COMMON_DEFAULTS["strokeColor"])
    bg     = slim.get("backgroundColor", "#a5d8ff")
    sw     = slim.get("strokeWidth", COMMON_DEFAULTS["strokeWidth"])
    # Solid fill so overlapping ellipses merge cleanly (no double-hachure)
    fill   = slim.get("fillStyle", "solid")
    style  = {"strokeColor": stroke, "backgroundColor": bg,
              "fillStyle": fill, "strokeWidth": sw}

    # Main element: large base (bottom, widest part — keeps original id + label)
    main = {**slim, "type": "ellipse",
            "x": x + int(w * 0.12), "y": y + int(h * 0.42),
            "width": int(w * 0.76), "height": int(h * 0.58), **style}

    decorators = [
        {"type": "ellipse", "x": x + int(w*0.00), "y": y + int(h*0.26),
         "width": int(w*0.38), "height": int(h*0.50), **style},   # left bump
        {"type": "ellipse", "x": x + int(w*0.22), "y": y + int(h*0.00),
         "width": int(w*0.40), "height": int(h*0.52), **style},   # top-center bump
        {"type": "ellipse", "x": x + int(w*0.55), "y": y + int(h*0.14),
         "width": int(w*0.40), "height": int(h*0.50), **style},   # right bump
    ]
    return main, decorators


def _expand_actor(slim):
    """Actor/person/user → stick figure (head ellipse + body/arms/legs lines).

    The head ellipse keeps the original id (used for arrow binding).
    The label (if any) is placed as standalone text below the figure.
    """
    x, y = slim.get("x", 0), slim.get("y", 0)
    w, h = slim.get("width", 50), slim.get("height", 110)

    stroke = slim.get("strokeColor", COMMON_DEFAULTS["strokeColor"])
    sw     = slim.get("strokeWidth", COMMON_DEFAULTS["strokeWidth"])
    line   = {"strokeColor": stroke, "strokeWidth": sw}

    cx = x + w // 2
    head_s = min(w, int(h * 0.26))      # head diameter
    neck_y = y + head_s
    body_h = int(h * 0.36)
    arm_y  = neck_y + int(body_h * 0.3)
    leg_y  = neck_y + body_h
    leg_h  = h - head_s - body_h

    # Main: head ellipse (keeps id + connects to arrows)
    main = {**slim, "type": "ellipse",
            "x": cx - head_s // 2, "y": y,
            "width": head_s, "height": head_s,
            "strokeColor": stroke, "strokeWidth": sw, "backgroundColor": "transparent"}
    main.pop("label", None)

    decorators = [
        {"type": "line", "x": cx, "y": neck_y,
         "points": [[0, 0], [0, body_h]], **line},
        {"type": "line", "x": cx - int(w * 0.4), "y": arm_y,
         "points": [[0, 0], [int(w * 0.8), 0]], **line},
        {"type": "line", "x": cx, "y": leg_y,
         "points": [[0, 0], [-int(w * 0.3), leg_h]], **line},
        {"type": "line", "x": cx, "y": leg_y,
         "points": [[0, 0], [int(w * 0.3), leg_h]], **line},
    ]

    # Label below the figure as standalone text
    if slim.get("label"):
        decorators.append({
            "type": "text",
            "x": x, "y": y + h + 6,
            "text": slim["label"],
            "fontSize": 14,
        })

    return main, decorators


def _expand_note(slim):
    """Sticky note → rectangle with a folded top-right corner."""
    x, y = slim.get("x", 0), slim.get("y", 0)
    w, h = slim.get("width", 160), slim.get("height", 120)
    fold  = min(int(w * 0.18), int(h * 0.22), 28)

    stroke = slim.get("strokeColor", COMMON_DEFAULTS["strokeColor"])
    bg     = slim.get("backgroundColor", "#ffec99")
    fill   = slim.get("fillStyle", "hachure")
    sw     = slim.get("strokeWidth", COMMON_DEFAULTS["strokeWidth"])

    main = {**slim, "type": "rectangle",
            "backgroundColor": bg, "fillStyle": fill,
            "strokeColor": stroke, "strokeWidth": sw}

    # Fold triangle lines (two lines making a small triangle at top-right)
    fold_corner = {"type": "line",
                   "x": x + w - fold, "y": y,
                   "points": [[0, 0], [fold, fold]],
                   "strokeColor": stroke, "strokeWidth": sw}
    fold_crease = {"type": "line",
                   "x": x + w - fold, "y": y,
                   "points": [[0, 0], [0, fold], [fold, fold]],
                   "strokeColor": stroke, "strokeWidth": sw,
                   "backgroundColor": "#ffffff", "fillStyle": "solid"}

    return main, [fold_corner, fold_crease]


SEMANTIC_BUILDERS = {
    "cylinder":  _expand_cylinder,
    "database":  _expand_cylinder,
    "db":        _expand_cylinder,
    "cloud":     _expand_cloud,
    "actor":     _expand_actor,
    "person":    _expand_actor,
    "user":      _expand_actor,
    "note":      _expand_note,
    "sticky":    _expand_note,
}


def enhance(slim):
    """
    Convert a slim JSON dict to a full excalidraw dict.

    Args:
        slim: dict with "elements" list in slim format.
              Supports semantic types: cylinder, database, cloud, actor,
              person, user, note, sticky.

    Returns:
        dict: Full excalidraw-compatible JSON
    """
    ts = _timestamp()
    slim_elements = slim.get("elements", [])

    # Pre-process: expand semantic shape types into a main primitive slim
    # (keeping the original id/index for arrow references) plus visual decorators
    # that are built and appended after labels.
    processed_slims = []
    semantic_decorator_slims = []
    for s in slim_elements:
        builder = SEMANTIC_BUILDERS.get(s.get("type", ""))
        if builder:
            main_s, extras = builder(s)
            processed_slims.append(main_s)
            semantic_decorator_slims.extend(extras)
        else:
            processed_slims.append(s)
    slim_elements = processed_slims

    # First pass: build all main elements
    full_elements = []
    for i, s in enumerate(slim_elements):
        el = _build_element(s, i, ts)
        full_elements.append(el)

    # Resolve arrow bindings — must happen before label pass so arrow
    # positions/points are finalised before midpoint labels are placed.
    _resolve_arrows(slim_elements, full_elements)

    # Second pass: create bound text elements for labels.
    extra_elements = []
    idx_counter = len(full_elements)
    for i, s in enumerate(slim_elements):
        label = s.get("label")
        if not label or s["type"] == "text":
            continue
        if not isinstance(label, str):
            continue  # Mermaid-converted elements may have dict labels — skip them

        el = full_elements[i]
        if s["type"] in ("arrow", "line"):
            # Offset label perpendicular to arrow direction so bidirectional
            # pairs (A→B + B→A) land on opposite sides and never overlap.
            cx, cy = _arrow_label_pos(el)
            text_el, text_id = _create_bound_text(el, label, idx_counter, ts,
                                                   center_x=cx, center_y=cy)
        else:
            text_el, text_id = _create_bound_text(el, label, idx_counter, ts)

        extra_elements.append(text_el)
        idx_counter += 1

        # Add text binding to parent
        text_ref = {"type": "text", "id": text_id}
        if el["boundElements"] is None:
            el["boundElements"] = []
        el["boundElements"].append(text_ref)

    # Third pass: build semantic decorator elements (pure visuals, no binding)
    for s in semantic_decorator_slims:
        decorator = _build_element(s, idx_counter, ts)
        extra_elements.append(decorator)
        idx_counter += 1

    all_elements = full_elements + extra_elements

    return {
        "type": "excalidraw",
        "version": 2,
        "source": "https://excalidraw.com",
        "elements": all_elements,
        "appState": {
            "gridSize": 20,
            "gridStep": 5,
            "gridModeEnabled": False,
            "viewBackgroundColor": "#ffffff",
            "lockedMultiSelections": {},
        },
        "files": {},
    }


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = sys.argv[1] if len(sys.argv) >= 2 else os.path.join(script_dir, "sample_slim.json")
    output_path = sys.argv[2] if len(sys.argv) >= 3 else os.path.join(script_dir, "sample_output.excalidraw")

    with open(input_path) as f:
        slim = json.load(f)

    result = enhance(slim)

    with open(output_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"Generated: {output_path} ({len(result['elements'])} elements)")


if __name__ == "__main__":
    main()
