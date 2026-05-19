## plotly

Fully interactive charts powered by Plotly.js — hover tooltips, zoom/pan, legend toggle, PNG download, 3D rotation. Use when the data is complex enough that interactivity matters or when chart types aren't available in `chart` (box, violin, 3D, contour, sankey, treemap, sunburst, waterfall, candlestick, indicator, etc.).

**Props:**
- `data` (array, **required**): Plotly traces array — each trace is a Plotly trace object (`{type, x, y, name, ...}`)
- `layout` (object, optional): Plotly layout overrides — `title`, `height`, `xaxis`, `yaxis`, `barmode`, `legend`, etc.
- `config` (object, optional): Plotly config overrides — rarely needed
- `caption` (string, optional)

Theme (dark/light) and responsive sizing are applied automatically. Always provide `name` on each trace for legend readability.

---

### Common chart types via `type` field on each trace

| type | use for |
|---|---|
| `bar` | grouped or stacked bars |
| `scatter` (with `mode:'lines'`) | line charts |
| `scatter` (with `mode:'markers'`) | scatter plots |
| `scatter` (with `mode:'lines+markers'`) | line+point combo |
| `box` | distribution with quartiles, outliers |
| `violin` | density-shaped distribution |
| `pie` | part-of-whole (use `labels`, `values`) |
| `scatter3d` | 3D point cloud |
| `surface` | 3D surface from a z-matrix |
| `contour` | 2D contour / heatmap |
| `heatmap` | grid heatmap (use `z` 2D array, `x`, `y`) |
| `histogram` | frequency distribution |
| `histogram2dcontour` | 2D histogram with contour overlay |
| `waterfall` | running total with incremental bars |
| `funnel` | conversion funnel |
| `treemap` | hierarchical proportions |
| `sunburst` | radial hierarchical proportions |
| `sankey` | flow between nodes |
| `candlestick` | OHLC price data |
| `indicator` | KPI number / gauge |
| `choropleth` | geographic heatmap |
| `scattergeo` | points on a map |

---

### Examples

**Box plot — score distributions by group:**
```json
{
  "id": "p1", "type": "entity", "entity_type": "plotly",
  "props": {
    "data": [
      { "type": "box", "name": "Control",   "y": [72,74,68,80,76,71,78,65,82,70], "boxpoints": "outliers" },
      { "type": "box", "name": "Treatment", "y": [85,88,79,92,84,90,87,83,95,81], "boxpoints": "outliers" }
    ],
    "layout": { "title": "Test Score Distribution by Group", "yaxis": { "title": { "text": "Score" } } }
  }
}
```

**Multi-line chart — trends over time:**
```json
{
  "id": "p2", "type": "entity", "entity_type": "plotly",
  "props": {
    "data": [
      { "type": "scatter", "mode": "lines", "name": "Revenue", "x": ["Q1","Q2","Q3","Q4"], "y": [120,145,162,198] },
      { "type": "scatter", "mode": "lines", "name": "Expenses","x": ["Q1","Q2","Q3","Q4"], "y": [95,110,128,145] }
    ],
    "layout": { "title": "Revenue vs Expenses", "yaxis": { "title": { "text": "USD (thousands)" } } }
  }
}
```

**Grouped bar chart:**
```json
{
  "id": "p3", "type": "entity", "entity_type": "plotly",
  "props": {
    "data": [
      { "type": "bar", "name": "2023", "x": ["Jan","Feb","Mar","Apr"], "y": [40,55,48,62] },
      { "type": "bar", "name": "2024", "x": ["Jan","Feb","Mar","Apr"], "y": [52,61,58,74] }
    ],
    "layout": { "barmode": "group", "title": "Monthly Sales Comparison" }
  }
}
```

**Waterfall — cash flow:**
```json
{
  "id": "p4", "type": "entity", "entity_type": "plotly",
  "props": {
    "data": [{
      "type": "waterfall",
      "name": "Cash Flow",
      "orientation": "v",
      "x": ["Revenue","COGS","Gross Profit","OpEx","EBIT"],
      "y": [500,-200,0,-120,0],
      "measure": ["absolute","relative","total","relative","total"],
      "text": ["$500K","-$200K","$300K","-$120K","$180K"],
      "textposition": "outside"
    }],
    "layout": { "title": "Cash Flow Waterfall" }
  }
}
```

