## timeline

**Use when**: chronological content — historical events, product roadmaps, biographies, scientific discoveries, especially when spanning multiple eras or periods.

**Props**:
- `events` (array, **required**): `[{ "date": string, "title": string, "description"?, "color"?, "icon"?, "era"? }]`
  - `era` (string, optional): key referencing an entry in the `eras` array — assigns this event to an era group
- `orientation` (optional, default `"vertical"`): `"vertical"` | `"horizontal"` — use horizontal for century-scale timelines
- `stepReveal` (boolean, optional, default `false`): reveals events one-by-one — pair with `step_controls`
- `groupBy` (string, optional): field name to group events into labeled sections (alternative to `eras`)
- `eras` (array, optional): `[{ "label": string, "key": string, "color": string }]` — defines named era periods with distinct colors; events with a matching `era` field are grouped and shaded accordingly
- `compact` (boolean, optional, default `false`): tighter layout for dense timelines
- `caption` (string, optional)

**Zoom**: the timeline renders zoom buttons (50%–250%) and supports Ctrl+scroll / Cmd+scroll for pinch-style zoom. No extra props needed.

**Example — simple vertical**:
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

**Example — era period shading (horizontal, century-scale)**:
```json
{
  "id": "b9", "type": "entity", "entity_type": "timeline",
  "props": {
    "orientation": "horizontal",
    "eras": [
      { "label": "Ancient",     "key": "ancient",     "color": "#a78bfa" },
      { "label": "Medieval",    "key": "medieval",    "color": "#f59e0b" },
      { "label": "Modern",      "key": "modern",      "color": "#34d399" }
    ],
    "events": [
      { "date": "500 BC",  "title": "Socrates",          "era": "ancient",  "icon": "🏛️" },
      { "date": "44 BC",   "title": "Julius Caesar",      "era": "ancient",  "icon": "⚔️" },
      { "date": "1215",    "title": "Magna Carta",        "era": "medieval", "icon": "📜" },
      { "date": "1453",    "title": "Fall of Constantinople", "era": "medieval", "icon": "🏰" },
      { "date": "1776",    "title": "American Revolution","era": "modern",   "icon": "🗽" },
      { "date": "1969",    "title": "Moon Landing",       "era": "modern",   "icon": "🚀" }
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
