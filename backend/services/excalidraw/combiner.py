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

# Vertical breathing room added above each frame's content after normalization.
# Prevents frames from starting flush at y=0 on the canvas.
FRAME_TOP_PADDING = 40


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
    Shift elements so their bounding box starts at (0, FRAME_TOP_PADDING).

    This removes whatever arbitrary offset the LLM placed the frame at
    (e.g. all elements starting at x=200) before we apply the slot offset.
    The top padding gives visual breathing room above the frame content.

    Returns (normalized_elements, frame_width, frame_height) where:
      frame_width  = actual pixel width of the content (used to center captions)
      frame_height = bottom y of the content including top padding
                     (used to position the caption below the frame)
    """
    if not elements:
        return [], 800, 600 + FRAME_TOP_PADDING

    min_x, min_y, max_x, max_y = _bbox(elements)
    frame_width = max_x - min_x
    frame_height = (max_y - min_y) + FRAME_TOP_PADDING

    normalized = []
    for el in elements:
        el = dict(el)  # shallow copy — don't mutate the original
        el["x"] = el.get("x", 0) - min_x
        el["y"] = el.get("y", 0) - min_y + FRAME_TOP_PADDING
        normalized.append(el)

    return normalized, frame_width, frame_height


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
    Add a frame-specific prefix to every element ID and to all arrow
    from/to string references within those elements.

    This prevents ID collisions when frames are merged — if frame 0 has
    an element id="car" and frame 1 also has id="car", after prefixing
    they become "f0_car" and "f1_car" and the enhancer resolves them
    independently.

    Only string IDs are prefixed. Integer from/to refs (index-based) are
    left unchanged — they already point into the correct position in their
    own frame's element list, and after _fix_int_refs they will be adjusted
    to absolute indices in the combined list.
    """
    result = []
    for el in elements:
        el = dict(el)

        if "id" in el and isinstance(el["id"], str):
            el["id"] = f"{prefix}{el['id']}"

        if "from" in el and isinstance(el["from"], str):
            el["from"] = f"{prefix}{el['from']}"

        if "to" in el and isinstance(el["to"], str):
            el["to"] = f"{prefix}{el['to']}"

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

        # Step 2 — normalize: origin → (0, FRAME_TOP_PADDING), returns actual dimensions
        elements, frame_width, frame_height = _normalize(elements)

        # Step 3 — fix any integer from/to refs to be absolute in combined list
        elements = _fix_int_refs(elements, running_count)

        # Step 4 — shift the frame to its horizontal slot on the canvas
        slot_x = i * (FRAME_SLOT_WIDTH + FRAME_GAP)
        elements = _shift_xy(elements, slot_x)

        all_elements.extend(elements)
        running_count += len(elements)

        # Step 5 — add the caption text below this frame, centered on actual content
        if caption:
            caption_el = {
                "type": "text",
                "x": slot_x + frame_width / 2,   # centered on real content, not slot
                "y": frame_height + CAPTION_Y_OFFSET,
                "text": caption,
                "fontSize": 20,
            }
            all_elements.append(caption_el)
            running_count += 1  # caption is also an element in the combined list

    return {"elements": all_elements}
