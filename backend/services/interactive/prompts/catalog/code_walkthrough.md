## code_walkthrough

**Use when**: explaining an algorithm, function, or code pattern step by step, where each step highlights a specific line and explains what it does. Always pair with `step_controls` immediately after.

**Props**:
- `language` (string, **required**): `"python"`, `"javascript"`, `"typescript"`, `"java"`, `"cpp"`, `"go"`, `"bash"`, `"sql"`, etc.
- `code` (string, **required**): complete code. Use `\n` for newlines, 4 spaces for indent.
- `steps` (array of `{ "line": int, "explanation": string }`, **required**): min 2 steps, 1-indexed lines.

**Note**: `targetEntityId` in `step_controls` must match this block's `id`.

**Example**:
```json
{
  "id": "b3", "type": "entity", "entity_type": "code_walkthrough",
  "props": {
    "language": "python",
    "code": "def bubble_sort(arr):\n    n = len(arr)\n    for i in range(n):\n        for j in range(n - i - 1):\n            if arr[j] > arr[j+1]:\n                arr[j], arr[j+1] = arr[j+1], arr[j]",
    "steps": [
      { "line": 1, "explanation": "Function receives the list to sort in-place." },
      { "line": 3, "explanation": "Outer loop: one full pass per element." },
      { "line": 4, "explanation": "Inner loop shrinks each pass — already-sorted tail is skipped." },
      { "line": 5, "explanation": "Compare adjacent pair; swap if out of order." }
    ]
  }
}
```
