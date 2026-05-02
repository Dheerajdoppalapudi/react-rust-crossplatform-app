## diff_viewer

**Use when**: showing code before and after a change — refactors, bug fixes, type annotations, API migrations.

**Props**:
- `before` (string, **required**): original code, use `\n` for newlines
- `after` (string, **required**): updated code, use `\n` for newlines
- `language` (string, optional, default `"python"`)
- `mode` (optional, default `"split"`): `"split"` = side-by-side | `"unified"` = single panel with +/-
- `caption` (string, optional)

**Example**:
```json
{
  "id": "b4", "type": "entity", "entity_type": "diff_viewer",
  "props": {
    "before":   "def add(a, b):\n    return a + b",
    "after":    "def add(a: int, b: int) -> int:\n    \"\"\"Add two integers.\"\"\"\n    return a + b",
    "language": "python", "mode": "split",
    "caption":  "Adding type hints and docstring"
  }
}
```
