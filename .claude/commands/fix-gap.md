# fix-gap

You are fixing one of the six known inconsistencies in the Zenith codebase. Each gap is self-contained. Pick the relevant one from the descriptions below and follow the exact fix instructions.

After fixing, run the verification step for that gap.

---

## GAP-1 — Upload endpoints unauthenticated

**File:** `backend/routers/upload.py`

**Problem:** `POST /api/upload` and `POST /api/chat-with-files` have no `Depends(get_current_user)`. Any unauthenticated client can upload files, and uploaded files are not associated with a user.

**Fix:**

1. Add imports at the top of `upload.py`:
   ```python
   from dependencies.auth import get_current_user
   from core.db_models import User
   ```

2. Add `current_user: User = Depends(get_current_user)` as a parameter to both endpoints.

3. If uploaded files or chat results are stored/retrieved, add `user_id = current_user.id` to the stored record so results can be scoped per user later.

**Verification:**
```bash
# Should return 401
curl -X POST http://localhost:8000/api/upload
# Should return 401
curl -X POST http://localhost:8000/api/chat-with-files
```

---

## GAP-2 — File path traversal in file-serving endpoints

**Files:**
- `backend/routers/sessions.py` — `get_session_output()`, `get_session_log()`, `get_session_frames_meta()`
- `backend/routers/video.py` — `get_session_video()`, `get_merged_video()`

**Problem:** These endpoints read a file path from a DB row and open it without verifying the path is within the expected directory. A crafted DB entry could serve arbitrary files.

**Fix — add this guard before every `open()` / `FileResponse()` / `StreamingResponse()`:**

```python
from pathlib import Path
from core.config import OUTPUTS_DIR
from fastapi import HTTPException

# After fetching path from DB row:
path = row["ui_output_file"]  # or video_path, etc.

resolved = Path(path).resolve()
if not str(resolved).startswith(str(Path(OUTPUTS_DIR).resolve())):
    raise HTTPException(status_code=403, detail="Access denied")
```

Apply this pattern to every file-serving location in sessions.py and video.py where the path originates from a database row.

**Verification:**

```bash
# Manually confirm path validation runs by adding a temporary log:
logger.info("serving  path=%s  resolved=%s", path, resolved)
# Then check the log output shows the resolved path is within OUTPUTS_DIR
```

---

## GAP-3 — ErrorBoundary AppFallback uses hardcoded dark colors

**File:** `client/src/components/error/ErrorBoundary.jsx`

**Problem:** The `AppFallback` function (used when the entire app crashes) has hardcoded colors — `bgcolor: '#111'`, `color: '#f1f5f9'`, `color: '#94a3b8'` — instead of theme tokens.

**Fix:**

Extract `AppFallback` to a standalone functional component so it can call `useTheme()`:

```jsx
// Add this OUTSIDE the ErrorBoundary class
function AppFallbackUI() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: theme.palette.background.default,
        color: theme.palette.text.primary,
      }}
    >
      {/* existing content */}
    </Box>
  )
}
```

Then in the ErrorBoundary class's `renderFallback` method, use `<AppFallbackUI />` instead of the inline function.

**Verification:**
- Toggle dark/light mode — AppFallback should respect the current theme
- Trigger the fallback by temporarily throwing in a top-level component and checking both modes

---

## GAP-4 — Product folder has hardcoded colors and no theme awareness

**Directory:** `client/src/components/product/`

**Files:** `ChatWindow.jsx`, `ChatMessage.jsx`, `ChatInput.jsx`, `ChatEmptyState.jsx`

**Problem:** These components use hardcoded colors (`#fff`, `#f4f4f4`, `#888`, `#e0e0e0`, `#1a1a1a`) and do not use `useTheme()`. They also lack `useToast()` for error surfaces.

**Before fixing, check if these are still in use:**

```bash
grep -r "from.*product/" client/src --include="*.jsx" --include="*.js"
```

**If unused:** Add a deprecation comment at the top of each file:

```jsx
// DEPRECATED — this component is no longer imported anywhere.
// Do not add new code here. Remove this file when confirmed unused.
```

**If still used:** Migrate to theme tokens:

```jsx
import { useTheme } from '@mui/material/styles'
import { useToast } from '../../contexts/ToastContext'

const theme = useTheme()
const toast = useToast()

// Replace all hardcoded colors with theme.palette.* equivalents
// Replace raw error alerts with toast.error(...)
```

**Verification:**
- If deprecated: confirm no import errors after marking
- If migrated: check in both dark and light mode

---

## GAP-5 — Schemas imported but responses return raw dicts

**Files:** `backend/routers/sessions.py`, `backend/routers/conversations.py`

**Problem:** Both routers import Pydantic schemas (`ConversationSummary`, `ConversationDetail`, `SessionSummary`, etc.) but return raw `[dict(r) for r in rows]` instead of using the schemas. This means the actual response shape silently drifts from the documented schema.

**Fix — use schemas to serialize before returning:**

```python
# Instead of:
return success([dict(r) for r in rows])

# Use:
from schemas.sessions import SessionSummary
return success([SessionSummary(**dict(r)).model_dump() for r in rows])
```

For nested structures (conversations with turns):

```python
from schemas.sessions import ConversationDetail, SessionTurn

turns = [SessionTurn(**dict(t)).model_dump() for t in turn_rows]
conv = ConversationDetail(**{**dict(conv_row), "turns": turns}).model_dump()
return success(conv)
```

**What to do with unused imports:** Remove any schema import that is not used after the migration. Unused imports are noise.

**Verification:**

```bash
# Start backend and hit the endpoint, compare shape to schema definition
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/sessions
```

---

## GAP-6 — api.js null-vs-throw convention is undocumented

**File:** `client/src/services/api.js`

**Problem:** Some methods return `null` on failure (getConversation, getConversationTree, getFramesMeta, getConversationNotes). Others throw. There is no documented rule, so developers adding new methods don't know which pattern to follow.

**Fix — add JSDoc comments to all null-returning methods:**

```js
/**
 * Fetches conversation metadata.
 * Returns null on failure — absence is non-fatal; callers render an empty state.
 * @returns {Promise<Conversation|null>}
 */
async getConversation(convId) {
  try {
    // ...existing implementation
  } catch {
    return null
  }
}
```

Add a rule comment near the top of `api.js` (below the imports):

```js
// Error handling convention:
//   Throw on failure  — user-initiated actions (generate, merge, rename, delete).
//                       Callers are responsible for catching and calling toast.error().
//   Return null on failure — background/optional data (conversation tree, frame meta,
//                       notes). Absence is non-fatal; callers render gracefully without data.
// New methods default to throwing. Use the null pattern only when documented above.
```

**Verification:**
- Read through all api.js methods and confirm every null-returning method now has a JSDoc explaining why
- Confirm the top-of-file comment is present
