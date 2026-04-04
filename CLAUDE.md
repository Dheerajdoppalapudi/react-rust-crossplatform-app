# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What this project is

**Zenith** — an AI-powered visual learning studio. Users submit a text prompt; the system generates an educational video composed of animated diagrams, math visualizations, and narration.

---

## Repository layout

```
/
├── client/                        # React + Vite frontend (see client/CLAUDE.md for detail)
├── backend/                       # Python FastAPI backend
│   ├── main.py                    # App init ONLY: app, middleware, routers, lifespan (~65 lines)
│   ├── core/
│   │   ├── config.py              # ALL env vars and constants — import from here, never os.getenv()
│   │   ├── database.py            # ALL SQLite helpers — get_db(), init_db(), insert_*/update_*, auth helpers
│   │   ├── db_models.py           # Typed dataclasses for DB rows: User, RefreshToken
│   │   ├── responses.py           # success() envelope helper
│   │   └── logging_config.py      # setup_logging() — called once at process start in main.py
│   ├── dependencies/
│   │   └── auth.py                # get_current_user() FastAPI dependency — validates Bearer JWT
│   ├── routers/
│   │   ├── auth.py                # POST /auth/google, POST /auth/refresh, POST /auth/logout, GET /auth/me
│   │   ├── generation.py          # POST /api/image_generation, POST /api/chat
│   │   ├── conversations.py       # GET/POST /api/conversations/**
│   │   ├── sessions.py            # GET /api/sessions/**
│   │   ├── video.py               # POST /api/generate_video/{id}, GET /api/sessions/{id}/video
│   │   └── upload.py              # POST /api/upload, POST /api/chat-with-files
│   ├── schemas/
│   │   ├── generation.py          # GenerationResponse, SVGGenerationResponse, ExcalidrawGenerationResponse
│   │   └── sessions.py            # ConversationSummary, SessionTurn, TreeNode, UploadResponse, etc.
│   ├── services/
│   │   ├── llm_service.py         # Provider-swappable LLM client (OpenAIProvider / ClaudeProvider)
│   │   ├── generation_service.py  # Full generation pipeline logic (extracted from route handler)
│   │   ├── Frame_generation/
│   │   │   ├── planner.py         # Intent classification + frame plan (Stage 1A / 1B)
│   │   │   ├── mermaid/           # Process/architecture/timeline diagrams
│   │   │   ├── manim/             # Math animations
│   │   │   ├── svg/               # Illustrations, comparisons (svg_generator, component_generator, component_library)
│   │   │   ├── excalidraw_enhancer.py
│   │   │   └── combiner.py
│   │   └── video/
│   │       ├── tts_service.py     # Narration → gTTS or OpenAI TTS audio
│   │       ├── video_assembler.py # ffmpeg: frames + audio → MP4
│   │       └── frame_exporter.py  # Normalize frames to 1920×1080 PNG
├── mermaid-converter/             # Sidecar Express service: Mermaid → Excalidraw
│   └── server.js
└── .github/workflows/deploy.yml
```

---

## Commands

### Frontend (`client/`)
```bash
npm install
npm run dev      # http://localhost:5173 — requires backend on :8000
npm run build
npm run lint
npm run preview
```

### Backend (`backend/`)
```bash
# First time
python -m venv env && source env/bin/activate
pip install -r requirements.txt

# Run
source env/bin/activate
python main.py   # FastAPI/Uvicorn on http://localhost:8000
```

### Mermaid converter (`mermaid-converter/`)
```bash
npm install
npm start        # Express on :3001 (used by backend, not the frontend)
```

---

## API response format

Every JSON endpoint returns the same envelope:

```json
// Success
{ "status": "success", "data": <payload> }

// Error
{ "status": "error", "error": "<human-readable message>" }
```

The `core/responses.py` helper:
```python
from core.responses import success
return success({"key": "value"})   # → {"status":"success","data":{"key":"value"}}
```

**Never** return raw `JSONResponse({"error": ...})` — always `raise HTTPException(status_code=N, detail="...")` and let the global handler in `main.py` format it into the envelope.

**Exceptions (not wrapped):**
- `POST /api/generate_video/{id}` — raw SSE stream, not JSON
- File download endpoints (`/video`, `/frame/{n}`, `/merged_video`) — binary responses

