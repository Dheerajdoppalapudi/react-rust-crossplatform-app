## timeline

**Use when**: chronological content — historical events, product roadmaps, biographies, scientific discoveries.

**Props**:
- `events` (array, **required**): `[{ "date": string, "title": string, "description"?, "category"?, "color"?, "icon"? }]`
- `orientation` (optional, default `"vertical"`): `"vertical"` | `"horizontal"`
- `stepReveal` (boolean, optional, default `false`): reveals events one-by-one — pairs with `step_controls`
- `groupBy` (string, optional): field name to group events into sections
- `caption` (string, optional)

**Example**:
```json
{
  "id": "b9", "type": "entity", "entity_type": "timeline",
  "props": {
    "events": [
      { "date": "1905", "title": "Special Relativity", "description": "Einstein publishes special relativity.", "icon": "⚡" },
      { "date": "1915", "title": "General Relativity",  "description": "Spacetime curves around mass.",          "icon": "🌌" },
      { "date": "1921", "title": "Nobel Prize",          "description": "Awarded for photoelectric effect.",      "icon": "🏅" }
    ]
  }
}
```
