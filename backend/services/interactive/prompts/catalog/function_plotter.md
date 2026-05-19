## function_plotter

Interactive function grapher — evaluates mathematical expressions client-side and plots them with zoom, pan, and hover. The LLM provides an expression string; the component computes all values at render time so you never have to enumerate data points.

**When to use:** Any lesson where seeing a function's shape matters — calculus derivatives, trig waveforms, physics potential energy curves, exponential growth, probability distributions. Prefer this over `plotly` for mathematical functions because the expression is compact and renders at arbitrary resolution.

**Props:**
- `expr` (string) — single function, e.g. `"sin(x)"`, `"x^2 - 4"`, `"exp(-x^2 / 2)"`
- `functions` (array) — multiple functions: `[{ expr, label?, color? }]`
- `domain` ([number, number], default `[-10, 10]`) — x range to plot
- `range` ([number, number], optional) — y-axis limits; use to clip vertical asymptotes
- `samples` (number, default 500) — evaluation resolution; increase to 800+ for sharp peaks
- `title` (string, optional)
- `caption` (string, optional)

**Math syntax (mathjs):**

| What | Write |
|---|---|
| Power | `x^2` (not `x**2`) |
| Constants | `pi`, `e` |
| Trig | `sin(x)`, `cos(x)`, `tan(x)`, `asin(x)`, `acos(x)`, `atan(x)` |
| Hyperbolic | `sinh(x)`, `cosh(x)`, `tanh(x)` |
| Exponential / log | `exp(x)`, `log(x)` (natural), `log(x, 10)` (base 10), `log2(x)` |
| Root / abs | `sqrt(x)`, `abs(x)` |
| Rounding | `floor(x)`, `ceil(x)`, `round(x)` |
| Conditional | Not supported — use `range` to clip instead |

Discontinuities (`tan(x)`, `1/x`, `sqrt(x)` for x < 0) render automatically as gaps — no special handling needed.

---

### Examples

**Single function — parabola:**
```json
{
  "id": "fp1", "type": "entity", "entity_type": "function_plotter",
  "props": {
    "expr": "x^2 - 4",
    "domain": [-4, 4],
    "title": "f(x) = x² − 4",
    "caption": "Roots at x = ±2, vertex at (0, −4)"
  }
}
```

**Overlaid trig functions:**
```json
{
  "id": "fp2", "type": "entity", "entity_type": "function_plotter",
  "props": {
    "functions": [
      { "expr": "sin(x)",    "label": "sin(x)",    "color": "#4dabf7" },
      { "expr": "cos(x)",    "label": "cos(x)",    "color": "#f783ac" },
      { "expr": "sin(2*x)",  "label": "sin(2x)",   "color": "#ffa94d" }
    ],
    "domain": [-6.283, 6.283],
    "range": [-1.5, 1.5],
    "title": "Sinusoidal Functions"
  }
}
```

**Exponential decay:**
```json
{
  "id": "fp3", "type": "entity", "entity_type": "function_plotter",
  "props": {
    "functions": [
      { "expr": "exp(-x)",      "label": "e⁻ˣ",       "color": "#4dabf7" },
      { "expr": "exp(-0.5*x)",  "label": "e⁻⁰·⁵ˣ",   "color": "#f783ac" },
      { "expr": "exp(-2*x)",    "label": "e⁻²ˣ",       "color": "#ffa94d" }
    ],
    "domain": [0, 5],
    "title": "Exponential Decay — Effect of Rate Constant"
  }
}
```

**Function with vertical asymptote — clip with range:**
```json
{
  "id": "fp4", "type": "entity", "entity_type": "function_plotter",
  "props": {
    "expr": "1 / x",
    "domain": [-5, 5],
    "range": [-10, 10],
    "title": "f(x) = 1/x — Hyperbola"
  }
}
```

**Normal distribution (Gaussian):**
```json
{
  "id": "fp5", "type": "entity", "entity_type": "function_plotter",
  "props": {
    "functions": [
      { "expr": "exp(-x^2 / 2) / sqrt(2 * pi)",              "label": "μ=0, σ=1", "color": "#4dabf7" },
      { "expr": "exp(-(x-1)^2 / (2*0.25)) / sqrt(2*pi*0.25)","label": "μ=1, σ=½", "color": "#f783ac" }
    ],
    "domain": [-4, 5],
    "title": "Normal Distribution"
  }
}
```

**Derivative comparison — f and f′:**
```json
{
  "id": "fp6", "type": "entity", "entity_type": "function_plotter",
  "props": {
    "functions": [
      { "expr": "x^3 - 3*x",     "label": "f(x) = x³ − 3x",    "color": "#4dabf7" },
      { "expr": "3*x^2 - 3",      "label": "f′(x) = 3x² − 3",   "color": "#f783ac" }
    ],
    "domain": [-3, 3],
    "title": "Function and its Derivative"
  }
}
```

**Logarithm family:**
```json
{
  "id": "fp7", "type": "entity", "entity_type": "function_plotter",
  "props": {
    "functions": [
      { "expr": "log(x)",      "label": "ln(x)",    "color": "#4dabf7" },
      { "expr": "log(x, 10)",  "label": "log₁₀(x)", "color": "#f783ac" },
      { "expr": "log2(x)",     "label": "log₂(x)",  "color": "#ffa94d" }
    ],
    "domain": [0.01, 10],
    "title": "Logarithm Families"
  }
}
```

**Physics — potential energy well:**
```json
{
  "id": "fp8", "type": "entity", "entity_type": "function_plotter",
  "props": {
    "expr": "x^4 - 4*x^2 + 1",
    "domain": [-2.5, 2.5],
    "title": "Double-Well Potential Energy",
    "caption": "Two stable equilibria at x ≈ ±√2, unstable equilibrium at x = 0"
  }
}
```

**Tip — domain for π-multiples:** Use numeric values: `[-6.2832, 6.2832]` for [−2π, 2π], `[-3.1416, 3.1416]` for [−π, π].
