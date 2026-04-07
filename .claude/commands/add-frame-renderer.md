# add-frame-renderer

You are adding a new frame renderer to the Zenith generation pipeline. This connects a new intent type to a new rendering strategy. Follow all four steps in order.

---

## Background: how the pipeline routes

```
POST /api/image_generation
  → generation_service.py → run_generation_pipeline()
      → Stage 1A: planner.create_vocab_plan() → intent_type string
      → Stage 2:  _run_frame_generation()
            if intent_type in SVG_INTENT_TYPES      → svg_generator
            elif intent_type in MANIM_INTENT_TYPES  → manim_generator
            elif intent_type in MERMAID_INTENT_TYPES → mermaid_generator
            else                                     → Excalidraw fallback
```

Current intent sets (all in `core/config.py`):
- `SVG_INTENT_TYPES` — `illustration`, `concept_analogy`, `comparison`
- `MANIM_INTENT_TYPES` — `math`
- `MERMAID_INTENT_TYPES` — `process`, `architecture`, `timeline`

---

## Step 1 — Create the generator module

**Path:** `backend/services/Frame_generation/<type>/<type>_generator.py`

**Required contract — your generator must return one of these:**

```python
# Option A: image-based output (PNG files)
async def generate_<type>_frames(plan: dict, output_dir: str) -> list[str]:
    """Returns list of absolute paths to PNG files, one per frame."""
    ...

# Option B: video-based output (MP4 files)
async def generate_<type>_frames(plan: dict, output_dir: str) -> list[str]:
    """Returns list of absolute paths to MP4 files, one per frame."""
    ...

# Option C: slim JSON (for Excalidraw post-processing)
async def generate_<type>_frames(plan: dict, output_dir: str) -> list[dict]:
    """Returns list of slim JSON dicts in the Excalidraw frame schema."""
    ...
```

**Reference implementation:** read `services/Frame_generation/svg/svg_generator.py` — it is the canonical example.

**Rules:**
- Use `logging.getLogger(__name__)` — no `print()`
- Read all config (paths, model names) from `core/config.py`
- Raise `RuntimeError` or `ValueError` on generation failure — let the caller handle
- Do not import from `fastapi` or any router — this is a pure service module

---

## Step 2 — Register the intent type

**File:** `backend/core/config.py`

Add the new intent string to the correct frozenset:

```python
# If it belongs to an existing category:
SVG_INTENT_TYPES = frozenset({"illustration", "concept_analogy", "comparison", "your_new_type"})

# If it's a genuinely new category:
YOUR_NEW_INTENT_TYPES = frozenset({"your_new_type"})
```

If you created a new frozenset, export it (it's already exported by being a module-level constant — just make sure the name follows the `<CATEGORY>_INTENT_TYPES` pattern).

---

## Step 3 — Add the routing branch

**File:** `backend/services/generation_service.py → _run_frame_generation()`

Add an `elif` branch in the correct position (before the `else` fallback):

```python
from core.config import YOUR_NEW_INTENT_TYPES
from services.Frame_generation.<type> import <type>_generator

async def _run_frame_generation(intent_type, plan, output_dir):
    if intent_type in SVG_INTENT_TYPES:
        return await svg_generator.generate_svg_frames(plan, output_dir)
    elif intent_type in MANIM_INTENT_TYPES:
        return await manim_generator.generate_manim_frames(plan, output_dir)
    elif intent_type in MERMAID_INTENT_TYPES:
        return await mermaid_generator.generate_mermaid_frames(plan, output_dir)
    elif intent_type in YOUR_NEW_INTENT_TYPES:          # ← add here
        return await <type>_generator.generate_<type>_frames(plan, output_dir)
    else:
        return await planner.generate_all_frames(plan)  # Excalidraw fallback
```

---

## Step 4 — Update the planner vocabulary (if needed)

**File:** `backend/services/Frame_generation/planner.py`

If your new intent string is not already a possible output of the Stage 1A classifier, add it to the vocabulary in the system prompt or the intent validation logic.

Check: after adding, confirm the planner can actually return your new intent type when given an appropriate prompt.

---

## Step 5 — Self-verification checklist

- [ ] Generator module exists at `services/Frame_generation/<type>/<type>_generator.py`
- [ ] Generator returns the correct contract type (list of paths or list of dicts)
- [ ] Intent string added to correct frozenset in `core/config.py`
- [ ] Routing `elif` branch added in `generation_service.py → _run_frame_generation()`
- [ ] Planner vocabulary updated if the new intent type is genuinely new
- [ ] No `print()` calls in the new generator
- [ ] No hardcoded paths — uses `core/config.py` constants

**Integration test:**

```bash
# Start backend, then:
curl -X POST http://localhost:8000/api/image_generation \
  -H "Authorization: Bearer <token>" \
  -F "message=<prompt that triggers your new intent>"

# Confirm in logs:
# - intent_type shows your new type
# - your generator was called
# - frames were produced
```
