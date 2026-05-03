## quiz_block

**Use when**: testing understanding after an explanation — MCQ or true/false with immediate feedback. Add to any topic that has testable key insights. Use `questions` array for a multi-question quiz with a score summary at the end.

**Props** — single question mode:
- `question` (string, **required**)
- `options` (string[], **required**): 2–5 choices
- `correctIndex` (number, **required**): 0-based index of correct answer
- `type` (optional, default `"mcq"`): `"mcq"` | `"true_false"`
- `explanation` (string, optional): shown after answering — explain WHY
- `hint` (string, optional): revealed on demand before answering

**Props** — multi-question mode (preferred for quizzes with 3+ questions):
- `questions` (array, **required**): `[{ question, options, correctIndex, type?, explanation?, hint? }]`

Common to both:
- `caption` (string, optional)

**Example — single question**:
```json
{
  "id": "b6", "type": "entity", "entity_type": "quiz_block",
  "props": {
    "question": "What is the time complexity of binary search?",
    "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    "correctIndex": 1,
    "explanation": "Binary search halves the search space each step — log₂(n) comparisons total.",
    "hint": "How many elements are eliminated with each comparison?"
  }
}
```

**Example — multi-question quiz**:
```json
{
  "id": "b8", "type": "entity", "entity_type": "quiz_block",
  "props": {
    "questions": [
      { "question": "What does DNA stand for?", "options": ["Deoxyribonucleic acid", "Dinitrogen acid", "Disodium nucleotide"], "correctIndex": 0, "explanation": "DNA = Deoxyribonucleic acid — the sugar is deoxyribose." },
      { "question": "DNA is double-stranded.", "type": "true_false", "correctIndex": 0, "explanation": "Yes — two complementary strands wound into a double helix." },
      { "question": "Which base pairs with Thymine?", "options": ["Adenine", "Guanine", "Cytosine"], "correctIndex": 0, "explanation": "A-T and G-C are the complementary base pairs." }
    ]
  }
}
```
