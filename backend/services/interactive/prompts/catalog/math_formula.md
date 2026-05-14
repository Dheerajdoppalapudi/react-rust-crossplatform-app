## math_formula

**Use when**: displaying equations, derivations, physics/chemistry formulas, proofs, or any LaTeX content.

**Props**:
- `latex` (string): LaTeX string — no surrounding `$$`. Required unless `steps` provided.
- `displayMode` (boolean, optional, default `true`): block/centered vs inline.
- `steps` (array of `{ "latex": string, "label": string }`, optional): derivation sequence — built-in accordion navigation is provided automatically, no `step_controls` needed.
- `highlights` (array of `{ "term": string, "color": string, "tooltip": string }`, optional).
- `caption` (string, optional).

**Rules**: do NOT wrap latex in `$$` or `\[`. Either `latex` OR `steps` must be present.

**Multi-step accordion behavior**: when `steps` is provided, steps are revealed cumulatively using ← → arrow buttons below the formulas. Each revealed step is independently collapsible by clicking its header. No separate `step_controls` block is needed or should be added.

**Example — single formula**:
```json
{
  "id": "b2", "type": "entity", "entity_type": "math_formula",
  "props": {
    "latex": "E = mc^2",
    "highlights": [{ "term": "mc^2", "color": "#4B72FF", "tooltip": "Rest-mass energy" }],
    "caption": "Mass-energy equivalence"
  }
}
```

**Example — derivation steps (accordion)**:
```json
{
  "id": "b3", "type": "entity", "entity_type": "math_formula",
  "props": {
    "steps": [
      { "latex": "ax^2 + bx + c = 0",                        "label": "Standard form" },
      { "latex": "x^2 + \\frac{b}{a}x = -\\frac{c}{a}",      "label": "Divide by a" },
      { "latex": "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}",   "label": "Quadratic formula" }
    ],
    "caption": "Completing the square derivation"
  }
}
```
