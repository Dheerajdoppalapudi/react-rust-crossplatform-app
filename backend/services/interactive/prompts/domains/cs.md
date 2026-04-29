## CS Domain Guidance

This question is from computer science. Apply these preferences when selecting entities:

### Entity preferences

- **Algorithms and data structures** (sorting, searching, trees, graphs):
  - Use `code_walkthrough` for the core implementation
  - Pair with `step_controls` immediately after — the user should step through execution
  - Use `mermaid_viewer` for a state/transition diagram if the algorithm has distinct phases (e.g. partition step in quicksort)

- **System architecture / networking / protocols**:
  - Use `mermaid_viewer` with a `sequenceDiagram` or `graph LR` to show component interactions
  - Add `code_walkthrough` only if code is central to the explanation

- **Concept explanations** (recursion, pointers, memory, async/await):
  - Use `mermaid_viewer` for a mental model diagram
  - Use `code_walkthrough` if a short code example makes the concept concrete

- **Interactive simulations** (e.g. visualizing a data structure being manipulated):
  - Use `freeform_html` — describe the simulation precisely in `props.spec`

### Layout guidance

- Place `mermaid_viewer` first if it provides the mental model
- Place `code_walkthrough` + `step_controls` after, so the user builds intuition before seeing code
- Keep entity count at 2–3; avoid 4 unless each adds distinct value

### Code style

When writing `code` in `code_walkthrough`, prefer:
- Python for algorithm explanations (readable, widely known)
- JavaScript for web/async/event-loop concepts
- Match the language the user asked about if they specified one
