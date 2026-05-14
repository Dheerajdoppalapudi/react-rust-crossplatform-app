## chart

**Use when**: visualizing quantitative data — comparisons, trends, distributions, proportions, correlations, matrices.

**Props**:
- `type` (**required**): `"bar"` | `"line"` | `"area"` | `"scatter"` | `"bubble"` | `"pie"` | `"radar"` | `"heatmap"` | `"composed"`
- `data` (array, **required**): row objects
- `series` (array of `{ "dataKey", "name", "color", "type" }`, required for bar/line/area/composed)
- `xKey` (string, required for bar/line/area/scatter/composed): x-axis data key
- `pieKey` (default `"value"`), `nameKey` (default `"name"`): for pie charts
- `title`, `xLabel`, `yLabel`, `caption` (strings, optional)
- `height` (number, optional, default `300`)
- `stacked`, `logScale`, `showLegend`, `showGrid` (booleans, optional)
- `referenceLines` (array of `{ "value", "label", "axis": "x"|"y", "color" }`, optional)

---

### Bubble chart (`type: "bubble"`)

Scatter chart where dot size encodes a third numeric variable.

- `data` (array of `{ x, y, z, name? }` objects) — `z` controls bubble size
- `xKey` (string, optional, default `"x"`): x-axis field
- `yKey` (string, optional, default `"y"`): y-axis field
- `zKey` (string, optional, default `"z"`): size field
- `xLabel`, `yLabel`, `title`, `caption` (optional)

Multi-group bubble: use `series` array where each entry has `{ data: [{x,y,z}], name, color }`.

**Example — bubble**:
```json
{
  "id": "b6", "type": "entity", "entity_type": "chart",
  "props": {
    "type": "bubble",
    "data": [
      { "x": 100, "y": 200, "z": 40, "name": "Product A" },
      { "x": 300, "y": 450, "z": 80, "name": "Product B" },
      { "x": 200, "y": 100, "z": 20, "name": "Product C" }
    ],
    "xLabel": "Revenue ($k)", "yLabel": "Profit ($k)",
    "title": "Revenue vs Profit vs Market Share"
  }
}
```

---

### Heatmap (`type: "heatmap"`)

Grid visualization where cell color encodes a value. No `series` or `xKey` needed.

- `data` (array of `{ x, y, value }` objects, **required**)
- `xKey` (string, optional, default `"x"`): x-axis category field
- `yKey` (string, optional, default `"y"`): y-axis category field
- `valueKey` (string, optional, default `"value"`): numeric intensity field
- `title`, `caption` (optional)

**Example — heatmap**:
```json
{
  "id": "b7", "type": "entity", "entity_type": "chart",
  "props": {
    "type": "heatmap",
    "data": [
      { "x": "Mon", "y": "Morning",   "value": 42 },
      { "x": "Mon", "y": "Afternoon", "value": 78 },
      { "x": "Tue", "y": "Morning",   "value": 55 },
      { "x": "Tue", "y": "Afternoon", "value": 90 }
    ],
    "title": "Activity by Day and Time"
  }
}
```

---

### Multi-group scatter (`type: "scatter"`)

When comparing multiple groups, use a `series` array where each entry has its own `data` array.

- `series` (array of `{ data: [{x,y}], name, color, xKey?, yKey? }`)

**Example — multi-group scatter**:
```json
{
  "id": "b8", "type": "entity", "entity_type": "chart",
  "props": {
    "type": "scatter",
    "series": [
      { "name": "Group A", "color": "#4B72FF", "data": [{ "x": 10, "y": 20 }, { "x": 30, "y": 50 }] },
      { "name": "Group B", "color": "#FF6B6B", "data": [{ "x": 15, "y": 60 }, { "x": 45, "y": 30 }] }
    ],
    "xLabel": "Feature X", "yLabel": "Feature Y"
  }
}
```

---

### Standard examples

**Bar**:
```json
{
  "id": "b4", "type": "entity", "entity_type": "chart",
  "props": {
    "type": "bar",
    "data": [{ "lang": "Python", "stars": 58 }, { "lang": "JS", "stars": 92 }, { "lang": "Go", "stars": 44 }],
    "series": [{ "dataKey": "stars", "name": "GitHub Stars (k)" }],
    "xKey": "lang", "title": "Language popularity"
  }
}
```

**Pie**:
```json
{
  "id": "b5", "type": "entity", "entity_type": "chart",
  "props": {
    "type": "pie",
    "data": [{ "name": "TCP", "value": 60 }, { "name": "UDP", "value": 40 }],
    "pieKey": "value", "nameKey": "name"
  }
}
```
