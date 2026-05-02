## table_viewer

**Use when**: structured comparisons — algorithm complexity, language features, API options, benchmark results, any tabular data. Works in ANY domain.

**Props**:
- `columns` (array, **required**): `[{ "key": string, "label": string, "width"?: string }]`
- `rows` (array, **required**): objects with keys matching column keys
- `sortable` (boolean, optional, default `true`)
- `striped` (boolean, optional, default `true`)
- `highlightRows` (number[], optional): 0-based row indices to accent
- `caption` (string, optional)

**Example**:
```json
{
  "id": "b2", "type": "entity", "entity_type": "table_viewer",
  "props": {
    "columns": [
      { "key": "algo",      "label": "Algorithm", "width": "25%" },
      { "key": "avg",       "label": "Avg Time",  "width": "25%" },
      { "key": "space",     "label": "Space",     "width": "25%" },
      { "key": "stable",    "label": "Stable?",   "width": "25%" }
    ],
    "rows": [
      { "algo": "Merge Sort",  "avg": "O(n log n)", "space": "O(n)",    "stable": "Yes" },
      { "algo": "Quick Sort",  "avg": "O(n log n)", "space": "O(log n)","stable": "No"  },
      { "algo": "Heap Sort",   "avg": "O(n log n)", "space": "O(1)",    "stable": "No"  }
    ],
    "highlightRows": [0]
  }
}
```
