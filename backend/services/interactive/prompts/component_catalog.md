## Component Catalog

The following entity types are available as pre-built interactive components.

### Entity block format — ALWAYS use this exact shape

Every entity block in `blocks[]` MUST have ALL THREE fields:

```json
{
  "id":          "<unique block id, e.g. b2>",
  "type":        "entity",
  "entity_type": "<one of the types listed below>",
  "props":       { ... }
}
```

- `"type"` is ALWAYS the literal string `"entity"` — never the entity type name.
- `"entity_type"` carries the component name (`"mermaid_viewer"`, `"code_walkthrough"`, etc.).
- Omitting either field or merging them is invalid and will be rejected.

---

## mermaid_viewer

**Use when**: the concept is best explained as a flow diagram, sequence diagram, state machine, graph, or architecture diagram.

**Props**:
- `diagram` (string, **required**): valid Mermaid syntax. Supported diagram types: `graph LR`, `graph TD`, `flowchart LR`, `flowchart TD`, `sequenceDiagram`, `stateDiagram-v2`.
- `caption` (string, optional): short label shown below the diagram.

**Line breaks in labels**: use `<br/>`, never `\n`. Mermaid silently ignores `\n` inside label text. `<br/>` renders a real line break in flowchart nodes, sequence notes, and annotations.
- Correct: `"GET /index.html<br/>HTTP/1.1"`
- Wrong:   `"GET /index.html\nHTTP/1.1"`

**Example**:
```json
{
  "id":          "b2",
  "type":        "entity",
  "entity_type": "mermaid_viewer",
  "props": {
    "diagram": "sequenceDiagram\n  participant C as Client\n  participant S as Server\n  C->>S: GET /index.html\n  S-->>C: 200 OK + HTML",
    "caption": "HTTP request-response cycle"
  }
}
```

---

## code_walkthrough

**Use when**: explaining an algorithm, function, or code pattern step by step, where each step highlights a specific line and explains what it does.

**Props**:
- `language` (string, **required**): syntax highlighting language — `"python"`, `"javascript"`, `"typescript"`, `"java"`, `"cpp"`, `"go"`, `"bash"`, `"sql"`, etc.
- `code` (string, **required**): the complete code to display. Use `\n` for newlines, `    ` (4 spaces) for indentation.
- `steps` (array of `{ "line": int, "explanation": string }`, **required**): one entry per teaching step. `line` is 1-indexed. Each step highlights that line and shows the explanation as a caption. Must have at least 2 steps.

**Notes**:
- Always pair with a `step_controls` block placed immediately after.
- The `targetEntityId` in `step_controls` must exactly match this block's `id`.

**Example**:
```json
{
  "id":          "b3",
  "type":        "entity",
  "entity_type": "code_walkthrough",
  "props": {
    "language": "python",
    "code": "def bubble_sort(arr):\n    n = len(arr)\n    for i in range(n):\n        for j in range(n - i - 1):\n            if arr[j] > arr[j+1]:\n                arr[j], arr[j+1] = arr[j+1], arr[j]",
    "steps": [
      { "line": 1, "explanation": "Function receives the list to sort in-place." },
      { "line": 2, "explanation": "Cache the length — used to bound both loops." },
      { "line": 3, "explanation": "Outer loop: one full pass per element ensures the largest unsorted value bubbles to its final position." },
      { "line": 4, "explanation": "Inner loop shrinks each pass by i — elements already bubbled to the right are in their final positions." },
      { "line": 5, "explanation": "Compare adjacent pair — if out of order, swap." }
    ]
  }
}
```

---

## step_controls

**Use when**: pairing with a `code_walkthrough` so the user can advance steps manually. Always place this block immediately after the `code_walkthrough` it controls.

**Props**:
- `steps` (string[], **required**): human-readable label for each step. Array length MUST equal the number of steps in the target `code_walkthrough`.
- `targetEntityId` (string, **required**): the exact `id` of the `code_walkthrough` block this controls.

**Example**:
```json
{
  "id":          "b4",
  "type":        "entity",
  "entity_type": "step_controls",
  "props": {
    "steps": ["Define function", "Cache length", "Outer loop", "Inner loop", "Swap"],
    "targetEntityId": "b3"
  }
}
```

---

## math_formula

**Use when**: displaying mathematical equations, derivations, proofs, physics formulas, chemistry equilibria, or any LaTeX content — especially step-by-step derivations.

