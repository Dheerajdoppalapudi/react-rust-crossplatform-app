## step_controls

**Use when**: pairing with `code_walkthrough` or `math_formula` (with steps) so the user advances manually. Place immediately after the entity it controls.

**Props**:
- `steps` (string[], **required**): human-readable label per step. Length MUST equal the target's step count.
- `targetEntityId` (string, **required**): exact `id` of the `code_walkthrough` or `math_formula` block this controls.

**Example**:
```json
{
  "id": "b4", "type": "entity", "entity_type": "step_controls",
  "props": {
    "steps": ["Define function", "Cache length", "Outer loop", "Inner loop", "Swap"],
    "targetEntityId": "b3"
  }
}
```