The frontend `_request()` helper in `client/src/services/api.js` unwraps the envelope automatically and throws on `status:"error"`.

---

## Authentication

**Pattern:** dual-token — access JWT in React memory + refresh token in HTTP-only cookie.

| Token | Lifetime | Stored in | Immune to |
|---|---|---|---|
| Access JWT | 15 min | React `AuthContext` state (memory) | XSS |
| Refresh token (opaque UUID) | 30 days | HTTP-only `Secure` cookie | XSS |

### Auth flow summary

```
LOGIN
  User clicks "Continue with Google"
  → useGoogleLogin() (implicit flow) → access_token from Google
  → POST /auth/google { access_token }
  → Backend calls Google userinfo endpoint to verify + get profile
  → Backend upserts user row, issues access JWT + refresh token
  → Backend sets refresh_token HTTP-only cookie, returns access JWT in body
  → AuthContext stores access JWT in state (memory only)

SUBSEQUENT API CALLS
  → _request() in api.js reads token via getAccessToken() (module-level getter)
  → Adds Authorization: Bearer <access_token> header to every request
  → On 401: calls /auth/refresh → rotates refresh token → retries original request

PAGE REFRESH (silent restore)
  → AuthContext mounts → calls POST /auth/refresh (browser sends cookie)
  → If valid: stores new access JWT in state → user restored silently
  → If invalid/expired: state stays null → ProtectedRoute redirects to /login

LOGOUT
  → POST /auth/logout (deletes refresh token row from DB, clears cookie)
  → AuthContext wipes access JWT from state → Navigate to /login
```

### Backend auth files

- `backend/dependencies/auth.py` — `get_current_user(credentials) → User` — import and use as `Depends(get_current_user)` on any protected endpoint
- `backend/routers/auth.py` — all four auth endpoints
- `backend/core/db_models.py` — `User` and `RefreshToken` dataclasses (not ORM — plain Python)
- `backend/core/database.py` — auth DB helpers: `upsert_user`, `create_refresh_token`, `rotate_refresh_token`, `delete_refresh_token`, `delete_user_refresh_tokens`

### Protecting a new endpoint

```python
from dependencies.auth import get_current_user
from core.db_models import User

@router.get("/api/my-resource")
def my_resource(current_user: User = Depends(get_current_user)):
    # current_user.id, current_user.email, current_user.name, current_user.avatar
    ...
```

Always filter DB queries by `user_id = current_user.id` to enforce data isolation.

### Frontend auth files

- `client/src/contexts/AuthContext.jsx` — `AuthProvider`, `useAuth()` hook, `getAccessToken()` module-level getter
- `client/src/pages/Login.jsx` — full-screen branded login page with animated orbs + Google button
- `client/src/components/common/ProtectedRoute.jsx` — wraps routes that require login
- `client/src/services/api.js` — `setAuthCallbacks(refresh, logout)` wired from `AuthContext`

### Refresh token rotation

Every `/auth/refresh` call invalidates the old token and issues a new one. If an already-used token arrives again, it means the token was stolen — `rotate_refresh_token()` returns `None` and the endpoint clears the cookie and returns 401.

### Environment variables required

```
# backend/.env
JWT_SECRET_KEY=<64-char cryptographically random string>
ENV=production           # set on EC2 — makes cookies Secure + SameSite=Lax

# client/.env  (also add VITE_GOOGLE_CLIENT_ID to GitHub secrets for CI)
VITE_GOOGLE_CLIENT_ID=<from Google Cloud Console>
```

