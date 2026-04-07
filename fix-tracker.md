# Production Fix Tracker

All issues identified in the production review. Checked off as fixed.

---

## CRITICAL

| ID | Issue | Status | Files Changed |
|---|---|---|---|
| CRIT-1 | Hardcoded JWT secret default | ✅ Fixed (user) | `core/config.py` |
| CRIT-2 | Tokens exposed in URL query strings | ✅ Fixed | `dependencies/auth.py`, `routers/video.py`, `routers/sessions.py`, `routers/conversations.py`, `api.js`, new: `services/mediaToken.js`, `hooks/useMediaUrl.js`, updated: `VideoPanel.jsx`, `FrameThumbnail.jsx` |
| CRIT-3 | Path traversal in file-serving endpoints | ✅ Fixed | `routers/sessions.py`, `routers/video.py`, `routers/conversations.py` |
| CRIT-4 | Unauthenticated upload endpoints | ✅ Fixed | `routers/upload.py` |
| CRIT-5 | Dynamic SQL column injection in `update_session` | ✅ Fixed | `core/database.py` |
| CRIT-6 | Exception detail leaked to API clients | ✅ Fixed | `routers/generation.py`, `routers/video.py`, `routers/conversations.py` |
| CRIT-7 | Memory leaks from unaborted fetch streams | ✅ Fixed | `api.js` (AbortController + 30s timeout), `pages/Studio.jsx` (abort on unmount/conv change) |
| CRIT-8 | Race condition in `handleGenerate` | ✅ Fixed | `pages/Studio.jsx` (generationIdRef staleness guard) |

---

## HIGH

| ID | Issue | Status | Files Changed |
|---|---|---|---|
| HIGH-2 | Blocking I/O in async route handlers | ✅ Fixed | `routers/generation.py` (asyncio.to_thread for file writes), `routers/video.py` (export_frames, assemble) |
| HIGH-3 | No request timeouts on API calls | ✅ Fixed | `api.js` (30s timeout via AbortController) |
| HIGH-5 | Unhandled promise rejections in Sidebar | ✅ Fixed | `App.jsx` (try/catch + toast on rename/star/delete) |
| HIGH-6 | No error reporting in production | ✅ Fixed | `ErrorBoundary.jsx` (Sentry hook in componentDidCatch) |
| HIGH-8 | Stale closure + unawaited promises in `loadConversationById` | ✅ Fixed | `pages/Studio.jsx` (Promise.allSettled + cancelled flag) |
| HIGH-9 | No DB indexes on hot query columns | ✅ Fixed | `core/database.py` (5 indexes: sessions.user_id, sessions.conversation_id, conversations.user_id, conversations.updated_at, refresh_tokens.user_id) |
| HIGH-10 | Missing startup validation of required config | ✅ Fixed | `core/config.py` (RuntimeError if JWT_SECRET_KEY missing), `client/src/main.jsx` (throws if VITE_GOOGLE_CLIENT_ID missing) |

---

## MEDIUM

| ID | Issue | Status | Files Changed |
|---|---|---|---|
| M-1 | Schemas defined but unused for serialization | ✅ Fixed | `routers/sessions.py` (SessionSummary, SessionOutputResponse), `routers/conversations.py` (ConversationSummary, ConversationDetail, ConversationTree, MergeResponse), `schemas/sessions.py` (added `starred` field) |
| M-2 | No health check endpoint | ✅ Fixed | `main.py` — enhanced with real DB probe, returns 503 if DB unavailable |
| M-3 | No rate limiting on generation endpoint | ✅ Fixed | `routers/generation.py` + `main.py` (slowapi, 10 req/min per IP) |
| M-4 | Fragile ALTER TABLE migration approach | ✅ Fixed | `core/database.py` (schema_version table, numbered migrations v1–v9 no-ops + current) |
| M-6 | Studio.jsx and Sidebar.jsx too large | ⏳ Partial | Studio.jsx has video AbortControllers and generationIdRef inlined; full hook extraction deferred |
| M-8 | Missing env var validation on frontend | ✅ Fixed | `client/src/main.jsx` (throws if VITE_GOOGLE_CLIENT_ID missing) |
| M-9 | Retry button has no loading state | ✅ Fixed | `ConversationThread.jsx` (isRetrying state, CircularProgress, disabled while in-flight) |
| M-10 | No structured logging / request ID tracing | ✅ Fixed | `main.py` (X-Request-ID middleware — generates or echoes header, attached to request.state) |

---

## Architecture decisions

### CRIT-2: Token in URLs

**Problem:** `<video src="?token=jwt">` leaks the main access JWT in server logs and browser history.

**Solution:**
- New `POST /api/sessions/{id}/media-token` and `POST /api/conversations/{id}/media-token` endpoints issue short-lived (5 min), resource-scoped JWTs.
- All three binary media endpoints (`/video`, `/frame/{n}`, `/merged_video`) now accept either `?token=<media_token>` (browser `<video src>` / `<img src>`) or `Authorization: Bearer <jwt>` (programmatic clients) — implemented via `resolve_media_user()` in `dependencies/auth.py`.
- Frontend: `services/mediaToken.js` caches tokens per session/conversation with auto-dedup of concurrent requests. `hooks/useMediaUrl.js` is a React hook that fetches the token and returns typed URLs, used in `VideoPanel.jsx` and `FrameThumbnail.jsx`.

### M-3: Rate limiting

`slowapi` applied at 10 req/min per IP on `POST /api/image_generation`. The limiter instance is attached to `app.state` and the `@_limiter.limit("10/minute")` decorator is on the route function (requires `request: Request` as the first parameter — slowapi convention).

### M-10: Request ID tracing

Every request gets a `X-Request-ID` header (UUID hex). If the caller sends one, it's echoed back. If not, one is generated. The ID is attached to `request.state.request_id` and included in all unhandled exception logs for correlation. Route handlers can read `request.state.request_id` for per-request log context.
