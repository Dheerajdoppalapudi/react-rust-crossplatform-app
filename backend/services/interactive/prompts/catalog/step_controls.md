## step_controls

**Use when**: driving a `timeline` entity that has `stepReveal: true`, so the user can advance events one-by-one. Place immediately after the timeline block it controls.

**Do NOT use** with `code_walkthrough` — it has built-in step navigation.
**Do NOT use** with `math_formula` — it has built-in accordion ← → navigation.

**Props**:
- `steps` (string[], **required**): human-readable label per step. Length MUST equal the number of events in the target timeline.
- `targetEntityId` (string, **required**): exact `id` of the `timeline` block this controls.

**Example**:
```json
{
  "id": "b10", "type": "entity", "entity_type": "step_controls",
  "props": {
    "steps": ["1905: Special Relativity", "1915: General Relativity", "1921: Nobel Prize"],
    "targetEntityId": "b9"
  }
}
```
