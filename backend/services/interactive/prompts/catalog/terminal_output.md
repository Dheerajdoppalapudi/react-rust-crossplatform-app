## terminal_output

**Use when**: CLI commands with their output — git walkthroughs, build steps, npm/docker commands, debugging sessions.

**Props**:
- `blocks` (array, **required**): `[{ "type": "command"|"output"|"comment", "content": string }]`
  - `command`: shown with `$` prefix — the user types this
  - `output`: what the terminal prints (muted grey)
  - `comment`: annotation with `#` prefix (italic)
- `shell` (string, optional, default `"bash"`): title bar label
- `caption` (string, optional)

**Example**:
```json
{
  "id": "b3", "type": "entity", "entity_type": "terminal_output",
  "props": {
    "blocks": [
      { "type": "comment", "content": "Undo last commit, keep changes staged" },
      { "type": "command", "content": "git reset --soft HEAD~1" },
      { "type": "comment", "content": "Undo last commit, discard changes entirely" },
      { "type": "command", "content": "git reset --hard HEAD~1" },
      { "type": "output",  "content": "HEAD is now at a3f2b1c Add OAuth flow" }
    ]
  }
}
```
