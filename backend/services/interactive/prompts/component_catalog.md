## Component Catalog

The following entity types are available as pre-built interactive components. Each section shows when to use the type, its required and optional props, and an example.

---

## mermaid_viewer

**Use when**: the concept is best explained as a flow diagram, sequence diagram, state machine, graph, or architecture diagram.

**Props**:
- `diagram` (string, required): valid Mermaid syntax string. Use `graph LR`, `graph TD`, `sequenceDiagram`, `stateDiagram-v2`, or `flowchart LR/TD`.
- `caption` (string, optional): short label shown below the diagram.

**Example**:
```json
{
  "id": "e1",
  "type": "mermaid_viewer",
  "props": {
    "diagram": "graph LR\n  A[Client] -->|HTTP GET| B[Server]\n  B -->|200 OK| A",
    "caption": "HTTP request-response cycle"
  }
}
```

---

## code_walkthrough

**Use when**: explaining an algorithm, function, or code pattern step by step, where each step highlights a specific line and explains what it does.

**Props**:
- `language` (string, required): syntax highlighting language, e.g. `"python"`, `"javascript"`, `"java"`, `"cpp"`, `"bash"`.
- `code` (string, required): the full code block to display.
- `steps` (array of `{line: int, explanation: string}`, required): one entry per step. `line` is 1-indexed. Each step highlights that line and shows `explanation` as a caption.

**Notes**:
- Pair with a `step_controls` entity (placed after this one) so the user can advance steps manually.
- `targetEntityId` in `step_controls` must match this entity's `id`.

**Example**:
```json
{
  "id": "e2",
  "type": "code_walkthrough",
  "props": {
    "language": "python",
    "code": "def bubble_sort(arr):\n    n = len(arr)\n    for i in range(n):\n        for j in range(n - i - 1):\n            if arr[j] > arr[j+1]:\n                arr[j], arr[j+1] = arr[j+1], arr[j]",
    "steps": [
      { "line": 1, "explanation": "Function receives the list to sort." },
      { "line": 3, "explanation": "Outer loop runs n times — one full pass per element." },
      { "line": 4, "explanation": "Inner loop compares adjacent pairs, shrinking each pass." },
      { "line": 5, "explanation": "Swap if left element is larger — bubble the max to the right." }
    ]
  }
}
```

---

## step_controls

**Use when**: the user should manually advance through stages of another entity (usually a `code_walkthrough`). Always place this entity immediately after the entity it controls.

**Props**:
- `steps` (string[], required): human-readable label for each step. Length must equal the number of steps in the target entity.
- `targetEntityId` (string, required): the `id` of the entity whose step this controls.

**Example**:
```json
{
  "id": "e3",
  "type": "step_controls",
  "props": {
    "steps": ["Define function", "Outer loop", "Inner loop", "Swap"],
    "targetEntityId": "e2"
  }
}
```

---

## freeform_html (escape hatch)

**Use when**: no pre-built type covers the need — for example, a physics simulation with a canvas animation, an interactive graph, or any bespoke visual that requires custom JavaScript.

**Props**:
- `spec` (string, required): a plain-English description of the interactive widget. This becomes the prompt sent to the codegen LLM, so be specific: mention sliders, buttons, what the simulation does, what parameters are exposed, what is drawn on the canvas.

**Notes**:
- The codegen LLM writes a self-contained HTML file (no network access, no imports). Wrap the description in enough detail that the result is useful without further prompting.
- The generated HTML runs inside `<iframe sandbox="allow-scripts">`, so it has a null origin. No localStorage, cookies, or cross-origin requests.

**Example**:
```json
{
  "id": "e1",
  "type": "freeform_html",
  "props": {
    "spec": "A Canvas 2D projectile motion simulator. Show a ball launched from the bottom-left with sliders for initial speed (10–80 m/s) and launch angle (5–85°). Draw the parabolic trajectory in blue, mark the peak with a dot, and show ghost trails for the last 3 launches in grey. Display live readouts for current height, horizontal distance, and time. Animate using requestAnimationFrame. No external libraries."
  }
}
```
