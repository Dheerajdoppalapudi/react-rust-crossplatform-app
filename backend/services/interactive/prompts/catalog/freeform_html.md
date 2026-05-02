## freeform_html

**Use when**: no pre-built entity covers the need — bespoke Canvas 2D widget. **Last resort** — adds ~3s latency. Prefer `p5_sketch` for physics/math animations.

**Props**:
- `spec` (string, **required**): detailed plain-English widget description. Becomes the codegen prompt — be specific about sliders, canvas drawing, parameters, animation behaviour. No CDN imports, no fetch(), runs in sandboxed iframe.

**Example**:
```json
{
  "id": "b5", "type": "entity", "entity_type": "freeform_html",
  "props": {
    "spec": "A Canvas 2D projectile motion simulator. Sliders for initial speed (10–80 m/s) and launch angle (5–85°). Draw parabolic trajectory in blue, mark peak height with a red dot. Live readouts for height, distance, elapsed time. Animate with requestAnimationFrame."
  }
}
```
