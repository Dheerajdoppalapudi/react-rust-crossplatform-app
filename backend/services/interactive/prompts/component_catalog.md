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
