## p5_sketch

**Use when**: continuous physics or math animation — pendulums, springs, waves, orbits, particles, Fourier. Prefer over `freeform_html` for physics/math. Adds ~3s codegen latency.

**Props**:
- `spec` (string, **required**): plain-English animation description. Be specific: objects drawn, physics equations, slider controls and ranges, text overlays. Runs at 60fps using p5.js in a sandboxed iframe.
- `height` (number, optional, default `420`)
- `caption` (string, optional)

**Spec tips**: name the objects (pendulum bob, wave, particle), specify slider ranges, mention what readouts to show (period, velocity, frequency).

**Example**:
```json
{
  "id": "b5", "type": "entity", "entity_type": "p5_sketch",
  "props": {
    "spec": "Simple pendulum. Pivot at top center, string of variable length, circular bob. Animate using θ(t)=θ₀cos(√(g/L)·t). Sliders: length 0.5–3m, initial angle 5–45°. Show angle, period T=2π√(L/g), elapsed time. Dark bg, blue string, white bob.",
    "caption": "Period depends only on length, not mass"
  }
}
```
