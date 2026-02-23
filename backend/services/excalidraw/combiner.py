"""
Combiner — Stage 3 of the multi-frame pipeline.

Takes N slim JSON dicts (one per frame) and merges them into a single
slim JSON that the excalidraw enhancer can process as normal.

What it does to each frame:
  1. Prefixes every element ID with "f{i}_" to avoid ID collisions when
     frames are merged (e.g. two frames both having id="box" would conflict).
  2. Updates arrow from/to string references to use the same prefix.
  3. Normalizes each frame's elements so their top-left corner is at (0, 0).
  4. Shifts the normalized frame to its horizontal slot position on the canvas.
  5. Appends a caption text element below each frame.

The combined result is a standard slim JSON — the enhancer runs on it
unchanged, exactly as if the user had drawn one big diagram.
"""

# Width of each frame's slot on the combined canvas.
# Frames generated from the prompt template fit within ~1400px wide,
# so this gives each frame its own column with room to spare.
FRAME_SLOT_WIDTH = 1400

# Horizontal gap between frame slots (visual breathing room).
FRAME_GAP = 200

# How far below the frame's bottom edge the caption text appears.
CAPTION_Y_OFFSET = 60


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _bbox(elements: list) -> tuple:
    """
    Compute the bounding box of a list of elements.
    Returns (min_x, min_y, max_x, max_y).

    For arrow/line elements the width/height may be 0, so we use
    max(width, 0) to avoid shrinking the box below the origin point.
    """
    if not elements:
        return 0, 0, 800, 600

    min_x = min(el.get("x", 0) for el in elements)
    min_y = min(el.get("y", 0) for el in elements)
    max_x = max(el.get("x", 0) + max(el.get("width", 0), 0) for el in elements)
    max_y = max(el.get("y", 0) + max(el.get("height", 0), 0) for el in elements)

    return min_x, min_y, max_x, max_y


def _normalize(elements: list) -> tuple:
    """
    Shift elements so their bounding box starts at (0, 0).

    This removes whatever arbitrary offset the LLM placed the frame at
    (e.g. all elements starting at x=200) before we apply the slot offset.

    Returns (normalized_elements, frame_height) where frame_height is the
    pixel height of the frame — used to position the caption below it.
    """
    if not elements:
        return [], 600

    min_x, min_y, _, max_y = _bbox(elements)
    frame_height = max_y - min_y

    normalized = []
    for el in elements:
        el = dict(el)  # shallow copy — don't mutate the original
        el["x"] = el.get("x", 0) - min_x
        el["y"] = el.get("y", 0) - min_y
        normalized.append(el)

    return normalized, frame_height


def _shift_xy(elements: list, dx: float, dy: float = 0) -> list:
    """
    Shift every element's (x, y) position by (dx, dy).

    Arrow/line points are stored as offsets relative to the element's
    own (x, y), so they do NOT need to be adjusted here — only the
    anchor (x, y) of the element moves.
    """
    shifted = []
    for el in elements:
        el = dict(el)
        el["x"] = el.get("x", 0) + dx
        el["y"] = el.get("y", 0) + dy
        shifted.append(el)
    return shifted


