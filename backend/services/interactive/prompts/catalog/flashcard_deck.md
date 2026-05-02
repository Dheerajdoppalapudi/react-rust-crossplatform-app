## flashcard_deck

**Use when**: memorising definitions, terms, algorithms, formulas — flippable cards. Use when the user wants to review/study a set of concepts.

**Props**:
- `cards` (array, **required**): `[{ "front": string, "back": string, "hint"?: string }]`
- `stepReveal` (boolean, optional, default `false`): if true, cards advance via `step_controls`
- `caption` (string, optional)

**Example**:
```json
{
  "id": "b7", "type": "entity", "entity_type": "flashcard_deck",
  "props": {
    "cards": [
      { "front": "What is a closure?", "back": "A function that retains access to variables from its enclosing scope after that scope exits.", "hint": "Think about returning a function from another function." },
      { "front": "What is memoization?", "back": "Caching function results for previously seen inputs to avoid recomputation." },
      { "front": "What is the event loop?", "back": "Checks the call stack and callback queue, moves callbacks onto the stack when empty — enabling non-blocking I/O." }
    ],
    "caption": "JavaScript core concepts"
  }
}
```
