## math_formula

**Use when**: displaying equations, derivations, physics/chemistry formulas, proofs, or any LaTeX content.

**Props**:
- `latex` (string): LaTeX string — no surrounding `$$`. Required unless `steps` provided.
- `displayMode` (boolean, optional, default `true`): block/centered vs inline.
- `steps` (array of `{ "latex": string, "label": string }`, optional): derivation sequence — pair with `step_controls`.
- `highlights` (array of `{ "term": string, "color": string, "tooltip": string }`, optional).
- `caption` (string, optional).

**Rules**: do NOT wrap latex in `$$` or `\[`. Either `latex` OR `steps` must be present.

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

**Example — derivation steps**:
```json
{
  "id": "b3", "type": "entity", "entity_type": "math_formula",
  "props": {
    "steps": [
      { "latex": "ax^2 + bx + c = 0", "label": "Standard form" },
      { "latex": "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}", "label": "Quadratic formula" }
    ]
  }
}
```
