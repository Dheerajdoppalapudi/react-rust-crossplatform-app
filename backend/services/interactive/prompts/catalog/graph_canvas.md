## graph_canvas

**Use when**: the concept involves nodes and edges — trees, DAGs, state machines, dependency graphs, network topologies, call graphs, entity relationships.

**Props**:
- `nodes` (array, **required**): `[{ "id", "label", "type": "input"|"default"|"output", "x"?, "y"? }]`
- `edges` (array, **required**): `[{ "id", "source", "target", "label"?, "animated"? }]`
- `layout` (optional, default `"dagre-lr"`): `"dagre-lr"` | `"dagre-tb"` | `"manual"`
- `directed` (boolean, optional, default `true`)
- `height` (number, optional, default `340`)
- `stepHighlights` (array of `{ "nodes": string[], "edges": string[] }`, optional): pairs with `step_controls`
- `caption` (string, optional)

**Example**:
```json
{
  "id": "b6", "type": "entity", "entity_type": "graph_canvas",
  "props": {
    "nodes": [
      { "id": "A", "label": "Request",  "type": "input"   },
      { "id": "B", "label": "Auth",     "type": "default" },
      { "id": "C", "label": "Response", "type": "output"  }
    ],
    "edges": [
      { "id": "e1", "source": "A", "target": "B", "label": "JWT?" },
      { "id": "e2", "source": "B", "target": "C" }
    ],
    "layout": "dagre-lr"
  }
}
```
