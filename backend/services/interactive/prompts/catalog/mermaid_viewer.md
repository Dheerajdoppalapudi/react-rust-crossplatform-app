## mermaid_viewer

**Use when**: the concept is best explained as a flow diagram, sequence diagram, state machine, graph, or architecture diagram.

**Props**:
- `diagram` (string, **required**): valid Mermaid syntax. Supported: `graph LR`, `graph TD`, `flowchart LR`, `flowchart TD`, `sequenceDiagram`, `stateDiagram-v2`.
- `caption` (string, optional).

**CRITICAL syntax rules — violations cause render failures:**

1. **No HTML tags ever.** Never use `<b>`, `<i>`, `<strong>`, `<br/>`, `<br>` or any HTML inside Mermaid diagrams. They break the parser.
2. **No line breaks in labels.** Keep all node labels, message text, and note text on a single line. If text is long, shorten it — don't wrap it.
3. **Sequence diagram messages must be plain text.** No parentheses spanning multiple conceptual lines, no colons in message text (Mermaid parses `:` as a separator).
4. **Quoted labels in graph/flowchart**: use `["Label text"]` double quotes only. Keep labels short (< 40 chars).
5. **No Unicode arrows** (→, ←, ⟶) inside diagram syntax. Use `-->`, `->>`, `-->>` Mermaid arrows instead.
6. **stateDiagram-v2 notes**: note content must be on ONE line — no newlines inside note blocks.

**Example — flowchart:**
```json
{
  "id": "b2", "type": "entity", "entity_type": "mermaid_viewer",
  "props": {
    "diagram": "graph TD\n  A[Application Layer] --> T[Transport Layer]\n  T --> I[Internet Layer]\n  I --> N[Network Access Layer]",
    "caption": "TCP/IP four-layer model"
  }
}
```

**Example — sequence diagram:**
```json
{
  "id": "b3", "type": "entity", "entity_type": "mermaid_viewer",
  "props": {
    "diagram": "sequenceDiagram\n  participant C as Client\n  participant S as Server\n  C->>S: GET /index.html\n  S-->>C: 200 OK + HTML",
    "caption": "HTTP request-response cycle"
  }
}
```

**Example — state machine:**
```json
{
  "id": "b4", "type": "entity", "entity_type": "mermaid_viewer",
  "props": {
    "diagram": "stateDiagram-v2\n  [*] --> CLOSED\n  CLOSED --> SYN_SENT: send SYN\n  SYN_SENT --> ESTABLISHED: recv SYN-ACK\n  ESTABLISHED --> FIN_WAIT: send FIN\n  FIN_WAIT --> CLOSED: recv ACK",
    "caption": "TCP connection state machine"
  }
}
```
