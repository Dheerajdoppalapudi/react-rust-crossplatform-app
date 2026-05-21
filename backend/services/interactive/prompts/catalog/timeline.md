## timeline

**Use when**: chronological content — historical events, product roadmaps, biographies, scientific discoveries.

**Props**:
- `events` (array, **required**): `[{ "date": string, "title": string, "description"?, "color"?, "icon"? }]`
  - Use `color` on individual events to distinguish phases (e.g. different hex per period) — no era grouping needed
- `orientation` (optional, default `"vertical"`): `"vertical"` | `"horizontal"` — use horizontal for many events or century-scale timelines
- `stepReveal` (boolean, optional, default `false`): reveals events one-by-one — pair with `step_controls`
- `compact` (boolean, optional, default `false`): tighter layout for dense timelines
- `caption` (string, optional)

**Zoom**: the timeline renders zoom buttons (50%–250%) and supports Ctrl+scroll / Cmd+scroll. No extra props needed.

**Example — vertical**:
```json
{
  "id": "b9", "type": "entity", "entity_type": "timeline",
  "props": {
    "events": [
      { "date": "1905", "title": "Special Relativity", "description": "Einstein publishes special relativity.", "icon": "⚡", "color": "#a78bfa" },
      { "date": "1915", "title": "General Relativity",  "description": "Spacetime curves around mass.",          "icon": "🌌", "color": "#a78bfa" },
      { "date": "1921", "title": "Nobel Prize",          "description": "Awarded for photoelectric effect.",      "icon": "🏅", "color": "#34d399" }
    ]
  }
}
```

**Example — stepReveal with step_controls**:
```json
{
  "id": "b9", "type": "entity", "entity_type": "timeline",
  "props": {
    "stepReveal": true,
    "events": [
      { "date": "1905", "title": "Special Relativity", "icon": "⚡" },
      { "date": "1915", "title": "General Relativity",  "icon": "🌌" },
      { "date": "1921", "title": "Nobel Prize",          "icon": "🏅" }
    ]
  }
},
{
  "id": "b10", "type": "entity", "entity_type": "step_controls",
  "props": {
    "steps": ["Special Relativity", "General Relativity", "Nobel Prize"],
    "targetEntityId": "b9"
  }
}
```