**Props**:
- `latex` (string, required unless `steps` provided): LaTeX formula string (no surrounding `$$`).
- `displayMode` (boolean, optional, default `true`): `true` = block/centered; `false` = inline.
- `steps` (array of `{ "latex": string, "label": string }`, optional): derivation sequence — pairs with a `step_controls` block for interactive stepping.
- `highlights` (array of `{ "term": string, "color": string, "tooltip": string }`, optional): color-highlight specific TeX tokens in the rendered output.
- `caption` (string, optional): muted label below the formula.
- `fontSize` (string, optional, default `"1.2rem"`): CSS font-size override.

**Rules**:
- Either `latex` OR `steps` must be present (not both required, but at least one).
- When using `steps`, always pair with a `step_controls` block immediately after.
- Do NOT wrap latex in `$$` or `\[` — the component adds delimiters.

**Example — single formula with highlights**:
```json
{
  "id":          "b2",
  "type":        "entity",
  "entity_type": "math_formula",
  "props": {
    "latex":    "E = mc^2",
    "highlights": [
      { "term": "mc^2", "color": "#4B72FF", "tooltip": "Rest-mass energy" }
    ],
    "caption": "Einstein's mass-energy equivalence"
  }
}
```

**Example — derivation steps**:
```json
{
  "id":          "b3",
  "type":        "entity",
  "entity_type": "math_formula",
  "props": {
    "steps": [
      { "latex": "ax^2 + bx + c = 0",               "label": "Start with standard form" },
      { "latex": "x^2 + \\frac{b}{a}x = -\\frac{c}{a}", "label": "Divide by a" },
      { "latex": "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}", "label": "Apply quadratic formula" }
    ]
  }
}
```

---

## chart

**Use when**: visualizing quantitative data — comparisons, trends, distributions, proportions, correlations, or mixed series.

**Props**:
- `type` (string, **required**): `"bar"` | `"line"` | `"area"` | `"scatter"` | `"pie"` | `"radar"` | `"composed"`
- `data` (array, **required**): array of row objects, e.g. `[{ "month": "Jan", "revenue": 4000 }]`
- `series` (array of `{ "dataKey": string, "name": string, "color": string, "type": string }`, required except pie): what to plot; for composed chart, each item has `type: "bar"|"line"|"area"`.
- `xKey` (string, required except pie): data key for x-axis.
- `pieKey` (string, default `"value"`): value key for pie charts.
- `nameKey` (string, default `"name"`): label key for pie charts.
- `title` (string, optional): chart title above the chart.
- `xLabel` / `yLabel` (string, optional): axis labels.
- `height` (number, optional, default `280`).
- `stacked` (boolean, optional): stack bar/area series.
- `layout` (string, optional): `"horizontal"` (default) | `"vertical"` for bar charts.
- `logScale` (boolean, optional): log scale on y-axis.
- `showLegend` / `showGrid` (boolean, optional, default `true`).
- `referenceLines` (array of `{ "value": number, "label": string, "axis": "x"|"y", "color": string }`, optional).
- `colors` (string[], optional): override color rotation.
- `caption` (string, optional).

**Example — bar chart**:
```json
{
  "id":          "b4",
  "type":        "entity",
  "entity_type": "chart",
  "props": {
    "type":   "bar",
    "data":   [
      { "month": "Jan", "revenue": 4200, "cost": 2800 },
      { "month": "Feb", "revenue": 5100, "cost": 3100 },
      { "month": "Mar", "revenue": 4700, "cost": 2600 }
    ],
    "series": [
      { "dataKey": "revenue", "name": "Revenue" },
      { "dataKey": "cost",    "name": "Cost" }
    ],
    "xKey": "month",
    "title": "Q1 Revenue vs Cost",
    "referenceLines": [{ "value": 3000, "label": "Break-even", "axis": "y" }],
    "caption": "Monthly figures in USD"
  }
}
```

**Example — pie chart**:
```json
{
  "id":          "b5",
  "type":        "entity",
  "entity_type": "chart",
  "props": {
    "type":    "pie",
    "data":    [
      { "name": "Proteins", "value": 35 },
      { "name": "Fats",     "value": 30 },
      { "name": "Carbs",    "value": 35 }
    ],
    "pieKey":  "value",
    "nameKey": "name",
    "title":   "Macronutrient breakdown"
  }
}
```

---

## graph_canvas

