## mermaid_viewer

**Use when**: the concept is best explained as a flow diagram, sequence diagram, state machine, graph, or architecture diagram.

**Props**:
- `diagram` (string, **required**): valid Mermaid syntax. Supported: `graph LR`, `graph TD`, `flowchart LR`, `flowchart TD`, `sequenceDiagram`, `stateDiagram-v2`.
- `caption` (string, optional).

**Line breaks in labels**: use `<br/>`, never `\n`.

**Example**:
```json
{
  "id": "b2", "type": "entity", "entity_type": "mermaid_viewer",
  "props": {
    "diagram": "sequenceDiagram\n  participant C as Client\n  participant S as Server\n  C->>S: GET /index.html\n  S-->>C: 200 OK + HTML",
    "caption": "HTTP request-response cycle"
  }
}
```
