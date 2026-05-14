## ds_viewer

**Use when**: teaching or illustrating CS data structures — linked lists, stacks, queues, binary search trees, hash tables. Renders the structure visually with animated insert/delete/search operations the user can trigger themselves via a built-in operations panel (revealed by clicking the edit icon).

**Props**:
- `type` (string, **required**): `"linked_list"` | `"doubly_linked_list"` | `"stack"` | `"queue"` | `"bst"` | `"binary_tree"` | `"hash_table"`
- `nodes` (**required**):
  - For `linked_list`, `doubly_linked_list`, `stack`, `queue`: flat array of values — `[10, 20, 30]`
  - For `bst` / `binary_tree`: flat BFS-level array (`null` = empty slot) — `[50, 30, 70, 20, 40]`, OR nested object `{"value": 50, "left": {"value": 30}, "right": {"value": 70}}`
  - For `hash_table`: array of `{"key": string, "value": string}` pairs
- `buckets` (number, optional, default `8`): number of hash table slots — only for `hash_table`
- `editable` (boolean, optional, default `true`): shows the edit icon that reveals the operations panel
- `caption` (string, optional)

**Built-in operations by type**:
- `linked_list` / `doubly_linked_list`: Insert Head, Insert Tail, Delete (by value), Search
- `stack`: Push, Pop, Peek
- `queue`: Enqueue, Dequeue, Peek
- `bst` / `binary_tree`: Insert, Delete, Search (highlights path)
- `hash_table`: Put (key→value), Get (highlights bucket), Remove

**Example — linked list**:
```json
{
  "id": "b4", "type": "entity", "entity_type": "ds_viewer",
  "props": {
    "type": "linked_list",
    "nodes": [10, 20, 30, 40],
    "caption": "Singly linked list — HEAD at left, ∅ at right"
  }
}
```

**Example — stack**:
```json
{
  "id": "b5", "type": "entity", "entity_type": "ds_viewer",
  "props": {
    "type": "stack",
    "nodes": [5, 12, 8, 3],
    "caption": "LIFO stack — 3 is on top"
  }
}
```

**Example — BST (array form)**:
```json
{
  "id": "b6", "type": "entity", "entity_type": "ds_viewer",
  "props": {
    "type": "bst",
    "nodes": [50, 30, 70, 20, 40, 60, 80],
    "caption": "BST — search highlights the traversal path"
  }
}
```

**Example — BST (object form)**:
```json
{
  "id": "b7", "type": "entity", "entity_type": "ds_viewer",
  "props": {
    "type": "bst",
    "nodes": {
      "value": 50,
      "left":  { "value": 30, "left": { "value": 20 }, "right": { "value": 40 } },
      "right": { "value": 70, "left": { "value": 60 }, "right": { "value": 80 } }
    }
  }
}
```

**Example — hash table**:
```json
{
  "id": "b8", "type": "entity", "entity_type": "ds_viewer",
  "props": {
    "type": "hash_table",
    "nodes": [
      { "key": "name",  "value": "Alice" },
      { "key": "age",   "value": "30"    },
      { "key": "city",  "value": "NYC"   }
    ],
    "buckets": 8,
    "caption": "Hash table with chaining"
  }
}
```

**Example — queue**:
```json
{
  "id": "b9", "type": "entity", "entity_type": "ds_viewer",
  "props": {
    "type": "queue",
    "nodes": ["Task A", "Task B", "Task C"],
    "caption": "FIFO queue — Task A dequeues first"
  }
}
```