**Use when**: the concept involves nodes and edges — trees, DAGs, state machines, dependency graphs, network topologies, call graphs, entity relationships.

**Props**:
- `nodes` (array, **required**): `[{ "id": string, "label": string, "type": "input"|"default"|"output", "x": number, "y": number }]`. `x`/`y` only needed when `layout: "manual"`.
- `edges` (array, **required**): `[{ "id": string, "source": string, "target": string, "label": string, "animated": boolean }]`.
- `layout` (string, optional, default `"dagre-lr"`): `"dagre-lr"` | `"dagre-tb"` | `"manual"`.
- `directed` (boolean, optional, default `true`): show arrowheads.
- `height` (number, optional, default `340`).
- `showMinimap` / `showControls` (boolean, optional).
- `stepHighlights` (array of `{ "nodes": string[], "edges": string[] }`, optional): per-step highlight sets — pairs with `step_controls`.
- `nodeColors` (object `{ [nodeId]: colorString }`, optional): per-node color overrides.
- `caption` (string, optional).

**Example**:
```json
{
  "id":          "b6",
  "type":        "entity",
  "entity_type": "graph_canvas",
  "props": {
    "nodes": [
      { "id": "A", "label": "Request",  "type": "input"   },
      { "id": "B", "label": "Auth",     "type": "default" },
      { "id": "C", "label": "Handler",  "type": "default" },
      { "id": "D", "label": "Response", "type": "output"  }
    ],
    "edges": [
      { "id": "e1", "source": "A", "target": "B", "label": "JWT?" },
      { "id": "e2", "source": "B", "target": "C" },
      { "id": "e3", "source": "C", "target": "D" }
    ],
    "layout": "dagre-lr",
    "stepHighlights": [
      { "nodes": ["A"],           "edges": []           },
      { "nodes": ["A","B"],       "edges": ["e1"]       },
      { "nodes": ["A","B","C"],   "edges": ["e1","e2"]  },
      { "nodes": ["A","B","C","D"],"edges": ["e1","e2","e3"] }
    ],
    "caption": "Request lifecycle"
  }
}
```

---

## molecule_viewer

**Use when**: displaying molecular structures — organic molecules (SMILES), proteins (PDB), drug-receptor complexes, crystal structures.

**Props**:
- `format` (string, **required**): `"smiles"` | `"pdb"` | `"sdf"` | `"mol2"` | `"xyz"` | `"cif"`.
- `data` (string, **required**): molecule data in the specified format (e.g. `"CCO"` for ethanol in SMILES).
- `style` (string, optional, default `"ballAndStick"`): `"ballAndStick"` | `"stick"` | `"sphere"` | `"line"` | `"cartoon"` | `"surface"`.
- `colorScheme` (string, optional, default `"element"`): `"element"` | `"residue"` | `"chain"` | `"spectrum"` | `"ssPyMOL"` | `"rasmol"`.
- `highlights` (array of `{ "selection": object, "style": string, "color": string }`, optional): extra style overlays for specific atoms/residues.
- `labels` (array of `{ "selection": object, "text": string, "fontSize": number, "color": string }`, optional): floating atom labels.
- `surfaces` (array of `{ "type": "VDW"|"SAS"|"SES", "opacity": number, "color": string }`, optional): molecular surface overlays.
- `spin` (boolean, optional, default `false`): auto-rotate.
- `spinSpeed` (number, optional, default `1`).
- `zoom` (number, optional, default `1.0`): zoom multiplier.
- `backgroundColor` (string, optional, default `"transparent"`).
- `height` (number, optional, default `360`).
- `caption` (string, optional).

**Example**:
```json
{
  "id":          "b7",
  "type":        "entity",
  "entity_type": "molecule_viewer",
  "props": {
    "format":      "smiles",
    "data":        "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
    "style":       "ballAndStick",
    "colorScheme": "element",
    "spin":        true,
    "caption":     "Caffeine molecule"
  }
}
```

---

## map_viewer

**Use when**: geographic content — showing locations, routes, regions, city comparisons, historical spread, or any spatial data on a map.