**Google Cloud Console setup:**
1. Create OAuth 2.0 Client ID → Web application type
2. Authorised JavaScript origins: `http://localhost:5173` + your CloudFront domain
3. No redirect URIs needed — popup flow only (no `GOOGLE_CLIENT_ID` needed in backend; verification is done via Google's userinfo endpoint)

---

## Architecture: end-to-end generation pipeline

1. **Frontend** (`client/src/services/api.js` → `api.imageGeneration(...)`) sends prompt + conversation context to `POST /api/image_generation`.
2. **Route handler** (`routers/generation.py`) resolves the conversation, inserts the session into DB, sets up per-request context vars, then delegates to the pipeline.
3. **Generation pipeline** (`services/generation_service.py → run_generation_pipeline()`) runs all stages:
   - **Stage 1A** — `planner.create_vocab_plan()` — intent classification, element vocabulary (no pixel coords)
   - **Stage 1.5** — `svg/component_generator.generate_svg_components()` — DB lookup + LLM for icons
   - **Stage 1B** — `planner.create_spatial_plan()` — pixel coordinates (runs in parallel with 1.5)
   - **Stage 2** — frame rendering (one path chosen based on intent + availability):
     - SVG path: `svg/svg_generator.generate_svg_frames()` → PNG files
     - Manim path: `manim/manim_generator.generate_manim_frames()` → MP4 files
     - Mermaid path: `mermaid/mermaid_generator.generate_mermaid_frames()` → slim JSON
     - Slim JSON fallback: `planner.generate_all_frames()` → slim JSON
   - **Stage 3** (non-SVG only) — `combiner.combine_frames()` → merged slim JSON
   - **Stage 4** (non-SVG only) — `excalidraw_enhancer.enhance()` → full Excalidraw JSON v2
4. **TTS** (`services/video/tts_service.py`) generates per-frame narration audio. Default: gTTS (free). Pass `?use_openai_tts=true` to use OpenAI TTS (costs money).
5. **Assembler** (`services/video/video_assembler.py`) uses ffmpeg to combine frames + audio into a final MP4.
6. **Response** — session row updated in SQLite, payload returned to frontend.

### Intent routing

| Intent types | Render path |
|---|---|
| `illustration`, `concept_analogy`, `comparison` | SVG → PNG |
| `math` | Manim → MP4 |
| `process`, `architecture`, `timeline` | Mermaid → slim JSON → Excalidraw |
| Any (fallback) | Slim JSON → Excalidraw |

These sets live in `core/config.py` (`SVG_INTENT_TYPES`, `MANIM_INTENT_TYPES`, `MERMAID_INTENT_TYPES`).

### LLM provider switching

`services/llm_service.py` wraps both OpenAI and Anthropic clients. The active provider/model is passed per-request from the frontend (`provider: 'openai'|'claude'`, `model: '<model-id>'`). Default is Claude. Switching providers requires no backend restart.

Per-request LLM state is held in context vars (`request_llm_service`, `request_log`, `token_usage`) in `services/Frame_generation/planner.py`. These are set/reset by the route handler in `routers/generation.py`.

### Configuration

**All** environment variables and hard-coded constants live in `core/config.py`. Never call `os.getenv()` directly in a service or router — always import from `core.config`.

Key config values:
- `OPENAI_MODEL`, `CLAUDE_MODEL` — default model names (override via `.env`)
- `MERMAID_SIDECAR_URL` — Node sidecar URL (default: `http://localhost:3001`)
- `DB_PATH`, `UPLOAD_DIR`, `OUTPUTS_DIR` — storage paths
- `VIDEO_WIDTH`, `VIDEO_HEIGHT`, `VIDEO_FPS`, `TTS_WORDS_PER_SECOND`
- `JWT_SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS` — auth
- `COOKIE_SECURE`, `COOKIE_SAMESITE` — cookie flags (COOKIE_SECURE=True when `ENV=production`)

### Database

SQLite (`backend/database.sqlite`). Schema and safe `ALTER TABLE` migrations live in `core/database.py → init_db()`, which is called once at startup via the FastAPI lifespan hook in `main.py`. No migration tool — migrations run on every startup, guarded by `try/except` (intentional — SQLite has no IF NOT EXISTS for ALTER TABLE).

Tables:
- `users` — Google sub as primary key, email, name, avatar, timestamps
- `refresh_tokens` — opaque UUID tokens, FK to users, expires_at
- `conversations` — has `user_id` column (FK to users)
- `sessions` — has `user_id` column (FK to users)

All DB helpers (`get_db`, `insert_session`, `update_session`, `insert_conversation`, auth helpers) are in `core/database.py`. Import from there — do not open SQLite connections directly in routers or services.

### Conversation threading

Each generation produces a **session** (one video). Sessions belong to a **conversation**. Follow-up prompts carry `conversation_id` + `parent_session_id` + `parent_frame_index` so the LLM has prior-turn context. The "pause-to-ask" feature adds `pauseContext` (frame index + caption) to refine the next generation.

Conversation context is built in `services/generation_service.py → build_conversation_context()`.

---

## Adding a new endpoint — checklist

1. **Add the route** in the appropriate file under `routers/`. If it doesn't fit any existing router, create a new one and `include_router()` in `main.py`.
2. **Add request/response schemas** in `schemas/`. Keep for documentation/IDE support (do not use `response_model=` on the decorator — it conflicts with the success envelope wrapper).
3. **Put business logic in `services/`**, not in the route handler. Route handlers should: validate input → call service → return response.
4. **Read config from `core/config.py`** — never hardcode URLs, paths, or model names.
5. **Use `get_db()` from `core/database.py`** for any DB access.
6. **Use `logger = logging.getLogger(__name__)`** — never `print()`.
7. **Use `raise HTTPException(...)`** — never return raw `JSONResponse({"error": ...})` for error cases.
8. **Add `Depends(get_current_user)`** to any endpoint that should require login. Always filter queries by `user_id = current_user.id`.
9. **Wrap the return value** with `success(...)` from `core/responses.py`.

---

## Adding a new frame renderer

1. Create a new generator in `services/Frame_generation/<type>/<type>_generator.py`.
2. Add the new intent type string to the appropriate frozenset in `core/config.py`.
3. Add a routing branch in `services/generation_service.py → _run_frame_generation()`.
4. The generator must return a list of file paths (PNGs/MP4s) or slim JSON dicts — same contract as existing generators.

---

## Error handling rules

- **Route handlers**: always `raise HTTPException(status_code=N, detail="...")` — never return raw JSON error dicts.
- **Services**: raise plain Python exceptions (`ValueError`, `RuntimeError`, etc.) — let the route handler or global handler catch them.
- **Global handler** in `main.py` catches any unhandled `Exception` and returns `{"status":"error","error":"Internal server error"}` with a 500. Raw tracebacks never reach the client.
- **Bare `except Exception: pass`** is intentional ONLY in `core/database.py → init_db()` for ALTER TABLE migrations. Do not copy this pattern anywhere else.

---

## Video generation (SSE)

`POST /api/generate_video/{session_id}` streams Server-Sent Events. The client reads them as a stream. Event types:

```json
{"type": "stage",        "stage": "export_frames" | "tts" | "assembling", ...}
{"type": "stage_done",   "stage": "...", "duration_s": 1.2}
{"type": "tts_progress", "frame": 3, "total": 5}
{"type": "heartbeat",    "elapsed_s": 22.0}
{"type": "done",         "session_id": "...", "video_path": "..."}
{"type": "error",        "message": "..."}
```

`use_openai_tts` defaults to `false` (gTTS, free). Pass `?use_openai_tts=true` to use OpenAI TTS — this charges your OpenAI account.

Heartbeat events fire every 20s during the assembly stage to prevent nginx `proxy_read_timeout` from closing the connection.

---

## Deployment

CI/CD lives in `.github/workflows/deploy.yml` (triggers on push to `main`):

- **Frontend**: `npm ci` → `npm run build` → S3 sync → CloudFront invalidation.
- **Backend**: SSH to EC2, `git pull`, `pip install -r requirements.txt`, restart systemd services for `backend` and `mermaid-converter`.

Required GitHub secrets: `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`, `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`.

Backend `.env` on EC2 must include: `JWT_SECRET_KEY`, `ENV=production`.

---

## Known gaps / future work

| Item | Status | Notes |
|---|---|---|
| CORS `allow_methods=["*"]` | Permissive | Restrict to `["GET", "POST"]` for production. |
| `/api/chat` endpoint | Stub — echoes message back | Confirm with team: implement or delete. |
| `Frame_generation/` folder name | PascalCase (non-standard) | Rename to `frame_generation/` when ready — touches ~15 import paths. |
| Video generation blocking | Runs in-process | At scale, push to Celery/RQ task queue so long jobs don't block workers. |
| Token revocation list | Not implemented | Access tokens are short-lived (15 min); acceptable. Add Redis blocklist if needed. |

---

## Frontend detail

See [client/CLAUDE.md](client/CLAUDE.md) for: state ownership patterns, error boundary levels, toast API, model constants, theming, pause-to-ask, keyboard shortcuts, and frame strip accessibility.
