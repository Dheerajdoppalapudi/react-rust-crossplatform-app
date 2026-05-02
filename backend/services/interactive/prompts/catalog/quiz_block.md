## quiz_block

**Use when**: testing understanding after an explanation — one MCQ or true/false with immediate feedback. Add to any topic that has a single testable key insight.

**Props**:
- `question` (string, **required**)
- `options` (string[], **required**): 2–5 choices. Ignored for `true_false`.
- `correctIndex` (number, **required**): 0-based index of correct answer
- `type` (optional, default `"mcq"`): `"mcq"` | `"true_false"` (auto-generates True/False options)
- `explanation` (string, optional): shown after answering — explain WHY the answer is correct
- `hint` (string, optional): revealed on demand before answering
- `caption` (string, optional)

**Example**:
```json
{
  "id": "b6", "type": "entity", "entity_type": "quiz_block",
  "props": {
    "question":     "What is the time complexity of binary search?",
    "options":      ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    "correctIndex": 1,
    "explanation":  "Binary search halves the search space each step — log₂(n) comparisons total.",
    "hint":         "How many elements are eliminated with each comparison?"
  }
}
```