**Props**:
- `center` (array `[lat, lng]`, **required**): map center coordinates.
- `zoom` (number, optional, default `4`): initial zoom level (1=world, 10=city, 15=street).
- `height` (number, optional, default `380`).
- `tileLayer` (string, optional, default `"osm"`): `"osm"` | `"satellite"` | `"terrain"` | `"dark"` | `"light"` | `"none"`.
- `markers` (array of `{ "lat": number, "lng": number, "label": string, "color": string, "tooltip": string }`, optional).
- `paths` (array of `{ "points": [[lat,lng],...], "color": string, "weight": number, "label": string }`, optional): polylines/routes.
- `polygons` (array of `{ "points": [[lat,lng],...], "fillColor": string, "opacity": number, "strokeColor": string, "label": string, "tooltip": string }`, optional): filled regions.
- `circles` (array of `{ "lat": number, "lng": number, "radius": number, "color": string, "tooltip": string }`, optional): radius circles in meters.
- `bounds` ([[lat,lng],[lat,lng]], optional): auto-fit map to these SW/NE bounds.
- `caption` (string, optional).

**Example**:
```json
{
  "id":          "b8",
  "type":        "entity",
  "entity_type": "map_viewer",
  "props": {
    "center": [48.8566, 2.3522],
    "zoom": 5,
    "tileLayer": "light",
    "markers": [
      { "lat": 48.8566, "lng":  2.3522, "label": "Paris",  "color": "#4B72FF", "tooltip": "Capital of France" },
      { "lat": 51.5074, "lng": -0.1278, "label": "London", "color": "#e879f9", "tooltip": "Capital of UK" },
      { "lat": 52.5200, "lng": 13.4050, "label": "Berlin", "color": "#f59e0b", "tooltip": "Capital of Germany" }
    ],
    "caption": "Major European capitals"
  }
}
```

---

## timeline

**Use when**: chronological content — historical events, product roadmaps, biographies, scientific discoveries, project milestones.

**Props**:
- `events` (array, **required**): `[{ "date": string, "title": string, "description": string, "category": string, "color": string, "icon": string }]`. `date`, `title` required per event; others optional.
- `orientation` (string, optional, default `"vertical"`): `"vertical"` | `"horizontal"`.
- `stepReveal` (boolean, optional, default `false`): if true, reveals events one-by-one as step advances — pairs with `step_controls`.
- `groupBy` (string, optional): field name to group events into labeled sections (e.g. `"category"`).
- `caption` (string, optional).

**Example**:
```json
{
  "id":          "b9",
  "type":        "entity",
  "entity_type": "timeline",
  "props": {
    "events": [
      { "date": "1905", "title": "Special Relativity",   "description": "Einstein publishes the special theory of relativity.", "category": "Physics",  "color": "#4B72FF", "icon": "⚡" },
      { "date": "1907", "title": "Equivalence Principle","description": "Gravity and acceleration are indistinguishable.", "category": "Physics",  "color": "#4B72FF", "icon": "🍎" },
      { "date": "1915", "title": "General Relativity",   "description": "Spacetime curves around mass and energy.",         "category": "Physics",  "color": "#e879f9", "icon": "🌌" },
      { "date": "1921", "title": "Nobel Prize",          "description": "Awarded for the photoelectric effect discovery.",   "category": "Honours", "color": "#f59e0b", "icon": "🏅" }
    ],
    "orientation": "vertical",
    "groupBy": "category",
    "caption": "Einstein's major discoveries"
  }
}
```

---

## freeform_html (escape hatch)

**Use when**: no pre-built type covers the need — for example, a physics simulation with a canvas animation, an interactive graph, or any bespoke visual requiring custom JavaScript. **Prefer pre-built types whenever they fit** — `freeform_html` adds 2–3 s of latency.

**Props**:
- `spec` (string, **required**): a detailed plain-English description of the widget. This becomes the prompt sent to a codegen LLM. Be specific: describe sliders, buttons, what is drawn on the canvas, what parameters are exposed, what the animation does.

**Constraints the codegen LLM must respect** (mention in spec if relevant):
- Self-contained HTML only — no CDN imports, no `fetch()`.
- Runs inside `<iframe sandbox="allow-scripts">` — no `localStorage`, no cookies, no cross-origin access.

**Example**:
```json
{
  "id":          "b5",
  "type":        "entity",
  "entity_type": "freeform_html",
  "props": {
    "spec": "A Canvas 2D projectile motion simulator. Sliders for initial speed (10–80 m/s) and launch angle (5–85°). Draw the parabolic trajectory in blue, mark peak height with a red dot, show ghost trails for the last 3 launches in grey. Live readouts for current height, horizontal distance, and elapsed time. Animate with requestAnimationFrame. No external libraries."
  }
}
```

