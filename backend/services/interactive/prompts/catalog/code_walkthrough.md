## code_walkthrough

**Use when**: explaining an algorithm, function, or code pattern step by step, where each step highlights a specific line and explains what it does. Step navigation controls are **built in** — do NOT add a `step_controls` block after this entity.

**Props**:
- `language` (string, **required**): `"python"` | `"javascript"` | `"typescript"` | `"java"` | `"cpp"` | `"c"` | `"go"` | `"sql"` | `"bash"` | `"html"` | `"xml"` | `"shell"`
- `code` (string, **required**): complete code snippet. Use `\n` for newlines, 4 spaces for indent.
- `steps` (array of `{ "line": int, "explanation": string }`, **required**): min 2 steps, 1-indexed line numbers.

**Built-in controls**: play/pause auto-advance, prev/next step buttons, speed selector, progress bar, and keyboard navigation (← / → / Space) are rendered automatically inside the component. No separate `step_controls` block is needed or should be added.

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

**Go example**:
```json
{
  "id": "b5", "type": "entity", "entity_type": "code_walkthrough",
  "props": {
    "language": "go",
    "code": "func binarySearch(arr []int, target int) int {\n    lo, hi := 0, len(arr)-1\n    for lo <= hi {\n        mid := (lo + hi) / 2\n        if arr[mid] == target {\n            return mid\n        } else if arr[mid] < target {\n            lo = mid + 1\n        } else {\n            hi = mid - 1\n        }\n    }\n    return -1\n}",
    "steps": [
      { "line": 2, "explanation": "Initialize search bounds to the full slice." },
      { "line": 3, "explanation": "Loop until the search space is exhausted." },
      { "line": 4, "explanation": "Compute midpoint to avoid integer overflow." },
      { "line": 5, "explanation": "Target found — return its index." },
      { "line": 7, "explanation": "Target is in the right half — discard left." },
      { "line": 9, "explanation": "Target is in the left half — discard right." }
    ]
  }
}
```
