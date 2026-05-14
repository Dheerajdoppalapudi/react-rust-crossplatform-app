## All available entity types

Use this as a reference. Full schemas are loaded above for the selected entities.
You MAY use any entity listed here — if you pick one not detailed above, construct its props carefully from the description and required fields below.

| Entity | Best for | Required props |
|---|---|---|
| `mermaid_viewer` | Flowcharts, sequence diagrams, state machines, architecture diagrams, process flows | `diagram` (Mermaid syntax) |
| `code_walkthrough` | Step-by-step code execution, algorithm walkthroughs, annotated implementations | `language`, `code`, `steps[]` ({line, explanation}) |
| `step_controls` | Driving a `timeline` with `stepReveal: true` — place immediately after. Do NOT use with code_walkthrough or math_formula (both have built-in navigation) | `steps[]` (labels), `targetEntityId` |
| `math_formula` | LaTeX equations, derivations, physics formulas, step-by-step proofs | `latex` OR `steps[]` ({latex, label}) |
| `chart` | Quantitative data — bar, line, pie, scatter, radar, area, composed charts | `type`, `data[]`, `series[]` (not pie), `xKey` (not pie) |
| `graph_canvas` | Node-edge graphs, trees, DAGs, dependency graphs, network topologies | `nodes[]`, `edges[]` |
| `molecule_viewer` | 3D molecular structures, chemical bonds, drug molecules, proteins | `format`, `data` |
| `map_viewer` | Geographic content, locations, routes, historical spread, regional comparisons | `center` ([lat, lng]) |
| `timeline` | Chronological events, history, roadmaps, biographies, discoveries | `events[]` ({date, title, description}) |
| `freeform_html` | Bespoke Canvas 2D widget when no pre-built type fits — escape hatch, 3s latency | `spec` (detailed plain-English widget description) |
| `table_viewer` | Comparisons, complexity tables, feature matrices, benchmark results — ANY domain | `columns[]` ({key, label}), `rows[]` |
| `terminal_output` | CLI commands + output, git walkthroughs, build steps, debugging sessions | `blocks[]` ({type: command\|output\|comment, content}) |
| `diff_viewer` | Code before/after: refactors, bug fixes, type annotation additions, API migrations | `before`, `after` |
| `p5_sketch` | Looping physics/math animations — pendulums, waves, particles, orbits (60fps, 3s latency) | `spec` (detailed animation description) |
| `quiz_block` | Self-check question after explaining a concept — MCQ or true/false with reveal | `question`, `options[]`, `correctIndex` |
| `flashcard_deck` | Memorising terms, definitions, algorithms, formulas — flippable card set | `cards[]` ({front, back, hint?}) |