---

## table_viewer

**Use when**: presenting structured data in rows and columns — algorithm complexity comparisons, language feature tables, API reference tables, benchmark results, or any tabular comparison.

**Props**:
- `columns` (array, **required**): `[{ "key": string, "label": string, "width": string }]`. `width` is optional CSS width (e.g. `"20%"`, `"120px"`).
- `rows` (array, **required**): array of objects; each key matches a column `key`.
- `caption` (string, optional): label shown below the table.
- `sortable` (boolean, optional, default `true`): click column headers to sort.
- `striped` (boolean, optional, default `true`): alternating row shading.
- `highlightRows` (number[], optional): array of row indices (0-based) to highlight in accent color.

**Example**:
```json
{
  "id":          "b2",
  "type":        "entity",
  "entity_type": "table_viewer",
  "props": {
    "columns": [
      { "key": "lang",         "label": "Language",     "width": "20%" },
      { "key": "complexity",   "label": "Time (avg)",   "width": "20%" },
      { "key": "space",        "label": "Space",        "width": "20%" },
      { "key": "stable",       "label": "Stable?",      "width": "20%" },
      { "key": "notes",        "label": "Notes",        "width": "20%" }
    ],
    "rows": [
      { "lang": "Merge Sort",  "complexity": "O(n log n)", "space": "O(n)",    "stable": "Yes", "notes": "Divide and conquer" },
      { "lang": "Quick Sort",  "complexity": "O(n log n)", "space": "O(log n)","stable": "No",  "notes": "In-place, fast in practice" },
      { "lang": "Heap Sort",   "complexity": "O(n log n)", "space": "O(1)",    "stable": "No",  "notes": "Not cache-friendly" },
      { "lang": "Bubble Sort", "complexity": "O(n²)",      "space": "O(1)",    "stable": "Yes", "notes": "Avoid for large n" }
    ],
    "highlightRows": [0, 1],
    "caption": "Sorting algorithm comparison"
  }
}
```

---

## terminal_output

**Use when**: showing shell commands and their output — CLI walkthroughs, build steps, git commands, debugging sessions, or any sequence of commands with expected output.

**Props**:
- `blocks` (array, **required**): sequence of `{ "type": "command"|"output"|"comment", "content": string }`.
  - `"command"`: shown with `$` prompt in blue — the command the user types.
  - `"output"`: shown in muted grey — what the terminal prints.
  - `"comment"`: shown in italic grey with `#` prefix — an annotation explaining what happened.
- `shell` (string, optional, default `"bash"`): label shown in the title bar.
- `title` (string, optional): overrides the shell label in the title bar.
- `caption` (string, optional): label shown below the terminal.

**Example**:
```json
{
  "id":          "b3",
  "type":        "entity",
  "entity_type": "terminal_output",
  "props": {
    "shell": "bash",
    "blocks": [
      { "type": "comment", "content": "View the last 5 commits" },
      { "type": "command", "content": "git log --oneline -5" },
      { "type": "output",  "content": "a3f2b1c Add OAuth flow\n8d7e9a2 Fix session bug\nc1e0f44 Refactor auth middleware\n3b8a21d Initial project setup\nf2c91bb Add README" },
      { "type": "comment", "content": "Undo the last commit but keep changes staged" },
      { "type": "command", "content": "git reset --soft HEAD~1" },
      { "type": "comment", "content": "Changes are now staged, ready to re-commit" }
    ],
    "caption": "Git undo strategies"
  }
}
```

---

## diff_viewer

**Use when**: showing code before and after a change — refactors, bug fixes, adding type annotations, converting to a new API, or any side-by-side code comparison.

**Props**:
- `before` (string, **required**): the original code. Use `\n` for newlines.
- `after` (string, **required**): the updated code. Use `\n` for newlines.
- `language` (string, optional, default `"python"`): syntax highlighting language — same values as `code_walkthrough`.
- `mode` (string, optional, default `"split"`): `"split"` = side-by-side panels; `"unified"` = single panel with +/- prefixes.
- `caption` (string, optional): label shown below the diff.

**Example**:
```json
{
  "id":          "b4",
  "type":        "entity",
  "entity_type": "diff_viewer",
  "props": {
    "before":   "def add(a, b):\n    return a + b",
    "after":    "def add(a: int, b: int) -> int:\n    \"\"\"Add two integers.\"\"\"\n    return a + b",
    "language": "python",
    "mode":     "split",
    "caption":  "Adding type hints and a docstring"
  }
}
```