**3D surface — mathematical function:**
```json
{
  "id": "p5", "type": "entity", "entity_type": "plotly",
  "props": {
    "data": [{
      "type": "surface",
      "z": [[1,2,3],[4,5,6],[7,8,9]],
      "colorscale": "Viridis",
      "showscale": true
    }],
    "layout": { "title": "3D Surface", "height": 450 }
  }
}
```

**Violin — compare distributions:**
```json
{
  "id": "p6", "type": "entity", "entity_type": "plotly",
  "props": {
    "data": [
      { "type": "violin", "name": "Group A", "y": [2,3,4,5,3,4,5,6,4,3,5,7,4], "box": { "visible": true }, "meanline": { "visible": true } },
      { "type": "violin", "name": "Group B", "y": [5,6,7,8,6,7,8,9,7,6,8,10,7], "box": { "visible": true }, "meanline": { "visible": true } }
    ],
    "layout": { "title": "Value Distribution by Group" }
  }
}
```

**Sankey — flow diagram:**
```json
{
  "id": "p7", "type": "entity", "entity_type": "plotly",
  "props": {
    "data": [{
      "type": "sankey",
      "node": {
        "label": ["Input A","Input B","Process 1","Process 2","Output"],
        "pad": 15, "thickness": 20
      },
      "link": {
        "source": [0,1,2,2,3],
        "target": [2,2,3,4,4],
        "value":  [8,4,6,3,9]
      }
    }],
    "layout": { "title": "Flow Diagram", "height": 400 }
  }
}
```

**Indicator — KPI gauge:**
```json
{
  "id": "p8", "type": "entity", "entity_type": "plotly",
  "props": {
    "data": [{
      "type": "indicator",
      "mode": "gauge+number+delta",
      "value": 73,
      "delta": { "reference": 60 },
      "gauge": {
        "axis": { "range": [0, 100] },
        "bar":  { "color": "#4dabf7" },
        "steps": [
          { "range": [0,40],  "color": "rgba(255,0,0,0.15)" },
          { "range": [40,70], "color": "rgba(255,200,0,0.15)" },
          { "range": [70,100],"color": "rgba(0,200,0,0.15)" }
        ]
      },
      "title": { "text": "System Health Score" }
    }],
    "layout": { "height": 300 }
  }
}
```

**Heatmap — correlation matrix:**
```json
{
  "id": "p9", "type": "entity", "entity_type": "plotly",
  "props": {
    "data": [{
      "type": "heatmap",
      "x": ["A","B","C","D"],
      "y": ["A","B","C","D"],
      "z": [[1,0.8,0.3,-0.1],[0.8,1,0.5,0.2],[0.3,0.5,1,0.7],[-0.1,0.2,0.7,1]],
      "colorscale": "RdBu", "zmid": 0,
      "text": [["1.00","0.80","0.30","-0.10"],["0.80","1.00","0.50","0.20"],["0.30","0.50","1.00","0.70"],["-0.10","0.20","0.70","1.00"]],
      "texttemplate": "%{text}", "showscale": true
    }],
    "layout": { "title": "Correlation Matrix" }
  }
}
```

**Treemap — hierarchical data:**
```json
{
  "id": "p10", "type": "entity", "entity_type": "plotly",
  "props": {
    "data": [{
      "type": "treemap",
      "labels": ["Total","A","B","C","A1","A2","B1","B2"],
      "parents": ["","Total","Total","Total","A","A","B","B"],
      "values": [0,0,0,40,25,15,30,20],
      "branchvalues": "total",
      "textinfo": "label+value+percent parent"
    }],
    "layout": { "title": "Budget Breakdown", "height": 420 }
  }
}
```

**When to prefer `chart` instead:** simple bar, line, pie, area, scatter, radar with a straightforward data table. Use `plotly` when you need interactivity, unusual chart types (box, violin, 3D, sankey, waterfall, indicator), or complex multi-axis layouts.
