# add-endpoint

You are adding a new FastAPI endpoint to the Zenith backend. Follow every step in order. Do not skip steps. Self-verify each checkbox before moving on.

---

## Step 0 — Gather requirements

If any of these are not clear from the request, ask before writing code:

- HTTP method and path (e.g. `POST /api/widgets/{id}`)
- What data it reads or writes
- Whether it requires authentication (default: yes — if no, document why)
- Whether it needs a new DB column or table
- Whether it returns JSON, a file stream, or SSE

---

## Step 1 — Router placement

Find the right router under `backend/routers/`. Match by domain:

| Domain | File |
|---|---|
| Auth, login, tokens | `auth.py` |
| Conversation CRUD | `conversations.py` |
| Session reads, file serving | `sessions.py` |
| Video generation, SSE | `video.py` |
| Image/chat generation pipeline | `generation.py` |
| File uploads | `upload.py` |

If the new endpoint doesn't fit any existing router, create a new router file and add `app.include_router(new_router)` in `main.py`.

Every router file must have at its top:

```python
import logging
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter()
logger = logging.getLogger(__name__)
```

---

## Step 2 — Request and response schemas

Add Pydantic models to the appropriate file in `backend/schemas/`.

**Rules:**
- Request bodies: use Pydantic `BaseModel` — FastAPI validates automatically
- Response shape: define a schema for IDE support and documentation
- **Never** add `response_model=` to the route decorator — it conflicts with the `success()` envelope wrapper
- **Do** use the schema to serialize before returning: `return success(MyResponseSchema(**data).model_dump())`
- If the response is a list of DB rows: `return success([MyRowSchema(**dict(r)).model_dump() for r in rows])`

---

## Step 3 — Authentication

**All endpoints that serve or mutate user data must be protected.**

```python
from dependencies.auth import get_current_user
from core.db_models import User

@router.post("/api/my-resource")
def my_endpoint(current_user: User = Depends(get_current_user)):
    ...
```

**Always** filter DB queries by `user_id = current_user.id` — never return data belonging to another user.

If the endpoint is intentionally public, add an inline comment:

```python
# Public endpoint — no auth required: this serves static metadata only
@router.get("/api/public-info")
def public_info():
    ...
```

---

## Step 4 — Business logic

Keep route handlers thin:

```
Route handler:
  1. Validate / parse input
  2. Call service function(s)
  3. return success(result)

Service (backend/services/):
  - All business logic lives here
  - Raises plain Python exceptions (ValueError, RuntimeError, etc.)
  - Never imports from fastapi or depends on HTTP context
```

If the logic is simple enough (1–3 DB calls, no branching), it can live directly in the router. Extract to a service when the handler exceeds ~30 lines or when the logic is shared.

---

## Step 5 — Error handling

```python
# In route handlers — always HTTPException
if not row:
    raise HTTPException(status_code=404, detail="Resource not found")

if not current_user.id == row["user_id"]:
    raise HTTPException(status_code=403, detail="Access denied")

# In services — always plain Python exceptions
if invalid_input:
    raise ValueError("Expected X but got Y")
```

**Never** return `JSONResponse({"error": ...})` — the global handler in `main.py` converts all `HTTPException` instances to the `{"status":"error","error":"..."}` envelope automatically.

**Never** use bare `except: pass` outside of `core/database.py → init_db()`.

---

## Step 6 — Configuration and database

```python
# Config — always import from core.config, never os.getenv()
from core.config import OUTPUTS_DIR, SOME_OTHER_CONSTANT

# DB — always use helpers from core/database.py, never raw sqlite3
from core.database import get_db, insert_session, update_session

with get_db() as conn:
    rows = conn.execute("SELECT * FROM sessions WHERE user_id = ?", [current_user.id]).fetchall()
```

If the endpoint needs new DB columns: add an `ALTER TABLE` migration in `core/database.py → init_db()` (guarded by `try/except` — see existing pattern).

---

## Step 7 — File path security

Any endpoint that opens a file whose path came from the database **must** validate the path before use:

```python
from pathlib import Path
from core.config import OUTPUTS_DIR
from fastapi import HTTPException

resolved = Path(db_path).resolve()
if not str(resolved).startswith(str(Path(OUTPUTS_DIR).resolve())):
    raise HTTPException(status_code=403, detail="Access denied")
```

Apply to any `open()`, `FileResponse()`, or `StreamingResponse()` where the path originated from a DB row or query parameter.

---

## Step 8 — Response

```python
from core.responses import success

# Standard JSON endpoint
return success({"key": "value"})

# List from DB rows
return success([MySchema(**dict(r)).model_dump() for r in rows])
```

**Exceptions that are NOT wrapped in success():**
- SSE streams (`StreamingResponse` with `media_type="text/event-stream"`)
- Binary file downloads (`FileResponse`, `StreamingResponse` with file content)

---

## Step 9 — Logging

```python
logger = logging.getLogger(__name__)  # at module top, not inside functions

# Log significant state transitions with key=value pairs
logger.info("resource_created  user=%s  id=%s", current_user.id, resource_id)
logger.warning("resource_not_found  user=%s  id=%s", current_user.id, resource_id)
logger.error("unexpected_error  path=%s", request.url.path, exc_info=True)
```

Never use `print()`. Never log sensitive data (passwords, tokens, PII).

---

## Step 10 — Self-verification checklist

Before marking the task done, confirm every item:

- [ ] Route is in the correct router file (or a new router is wired in `main.py`)
- [ ] Request/response schemas exist in `backend/schemas/`
- [ ] No `response_model=` on the decorator
- [ ] Endpoint is protected with `Depends(get_current_user)` (or has a documented reason why not)
- [ ] All DB queries filter by `user_id = current_user.id`
- [ ] File paths from DB are validated against `OUTPUTS_DIR` before use
- [ ] Config values imported from `core/config.py` — no `os.getenv()` calls
- [ ] DB access through `core/database.py` helpers — no raw `sqlite3.connect()`
- [ ] Errors raised as `HTTPException` in router, plain exceptions in service
- [ ] Return value wrapped in `success()` (unless SSE/binary)
- [ ] Logging uses `logger = logging.getLogger(__name__)` with key=value pairs
- [ ] No `print()` calls

**Syntax check:**

```bash
cd backend && python -c "from main import app; print('import OK')"
```