---

## p5_sketch

**Use when**: a looping physics or math animation would explain the concept better than a static diagram — particle simulations, wave motion, orbital mechanics, fluid dynamics, pendulums, spring systems, Fourier visualisations, etc. Prefer this over `freeform_html` for **physics** and **math** domains. Adds ~3 s codegen latency.

**Props**:
- `spec` (string, **required**): plain-English description of the animation. Be specific: what is drawn, what parameters are controlled by sliders, what numerical readouts are shown, what physics equations drive the motion.
- `height` (number, optional, default `420`): iframe height in pixels.
- `caption` (string, optional): label shown below the sketch.

**Spec writing tips**:
- Name the objects being drawn (particle, ball, pendulum bob, wave, arrow).
- Specify sliders and their ranges (e.g. "slider for gravity 0–20 m/s²").
- Mention what text overlays to show (velocity, period, frequency).
- The sketch uses p5.js 1.9.4, loads from CDN, runs at 60fps in a sandboxed iframe.

**Example**:
```json
{
  "id":          "b5",
  "type":        "entity",
  "entity_type": "p5_sketch",
  "props": {
    "spec": "A simple pendulum simulation. Draw a pivot point at the top center, a string of adjustable length, and a circular bob. Animate the bob swinging using the small-angle approximation: θ(t) = θ₀ cos(√(g/L)·t). Slider for string length (0.5–3 m) and initial angle (5–45°). Show current angle, period T=2π√(L/g), and elapsed time as text overlays. Dark background, blue string, white bob.",
    "height":  420,
    "caption": "Simple pendulum — period depends only on length, not mass"
  }
}
```

---

## quiz_block

**Use when**: testing the user's understanding after an explanation — a single multiple-choice or true/false question with immediate feedback and an explanation after answering. Great at the end of a topic section.

**Props**:
- `question` (string, **required**): the question text.
- `options` (string[], **required**): answer choices (2–5 items). Ignored for `true_false`.
- `correctIndex` (number, **required**): 0-based index of the correct answer in `options`.
- `type` (string, optional, default `"mcq"`): `"mcq"` | `"true_false"`. For `true_false`, options are auto-generated as `["True", "False"]`.
- `explanation` (string, optional): shown after the user answers — explain why the correct answer is right.
- `hint` (string, optional): revealed on demand before the user answers.
- `caption` (string, optional).

**Example**:
```json
{
  "id":          "b6",
  "type":        "entity",
  "entity_type": "quiz_block",
  "props": {
    "question":     "What is the time complexity of binary search on a sorted array of n elements?",
    "type":         "mcq",
    "options":      ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    "correctIndex": 1,
    "explanation":  "Binary search halves the remaining search space each step. After k steps, n/2^k elements remain. It terminates when that equals 1, so k = log₂(n) steps — O(log n).",
    "hint":         "Think about how many elements are eliminated with each comparison."
  }
}
```

---

## flashcard_deck

**Use when**: the user wants to review or memorise a set of definitions, terms, or concepts — vocabulary, algorithm names, formula names, key theorems, language syntax. Each card has a front (question/term) and back (answer/definition).

**Props**:
- `cards` (array, **required**): `[{ "front": string, "back": string, "hint": string }]`. `hint` is optional per card.
- `stepReveal` (boolean, optional, default `false`): if `true`, card advances with a `step_controls` block. If `false`, user navigates with Prev/Next buttons.
- `caption` (string, optional).

**Example**:
```json
{
  "id":          "b7",
  "type":        "entity",
  "entity_type": "flashcard_deck",
  "props": {
    "cards": [
      {
        "front": "What is a closure in JavaScript?",
        "back":  "A function that retains access to variables from its enclosing scope, even after that scope has exited.",
        "hint":  "Think about what happens when a function is returned from another function."
      },
      {
        "front": "What does the event loop do?",
        "back":  "It continuously checks the call stack and the callback queue, moving callbacks onto the stack when it's empty — enabling non-blocking I/O."
      },
      {
        "front": "What is memoization?",
        "back":  "An optimization technique that caches the results of expensive function calls, returning the cached result when the same inputs occur again."
      }
    ],
    "caption": "JavaScript core concepts"
  }
}
```
