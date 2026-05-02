## map_viewer

**Use when**: geographic content — locations, routes, regions, historical spread, city comparisons, spatial data.

**Props**:
- `center` (array `[lat, lng]`, **required**): map center coordinates
- `zoom` (number, optional, default `4`)
- `height` (number, optional, default `380`)
- `tileLayer` (optional, default `"osm"`): `"osm"` | `"satellite"` | `"terrain"` | `"dark"` | `"light"`
- `markers` (array of `{ "lat", "lng", "label", "color"?, "tooltip"? }`, optional)
- `paths` (array of `{ "points": [[lat,lng],...], "color", "label"? }`, optional)
- `polygons` (array of `{ "points", "fillColor", "opacity", "label"? }`, optional)
- `caption` (string, optional)

**Example**:
```json
{
  "id": "b8", "type": "entity", "entity_type": "map_viewer",
  "props": {
    "center": [48.8566, 2.3522], "zoom": 5, "tileLayer": "light",
    "markers": [
      { "lat": 48.8566, "lng": 2.3522,  "label": "Paris",  "color": "#4B72FF" },
      { "lat": 51.5074, "lng": -0.1278, "label": "London", "color": "#e879f9" }
    ]
  }
}
```