def _prefix_ids(elements: list, prefix: str) -> list:
    """
    Add a frame-specific prefix to EVERY element ID and to ALL cross-element
    references within those elements.

    This prevents ID collisions when frames are merged — if frame 0 has
    an element id="car" and frame 1 also has id="car", after prefixing
    they become "f0_car" and "f1_car" and the enhancer resolves them
    independently.

    Slim JSON elements only use id / from / to.

    Already-complete Excalidraw elements (produced by the Mermaid converter)
    carry four additional reference fields that must all be updated in lockstep,
    otherwise bound text elements become orphaned and disappear:

      containerId        — text element pointing to its parent shape
      boundElements[].id — shape/arrow listing its bound text or arrow children
      startBinding.elementId — arrow pointing to its start-anchor shape
      endBinding.elementId   — arrow pointing to its end-anchor shape

    Only string IDs are prefixed. Integer from/to refs (index-based) are
    left unchanged — they are adjusted to absolute indices by _fix_int_refs.
    """
    # Collect every string ID that exists in this frame so we only update
    # references that actually point to something within the frame.
    frame_ids = {el.get("id") for el in elements if isinstance(el.get("id"), str)}

    result = []
    for el in elements:
        el = dict(el)

        # Primary ID
        if isinstance(el.get("id"), str):
            el["id"] = f"{prefix}{el['id']}"

        # Slim-JSON arrow references
        if isinstance(el.get("from"), str):
            el["from"] = f"{prefix}{el['from']}"
        if isinstance(el.get("to"), str):
            el["to"] = f"{prefix}{el['to']}"

        # Text element → parent shape (Mermaid path)
        if isinstance(el.get("containerId"), str) and el["containerId"] in frame_ids:
            el["containerId"] = f"{prefix}{el['containerId']}"

        # Shape / arrow → bound children (Mermaid path)
        if isinstance(el.get("boundElements"), list):
            new_bound = []
            for ref in el["boundElements"]:
                ref = dict(ref)
                if isinstance(ref.get("id"), str) and ref["id"] in frame_ids:
                    ref["id"] = f"{prefix}{ref['id']}"
                new_bound.append(ref)
            el["boundElements"] = new_bound

        # Arrow → anchor shapes (Mermaid path)
        for bkey in ("startBinding", "endBinding"):
            binding = el.get(bkey)
            if isinstance(binding, dict):
                binding = dict(binding)
                if isinstance(binding.get("elementId"), str) and binding["elementId"] in frame_ids:
                    binding["elementId"] = f"{prefix}{binding['elementId']}"
                el[bkey] = binding

        result.append(el)
    return result


def _fix_int_refs(elements: list, offset: int) -> list:
    """
    Convert integer from/to arrow references from frame-local indices to
    global indices in the combined element list.

    When frame k's elements are placed starting at position `offset` in the
    combined list, an arrow that says from=0 (meaning "the first element of
    this frame") must become from=offset+0 so the enhancer finds the right
    element in the merged array.
    """
    result = []
    for el in elements:
        el = dict(el)
        if "from" in el and isinstance(el["from"], int):
            el["from"] = el["from"] + offset
        if "to" in el and isinstance(el["to"], int):
            el["to"] = el["to"] + offset
        result.append(el)
    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def combine_frames(frame_slims: list, captions: list) -> dict:
    """
    Merge N slim JSON dicts into one, placing each frame side by side.

    Args:
        frame_slims: List of slim JSON dicts (one per frame), in order.
        captions:    List of caption strings (one per frame), in order.

    Returns:
        A single slim JSON dict — {"elements": [...]} — ready for the enhancer.

    Layout:
        Frame 0 | gap | Frame 1 | gap | Frame 2 ...
        [caption 0]   [caption 1]     [caption 2]
    """
    all_elements = []
    running_count = 0  # tracks how many elements have been added so far
                       # used to convert integer from/to refs to absolute indices

    for i, (slim, caption) in enumerate(zip(frame_slims, captions)):
        elements = slim.get("elements", [])
        prefix = f"f{i}_"

        # Step 1 — prefix all string IDs to avoid cross-frame collisions
        elements = _prefix_ids(elements, prefix)

        # Step 2 — normalize: move the frame's origin to (0, 0)
        elements, frame_height = _normalize(elements)

        # Step 3 — fix any integer from/to refs to be absolute in combined list
        elements = _fix_int_refs(elements, running_count)

        # Step 4 — shift the frame to its horizontal slot on the canvas
        slot_x = i * (FRAME_SLOT_WIDTH + FRAME_GAP)
        elements = _shift_xy(elements, slot_x)

        all_elements.extend(elements)
        running_count += len(elements)

        # Step 5 — add the caption text below this frame
        if caption:
            caption_el = {
                "type": "text",
                "x": slot_x + FRAME_SLOT_WIDTH / 2,
                "y": frame_height + CAPTION_Y_OFFSET,
                "text": caption,
                "fontSize": 20,
            }
            all_elements.append(caption_el)
            running_count += 1  # caption is also an element in the combined list

    return {"elements": all_elements}
