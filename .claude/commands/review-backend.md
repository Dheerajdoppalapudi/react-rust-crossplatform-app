# review-backend

You are reviewing a backend code change against Zenith's established patterns. For each item, report **PASS**, **FAIL**, or **N/A**. Any FAIL must be fixed before the change is merged.

Run this review on every file touched by the change.

---

## 1. Authentication

| # | Check | Status |
|---|---|---|
| 1.1 | Every endpoint that reads or writes user data has `Depends(get_current_user)` | |
| 1.2 | Every DB query filters by `user_id = current_user.id` — no cross-user data leaks | |
| 1.3 | Public endpoints (no auth) have an inline comment explaining why they are public | |

---

## 2. File path security

| # | Check | Status |
|---|---|---|
| 2.1 | Any path that came from a DB row or query param is validated against `OUTPUTS_DIR` (or `UPLOAD_DIR`) before `open()` / `FileResponse()` / `StreamingResponse()` | |
| 2.2 | Validation uses `Path(p).resolve()` and `startswith(str(OUTPUTS_DIR.resolve()))` — not string prefix matching on the raw path | |
| 2.3 | Upload endpoints (`/api/upload`, `/api/chat-with-files`) require authentication | |

---

## 3. Error handling

| # | Check | Status |
|---|---|---|
| 3.1 | Route handlers raise `HTTPException(status_code=N, detail="...")` for all expected errors | |
| 3.2 | No raw `JSONResponse({"error": ...})` returned from route handlers | |
| 3.3 | Services raise plain Python exceptions (`ValueError`, `RuntimeError`, etc.) — not `HTTPException` | |
| 3.4 | No bare `except: pass` or `except Exception: pass` outside `core/database.py → init_db()` | |
| 3.5 | Global exception handler in `main.py` is not modified (it must catch all unhandled exceptions) | |

---

## 4. Configuration and database

| # | Check | Status |
|---|---|---|
| 4.1 | No `os.getenv()` calls outside `core/config.py` | |
| 4.2 | No hardcoded file paths, URLs, or model names — all from `core/config.py` | |
| 4.3 | No raw `sqlite3.connect()` calls outside `core/database.py` | |
| 4.4 | All DB access via helpers in `core/database.py` (`get_db()`, `insert_*`, `update_*`, auth helpers) | |
| 4.5 | New DB columns added as `ALTER TABLE` migrations in `core/database.py → init_db()` — not via a separate migration tool | |

---

## 5. Response envelope

| # | Check | Status |
|---|---|---|
| 5.1 | All JSON endpoints return `success(...)` from `core/responses.py` | |
| 5.2 | SSE streams and binary file responses are correctly excluded from the `success()` wrapper | |
| 5.3 | No `response_model=` on route decorators (conflicts with `success()` envelope) | |

---

## 6. Schemas

| # | Check | Status |
|---|---|---|
| 6.1 | New endpoints have request and response schemas defined in `backend/schemas/` | |
| 6.2 | Schemas are used to serialize return values: `MySchema(**dict(row)).model_dump()` — not raw `dict(row)` | |
| 6.3 | Unused schema imports removed from router files | |

---

## 7. Logging

| # | Check | Status |
|---|---|---|
| 7.1 | Every module that logs uses `logger = logging.getLogger(__name__)` at module level | |
| 7.2 | No `print()` calls | |
| 7.3 | Log messages use structured key=value format: `logger.info("action  key=%s  key=%s", val, val)` | |
| 7.4 | No sensitive data logged (passwords, tokens, PII, full request bodies) | |

---

## 8. New routers (N/A if no new router file created)

| # | Check | Status |
|---|---|---|
| 8.1 | New router uses `router = APIRouter()` — not `FastAPI()` | |
| 8.2 | New router is added to `main.py` via `app.include_router(router)` | |
| 8.3 | Router prefix / tags are consistent with other routers | |

---

## 9. Architecture and design

| # | Check | Status |
|---|---|---|
| 9.1 | Business logic is in `services/` — route handlers are thin (validate → call service → return) | |
| 9.2 | Route handlers do not exceed ~50 lines; complex logic is extracted to a service function | |
| 9.3 | No circular imports introduced (routers import from services/core — not the reverse) | |
| 9.4 | Context vars (`request_llm_service`, `request_log`, `token_usage`) reset in a `finally` block if set | |

---

## 10. Quick syntax check

Run before declaring the review complete:

```bash
cd backend && python -c "from main import app; print('import OK')"
```

Any import error is a FAIL.

---

## Summary

After reviewing all items, list:

**FAILs** (must fix):
- ...

**Recommendations** (should fix, not blocking):
- ...

**Notes**:
- ...
