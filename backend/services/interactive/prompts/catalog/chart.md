## chart

**Use when**: visualizing quantitative data — comparisons, trends, distributions, proportions, correlations.

**Props**:
- `type` (**required**): `"bar"` | `"line"` | `"area"` | `"scatter"` | `"pie"` | `"radar"` | `"composed"`
- `data` (array, **required**): row objects, e.g. `[{ "month": "Jan", "revenue": 4000 }]`
- `series` (array of `{ "dataKey", "name", "color", "type" }`, required except pie/radar)
- `xKey` (string, required except pie/radar): x-axis data key
- `pieKey` (default `"value"`), `nameKey` (default `"name"`): for pie charts
- `title`, `xLabel`, `yLabel`, `caption` (strings, optional)
- `height` (number, optional, default `280`)
- `stacked`, `logScale`, `showLegend`, `showGrid` (booleans, optional)
- `referenceLines` (array of `{ "value", "label", "axis": "x"|"y", "color" }`, optional)

**Example — bar**:
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

**Example — pie**:
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
