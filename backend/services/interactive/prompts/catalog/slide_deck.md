## slide_deck

Interactive slide presentation — renders a navigable slide deck inside the lesson with prev/next controls, fullscreen mode, and a **Download as PowerPoint (.pptx)** button. Use when the user explicitly asks to create a presentation, PPT, or slide deck.

**When to use:** Only when the user asks for a "presentation", "slides", "PPT", or "slide deck". Do NOT use by default in regular lessons.

**Props:**
- `slides` (array, **required**): array of slide objects (see layouts below)
- `title` (string, optional): presentation title shown in the header
- `caption` (string, optional)

**Slide object fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `layout` | string | no | `"title"` \| `"bullets"` \| `"two_column"` \| `"content"` — defaults to `"title"` if no bullets, else `"bullets"` |
| `title` | string | yes | Slide heading |
| `subtitle` | string | no | Only shown in `"title"` layout |
| `bullets` | string[] | for `bullets` layout | List of bullet points |
| `left` | string[] | for `two_column` | Left column bullets |
| `right` | string[] | for `two_column` | Right column bullets |
| `content` | string | for `content` layout | Free-form paragraph text |
| `notes` | string | no | Speaker notes (exported to PPTX, not shown on slide) |

**Layouts:**
- `title` — large centered title + optional subtitle. Use for the first slide and section dividers.
- `bullets` — title at top + bullet list. Most common layout.
- `two_column` — title + two side-by-side bullet columns. Good for comparisons.
- `content` — title + free paragraph text. Good for quotes, definitions, long explanations.

**Structure tip:** Always start with a `title` slide, end with a summary or "Thank You" slide. Aim for 5–10 slides. Keep bullets concise (max 6 per slide, max 10 words each).

---

### Example — 6-slide physics presentation

```json
{
  "id": "sd1", "type": "entity", "entity_type": "slide_deck",
  "props": {
    "title": "Newton's Laws of Motion",
    "slides": [
      {
        "layout": "title",
        "title": "Newton's Laws of Motion",
        "subtitle": "The Foundation of Classical Mechanics",
        "notes": "Introduce the topic — 3 laws that govern all motion at everyday speeds."
      },
      {
        "layout": "bullets",
        "title": "First Law — Inertia",
        "bullets": [
          "An object at rest stays at rest",
          "An object in motion stays in motion",
          "Unless acted on by a net external force",
          "Inertia is the resistance to change in motion"
        ],
        "notes": "Demo idea: hockey puck on ice vs. on grass."
      },
      {
        "layout": "content",
        "title": "Second Law — F = ma",
        "content": "Force equals mass times acceleration.\n\nA larger force produces greater acceleration. A heavier object requires more force to achieve the same acceleration.",
        "notes": "Emphasize the vector nature — F and a point in the same direction."
      },
      {
        "layout": "two_column",
        "title": "Third Law — Action & Reaction",
        "left": [
          "Every action has an equal and opposite reaction",
          "Forces always come in pairs",
          "Both forces are equal in magnitude"
        ],
        "right": [
          "Rocket exhaust pushes down → rocket goes up",
          "Swimmer pushes wall → wall pushes swimmer",
          "You push Earth → Earth pushes you"
        ]
      },
      {
        "layout": "bullets",
        "title": "Real-World Applications",
        "bullets": [
          "Car safety: seatbelts counter inertia (1st Law)",
          "Braking distance depends on mass and force (2nd Law)",
          "Jet propulsion and rocketry (3rd Law)",
          "Sports: kicking, throwing, swimming"
        ]
      },
      {
        "layout": "title",
        "title": "Summary",
        "subtitle": "1st: Inertia   •   2nd: F = ma   •   3rd: Action = Reaction"
      }
    ]
  }
}
```

---

### Example — comparison slide deck

```json
{
  "id": "sd2", "type": "entity", "entity_type": "slide_deck",
  "props": {
    "title": "SQL vs NoSQL Databases",
    "slides": [
      { "layout": "title", "title": "SQL vs NoSQL", "subtitle": "Choosing the Right Database" },
      {
        "layout": "two_column", "title": "Core Differences",
        "left":  ["Fixed schema", "ACID transactions", "Joins across tables", "Vertical scaling"],
        "right": ["Flexible schema", "Eventual consistency", "Denormalized documents", "Horizontal scaling"]
      },
      {
        "layout": "bullets", "title": "When to Use SQL",
        "bullets": ["Financial data requiring ACID guarantees", "Complex relational queries", "Mature, well-defined schema", "Examples: PostgreSQL, MySQL"]
      },
      {
        "layout": "bullets", "title": "When to Use NoSQL",
        "bullets": ["Rapidly changing data structures", "High write throughput", "Document or key-value access patterns", "Examples: MongoDB, DynamoDB, Redis"]
      },
      { "layout": "title", "title": "It Depends on Your Use Case", "subtitle": "No single right answer — match the tool to the data model" }
    ]
  }
}
```
