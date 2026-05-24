# Zenith Backend — CLAUDE.md

> Read this file before touching any backend code. It gives you the full mental model.

---

## What this project is

**Zenith** is an AI-powered visual learning studio. A user types a question; the system generates an educational lesson as either:
- **Interactive mode** — live cited lesson blocks (text, diagrams, charts, code) streamed via SSE
- **Video mode** — an animated educational video (SVG frames / Manim animations / Mermaid diagrams + narration)

The backend is a **FastAPI / Python** application. All AI generation is streamed to the client via Server-Sent Events (SSE).

---

## How to run

```bash
# Backend
cd backend/
source env/bin/activate
python main.py           # FastAPI + Uvicorn on :8000

# Tests
python -m pytest tests/ -v

# Mermaid sidecar (required for Mermaid diagrams)
cd mermaid-converter/
npm start                # Express on :3001
```

**First-time setup:**
```bash
python -m venv env && source env/bin/activate
pip install -r requirements.txt
playwright install chromium   # for SVG animation screenshots
```

**Required `.env` (in `backend/`):**
```
# Auth
JWT_SECRET_KEY=<64-char random string>

# LLM
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
TAVILY_API_KEY=tvly-...

# PostgreSQL (RDS)
DATABASE_URL=postgresql://user:password@host:5432/zenith

# AWS S3 + CloudFront
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_MEDIA_BUCKET=zenith-app-media
S3_UPLOADS_BUCKET=zenith-app-uploads
CLOUDFRONT_DOMAIN=dXXXXXXX.cloudfront.net

ENV=production            # enables Secure cookies in production
```

---

## Directory map

```
backend/
├── main.py                          # App wiring ONLY: app, middleware, routers, lifespan
│
├── core/                            # Shared infrastructure — import from here, never bypass
│   ├── config.py                    # ALL constants and env vars — single source of truth
│   ├── database.py                  # ALL PostgreSQL helpers: get_db(), init_db(), insert_*, update_*
│   ├── s3.py                        # S3 + CloudFront helpers: upload, key derivation, presigned URLs
│   ├── db_models.py                 # Typed dataclasses for DB rows: User
│   ├── limiter.py                   # slowapi Limiter singleton (avoids circular import via main.py)
│   ├── logging_config.py            # setup_logging() — structlog JSON (prod) / console (dev)
│   ├── responses.py                 # success() envelope helper
│   └── utils.py                     # safe_resolve() path guard, read_json_file() with size limit
│
├── dependencies/
│   └── auth.py                      # get_current_user() FastAPI dependency — validates Bearer JWT
│
├── routers/
│   ├── auth.py                      # POST /auth/google, /auth/register, /auth/login, /auth/refresh, /auth/logout, GET /auth/me
│   ├── generate.py                  # POST /api/generate — main SSE stream (all 4 mode combos)
│   ├── conversations.py             # GET/POST/PATCH/DELETE /api/conversations/**
│   ├── sessions.py                  # GET /api/sessions/**
│   ├── video.py                     # POST /api/generate_video/{id}, GET /api/sessions/{id}/video
│   └── upload.py                    # POST /api/upload, POST /api/chat-with-files
│
├── schemas/
│   ├── generation.py                # GenerationResponse, SVGGenerationResponse
│   └── sessions.py                  # ConversationSummary, SessionTurn, TreeNode, ConversationDetail, etc.
│
├── services/
│   ├── llm_service.py               # Provider-swappable LLM client (Claude default, OpenAI fallback)
│   ├── generation_service.py        # Video pipeline orchestration: run_video_pipeline_from_intent()
│   │
│   ├── frame_generation/            # Video frame renderers
│   │   ├── planner.py               # Intent classification + frame planning (Stage 1A/1B)
│   │   ├── svg/svg_generator.py     # SVG → animated PNG via Playwright
│   │   └── manim/manim_generator.py # Manim Python script → MP4
│   │
│   ├── interactive/                 # Interactive lesson pipeline
│   │   ├── interactive_service.py   # Scene IR generation via SSE
│   │   └── scene_ir.py              # SceneIR dataclass + block validation
│   │
│   ├── research/                    # Deep research pipeline
│   │   ├── search_provider.py       # Tavily search + extract (TavilyProvider singleton)
│   │   ├── source_processor.py      # Rank, deduplicate, truncate sources
│   │   ├── synthesiser.py           # Stream cited markdown answer via Anthropic
│   │   ├── vector_store.py          # ChromaDB: embed + store + retrieve prior sources
│   │   ├── file_extractor.py        # Extract text from uploaded PDFs/PPTXes
│   │   └── research_service.py      # source_summary(), source_full() formatters
│   │
│   └── video_generation/            # Video assembly pipeline
│       ├── tts_service.py           # Text → audio (gTTS free / OpenAI TTS paid)
│       ├── frame_exporter.py        # Normalize frames → 1920×1080 PNG
│       └── video_assembler.py       # ffmpeg: frames + audio → MP4
│
└── tests/
    ├── conftest.py                  # Shared fixtures: tmp_db, mock_llm, mock_tavily
    ├── test_extract_json.py
    ├── test_input_validation.py
    ├── test_path_security.py
    ├── test_turn_index.py
    ├── test_auth.py
    └── test_vector_store.py
```

---

## The generation pipeline — end to end

Every user message hits `POST /api/generate` and streams SSE events back. There are 4 mode combinations:

| `research_mode` | `render_mode` | What happens |
|---|---|---|
| `instant` | `interactive` | No search → interactive lesson blocks streamed immediately |
| `instant` | `video` | No search → video frames generated |
| `deep_research` | `interactive` | Tavily search → synthesis → interactive lesson blocks |
| `deep_research` | `video` | Tavily search → synthesis → video frames |

### Phase 1 — Research (only in `deep_research` mode)

```
_search_phase() in generate.py
  ├── emit {type:'stage', stage:'thinking'}
  ├── Generate search queries via LLM
  ├── emit {type:'stage', stage:'searching'}
  ├── asyncio.gather(_bounded_search(q) for q in queries)   ← Semaphore(3) caps concurrency
  ├── emit {type:'stage', stage:'reading'}
  ├── rank_and_deduplicate() → top N sources
  ├── emit {type:'source', source:{title,url,snippet,domain}} for each
  └── upsert_sources() → ChromaDB (for follow-up retrieval)
```

### Phase 2A — Interactive lesson generation

```
interactive_service.generate_interactive_lesson()
  ├── _select_entities() → 2-5 entity names best for the question
  ├── _plan_scene()      → SceneIR (full schemas + injected sources for citation)
  ├── emit {type:'meta', title, follow_ups, learning_objective}
  └── for each block in SceneIR:
        emit {type:'block', block:{id, type, props, ...}}
```

### Phase 2B — Video frame generation

```
run_video_pipeline_from_intent() in generation_service.py
  Stage 1A: planner.plan_and_classify()    → intent + vocab plan (no pixel coords)
  Stage 1.5: svg/component_generator      → icon DB lookup + LLM
  Stage 1B: planner.create_spatial_plan() → pixel coordinates
  Stage 2:  intent-routed rendering:
    SVG_INTENT_TYPES   → svg_generator.generate_svg_frames() → PNG files
    MANIM_INTENT_TYPES → manim_generator.generate_manim_frames() → MP4
    fallback           → planner.generate_all_frames() → slim JSON
  emit {type:'frame', index, image, caption} for each frame
```

### Intent routing constants (in `core/config.py`)

```python
MANIM_INTENT_TYPES = frozenset({"math"})
SVG_INTENT_TYPES   = frozenset({"illustration", "concept_analogy", "comparison",
                                 "process", "architecture", "timeline"})
# Everything else → slim JSON fallback
```

### SSE event schema — full reference

```json
// Research phase
{"type": "stage",      "stage": "thinking|searching|reading", "label": "..."}
{"type": "stage_done", "stage": "...", "duration_s": 1.2}
{"type": "source",     "source": {"title","url","snippet","domain"}}
{"type": "token",      "text": "..."}        // synthesis streaming tokens

// Interactive phase
{"type": "meta",  "title": "...", "follow_ups": [...], "learning_objective": "..."}
{"type": "block", "block": {"id","type","props",...}}

// Video phase
{"type": "stage", "stage": "planning|generating_frames", "label": "..."}
{"type": "frame", "index": 0, "image": "<base64 PNG>", "caption": "..."}

// Shared
{"type": "init",      "conversation_id": "..."}   // fired first, before any LLM call
{"type": "heartbeat", "elapsed_s": 22.0}           // every 20s to prevent proxy timeout
{"type": "done",      "session_id", "conversation_id", "turn_index", "render_path", ...}
{"type": "error",     "message": "..."}
```

---

## LLM service

**File:** `services/llm_service.py`

Provider-swappable: `ClaudeProvider` (default) or `OpenAIProvider`. Swap via:
```python
default_llm_service = LLMService(provider=OpenAIProvider(model="gpt-4.1"))
```

**Module-level singletons** — one HTTP connection pool per provider, shared across all requests:
```python
_anthropic_client       = None   # sync — lazy-init via _get_anthropic_client()
_openai_client          = None   # sync — lazy-init via _get_openai_client()
_async_anthropic_client = None   # async — lazy-init via _get_async_anthropic_client()
_async_openai_client    = None   # async — lazy-init via _get_async_openai_client()
```

**Sync methods** (use only from sync helpers or inside `asyncio.to_thread()`):
```python
llm_service.make_completion_request(messages)
llm_service.make_single_prompt_request(prompt, cache_prefix="", tool_schema=None)
llm_service.make_system_user_request(system_prompt, user_prompt)
```

**Async methods** (use from async contexts — no thread pool needed):
```python
await llm_service.make_completion_request_async(messages)
await llm_service.make_single_prompt_request_async(prompt, cache_prefix="", tool_schema=None)
await llm_service.make_system_user_request_async(system_prompt, user_prompt)
```

**Async is the default** for all orchestration code. Use `asyncio.to_thread()` ONLY for frame generators (svg_generator, manim_generator, beat_generator) that call the sync `call_llm()` internally.

**call_llm_async()** (planner.py) — async drop-in for `call_llm()` used in orchestration:
```python
# planner.py
raw = await call_llm_async(prompt, max_tokens, prompt_name="...", cache_prefix="...")
# NOT: await asyncio.to_thread(call_llm, prompt, ...)
```

**Prompt caching** (Anthropic only): pass `cache_prefix=<static_template_text>` to mark the static portion as ephemeral (10× cheaper on cache hits).

**Model allowlists** — validated on every `/api/generate` call before any DB write:
```python
ALLOWED_CLAUDE_MODELS = {"claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-7"}
ALLOWED_OPENAI_MODELS = {"gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"}
```

---

## Authentication

**Pattern:** dual-token — access JWT in React memory + refresh token in HTTP-only cookie.

| Token | Lifetime | Stored |
|---|---|---|
| Access JWT | 15 min | React state (XSS-safe) |
| Refresh token (opaque UUID) | 30 days | HTTP-only Secure cookie |

**Flow:** `POST /auth/google` → Google userinfo → upsert user → issue JWT + refresh cookie.

**Refresh token rotation:** Every `/auth/refresh` atomically deletes the old token (`DELETE ... WHERE token = ? AND expires_at > ?`) and inserts a new one via `RETURNING user_id`. If `rowcount == 0` the token is missing or expired → 401. This is a single atomic operation — no race condition possible.

**Rate limits:**
- `/auth/login` → `5/minute` per IP
- `/auth/register` → `5/minute` per IP
- `/auth/google` → `10/minute` per IP

**Protecting a new endpoint:**
```python
from dependencies.auth import get_current_user
from core.db_models import User

@router.get("/api/my-resource")
def my_resource(current_user: User = Depends(get_current_user)):
    # Always filter by user_id for data isolation
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM x WHERE user_id = ?", (current_user.id,)).fetchall()
```

---

## Database

**Engine:** PostgreSQL 16 on AWS RDS. Connection managed via `asyncpg` pool (min=2, max=50, acquire timeout=5s).

**All DB access** must go through `core/database.py`. Never import psycopg2 directly in routers or services.

```python
from core.database import get_db, insert_session, update_session, insert_conversation
```

### `_PGConn` wrapper

`get_db()` returns a `_PGConn` that wraps psycopg2 and exposes the same API as the old sqlite3 connection:
- `conn.execute(sql, params)` — accepts `?` placeholders (auto-converted to `%s`), returns a `RealDictCursor`
- `conn.commit()` / `conn.rollback()`
- `with get_db() as conn:` — commits on success, rolls back on exception, returns connection to pool

```python
with get_db() as conn:
    row  = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    rows = conn.execute("SELECT * FROM sessions WHERE conversation_id = ?", (conv_id,)).fetchall()
    cur  = conn.execute("UPDATE sessions SET status = ? WHERE id = ?", ("done", sid))
    conn.commit()
    # cur.rowcount is available
```

### Tables

| Table | Key columns |
|---|---|
| `users` | `id` (Google sub or UUID), `email`, `auth_provider`, `password_hash`, `created_at` (TIMESTAMPTZ) |
| `refresh_tokens` | `token`, `user_id`, `expires_at` (TIMESTAMPTZ, FK → users) — max 5 per user (oldest pruned on insert) |
| `conversations` | `id`, `title`, `user_id`, `starred`, `deleted_at`, `merged_video_path` |
| `sessions` | `id`, `prompt`, `conversation_id`, `turn_index`, `user_id`, `status`, `intent_type`, `render_path`, `frame_count`, `output_dir`, `sources_json`, `synthesis_text`, `stages_json`, `research_mode`, `video_path` |
| `conversation_notes` | `conversation_id`, `user_id`, `content`, `updated_at` |

### Indexes

```sql
idx_sessions_user_id         ON sessions(user_id)
idx_sessions_conversation_id ON sessions(conversation_id)
idx_sessions_status          ON sessions(status)
idx_sessions_created_at      ON sessions(created_at DESC)
idx_conversations_user_id    ON conversations(user_id)
idx_conversations_updated_at ON conversations(updated_at DESC)
idx_conversations_deleted    ON conversations(deleted_at) WHERE deleted_at IS NOT NULL
idx_sessions_conv_turn_user  UNIQUE ON sessions(conversation_id, turn_index, user_id)
                              WHERE conversation_id IS NOT NULL
```

### Atomic turn_index insert

`insert_session()` uses a SQL subquery to assign `turn_index` atomically — no race condition:
```sql
INSERT INTO sessions (..., turn_index)
VALUES (..., COALESCE(
    (SELECT MAX(turn_index) FROM sessions WHERE conversation_id=%s AND user_id=%s), 0
) + 1)
```
Pass `turn_index=1` explicitly only for the first turn of a new conversation.

### Timestamp columns

All timestamp columns are `TIMESTAMPTZ` (not `TEXT`). asyncpg returns them as timezone-aware `datetime` objects automatically.

`_now()` in `db_async.py` returns `datetime.now(timezone.utc)` — a native `datetime`. Never call `.strftime()` before passing to asyncpg; pass the `datetime` object directly.

**Deployment ordering for migration 002:**
1. Run `alembic upgrade head` (converts TEXT → TIMESTAMPTZ in existing DB)
2. Then deploy new app code (which passes `datetime` objects)
Never deploy the new code against an un-migrated DB.

### Schema management

`init_db()` in `core/db_async.py` runs on every startup. All tables and indexes use `IF NOT EXISTS` — safe to call repeatedly. All timestamp columns are declared as `TIMESTAMPTZ` in the schema (for fresh deployments after migration 002).

---

## S3 + CloudFront — `core/s3.py`

Two buckets:

| Bucket | Access | Used for |
|---|---|---|
| `zenith-app-media` | Public via CloudFront | Generated frames, videos, meta artifacts |
| `zenith-app-uploads` | Private, presigned URLs | User-uploaded PDFs, PPTXes, images |

### Key derivation — never store S3 paths in the DB (except `merged_video_path` which stores the CDN URL)

```python
from core.s3 import frame_key, video_key, beats_clip_key, merged_video_key, meta_key
from core.s3 import frames_json_key, narration_key, activity_log_key, cdn_url

frame_key(session_id, 0)              # → "frames/{session_id}/000.png"
video_key(session_id)                 # → "video/{session_id}/final.mp4"
beats_clip_key(session_id, n)         # → "video/{session_id}/beat_NNN.mp4"
merged_video_key(conversation_id)     # → "merged/{conversation_id}/final.mp4"
frames_json_key(session_id)           # → "meta/{session_id}/frames.json"
narration_key(session_id)             # → "meta/{session_id}/narration.txt"
activity_log_key(session_id)          # → "meta/{session_id}/activity_log.json"
meta_key(session_id, "scene_ir.json") # → "meta/{session_id}/scene_ir.json"
cdn_url(key)                          # → "https://dXXX.cloudfront.net/{key}"
```

### Upload helpers

```python
from core.s3 import (upload_frame, upload_video, upload_scene_ir, upload_frames_json,
                     upload_narration, upload_activity_log, upload_merged_video,
                     upload_bytes, presigned_url)

url = upload_frame(local_path, session_id, index)
url = upload_video(local_path, session_id)
url = upload_scene_ir(json_bytes, session_id)
url = upload_frames_json(json_bytes, session_id)
url = upload_narration(text, session_id)
url = upload_activity_log(json_bytes, session_id)
url = upload_merged_video(local_path, conversation_id)  # stores in merged/{id}/final.mp4
key = upload_user_file(local_path, key)                 # private bucket, returns key only
url = presigned_url(key, expires_in=3600)               # for private uploads
```

### Download helpers (S3-first, local fallback pattern)

```python
from core.s3 import download_json, download_text, frames_json_key, narration_key, meta_key

data = download_json(frames_json_key(session_id))   # returns dict or None
text = download_text(narration_key(session_id))     # returns str or None
# Always fall back to local filesystem if S3 returns None
```

### Cache policies (set in CloudFront behaviors)

| Path prefix | TTL | Reason |
|---|---|---|
| `frames/*` | 7 days | Immutable once generated |
| `video/*` | 1 day | Immutable once assembled |
| `merged/*` | no-cache | Regeneratable on demand |
| `meta/*` | 1 min | Regeneratable (scene_ir.json may be overwritten) |

---

## Configuration — `core/config.py`

**Rule:** Never call `os.getenv()` outside `core/config.py`. Every other file imports from here.

### Key constants

```python
# Paths
UPLOAD_DIR, OUTPUTS_DIR, CHROMADB_PATH

# PostgreSQL
DATABASE_URL          # full connection string

# AWS
AWS_REGION, S3_MEDIA_BUCKET, S3_UPLOADS_BUCKET, CLOUDFRONT_DOMAIN

# LLM
ANTHROPIC_API_KEY, OPENAI_API_KEY
CLAUDE_MODEL        = "claude-haiku-4-5-20251001"  # default generation model
CLASSIFY_MODEL      = "claude-haiku-4-5-20251001"  # intent classification
OPENAI_MODEL        = "gpt-4.1"
EMBEDDING_MODEL     = "text-embedding-3-small"
PROMPT_CACHE_ENABLED = True

# Research
TAVILY_API_KEY
DEEP_SEARCH_ROUNDS, DEEP_SEARCH_QUERIES, DEEP_SEARCH_SOURCES
FOLLOWUP_TOP_K_SOURCES = 8
INSTANT_MAX_QUERIES    = 3
DEEP_MAX_QUERIES       = 5

# Generation tuning
HEARTBEAT_INTERVAL_SECS      = 20
CONVERSATION_TITLE_MAX_CHARS = 80
LLM_DEFAULT_MAX_TOKENS       = 4096
SCENE_PLANNER_MAX_TOKENS     = 8192
SOURCES_SNIPPET_MAX_CHARS    = 2500
MAX_FRAMES_JSON_BYTES        = 10_000_000

# Auth
JWT_SECRET_KEY, JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES  = 15
REFRESH_TOKEN_EXPIRE_DAYS    = 30
MEDIA_TOKEN_EXPIRE_MINUTES   = 5
COOKIE_SECURE                = True   # only when ENV=production

# Intent routing
MANIM_INTENT_TYPES, SVG_INTENT_TYPES

# Video
VIDEO_WIDTH=1920, VIDEO_HEIGHT=1080, VIDEO_FPS=24
TTS_WORDS_PER_SECOND = 2.3
```

---

## Research pipeline — `services/research/`

| File | Role |
|---|---|
| `search_provider.py` | `TavilyProvider.search()` + `.extract()` — all web access flows through here. Module-level singleton `tavily`. Both methods have `asyncio.wait_for(timeout=20.0)`. |
| `source_processor.py` | `rank_and_deduplicate()` + `truncate_content()` — filters and trims raw Tavily results |
| `vector_store.py` | ChromaDB wrapper. `upsert_sources()` + `retrieve_sources()`. Thread-safe init (double-checked lock). Collection name = `f"conv_{conversation_id}"`. |
| `synthesiser.py` | `stream()` — async generator yielding cited markdown tokens. Uses `asyncio.get_running_loop()` (not deprecated `get_event_loop()`). Falls back to blocking call if streaming fails. |
| `file_extractor.py` | `extract_urls_from_text()` + `extract_text()` — pulls text from uploaded PDFs and PPTXes |
| `research_service.py` | `source_summary()` / `source_full()` — formats source dicts for injection into prompts |

**Tavily concurrency cap** — in `generate.py`:
```python
_tavily_sem = asyncio.Semaphore(3)   # max 3 parallel Tavily calls
async def _bounded_search(q):
    async with _tavily_sem:
        return await tavily.search(q, max_results=5)
```

---

## Security invariants — never violate these

### 1. Path traversal guard

Every file-serving endpoint that opens a path from the DB or user input must use `safe_resolve()`:

```python
from core.utils import safe_resolve, read_json_file

resolved = safe_resolve(db_row["output_path"], label="frames")
data = read_json_file(resolved)   # also enforces 10 MB size limit
```

### 2. All endpoints require auth

Every endpoint reading or writing user data must have:
```python
current_user: User = Depends(get_current_user)
```

Always filter DB queries by `user_id = current_user.id`.

### 3. File upload type validation

`POST /api/upload` and `POST /api/chat-with-files` validate extension against an explicit allowlist before reading content:

```python
_ALLOWED_EXTENSIONS = frozenset({
    '.pdf', '.pptx', '.docx', '.txt', '.csv',
    '.png', '.jpg', '.jpeg', '.gif', '.webp',
    '.mp4', '.mov', '.mp3', '.wav',
})
ext = Path(file.filename or "").suffix.lower()
if ext not in _ALLOWED_EXTENSIONS:
    raise HTTPException(status_code=415, ...)
```

### 4. CORS is explicit, not wildcard

```python
allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
```

### 5. Rate limiting on auth endpoints

The `limiter` singleton lives in `core/limiter.py` — import from there, not `main.py`:
```python
from core.limiter import limiter

@router.post("/auth/login")
@limiter.limit("5/minute")
def login(request: Request, ...):
```

### 6. Never return raw JSONResponse for errors

```python
# WRONG
return JSONResponse({"error": "something went wrong"})

# RIGHT
raise HTTPException(status_code=400, detail="something went wrong")
```

---

## API response envelope

Every JSON endpoint returns:
```json
{ "status": "success", "data": <payload> }
{ "status": "error",   "error": "<message>" }
```

Use the helper:
```python
from core.responses import success
return success({"key": "value"})
```

**Exceptions (not wrapped):** SSE streams, binary file downloads.

---

## Logging

```python
import structlog
logger = structlog.get_logger(__name__)

logger.info("session_complete", session_id=sid, duration_s=round(t, 1), tokens=n)
logger.warning("tavily_timeout", query=query[:80], timeout_s=timeout)
logger.error("llm_failed", error=str(exc), exc_info=True)
```

- **Never** use `logging.getLogger()` — always `structlog.get_logger()`.
- **Never** use format strings in log calls — pass kwargs so each key is a structured field.
- Request-scoped `request_id` is bound once in middleware and auto-included in every log line.

In production (`ENV=production`): JSON lines queryable in CloudWatch.
In development: coloured human-readable console.

**Never use `print()`.**

---

## Adding a new endpoint — checklist

1. Add route to an existing router (or create a new one + `include_router()` in `main.py`)
2. Add request/response schemas in `schemas/`
3. Put business logic in `services/` — route handlers: validate → call service → return
4. Use `Depends(get_current_user)` if login required; filter all queries by `user_id`
5. Use `raise HTTPException(status_code=N, detail="...")` for all error cases
6. Return `success(...)` from `core/responses.py`
7. Read all config from `core.config` — never `os.getenv()` directly
8. All file I/O in async functions must be wrapped in `asyncio.to_thread()`
9. All DB access via helpers in `core/database.py`
10. Path traversal guard via `core/utils.safe_resolve()` on any path from DB/user input
11. File uploads: validate extension against `_ALLOWED_EXTENSIONS` before reading bytes

---

## Async rules

**The event loop must never be blocked.** Blocking calls in async functions stall all concurrent requests.

| Operation | Correct pattern |
|---|---|
| LLM call (orchestration) | `await llm_service.make_system_user_request_async(...)` — native async SDK |
| LLM call (frame generators) | `await asyncio.to_thread(call_llm, ...)` — frame generators are sync-internal |
| File read/write | `await asyncio.to_thread(Path(p).read_text)` |
| DB query | `async with get_async_db() as conn:` — asyncpg is native async, no wrapping needed |
| CPU-heavy work | `await asyncio.to_thread(heavy_function, args)` |
| External HTTP | Use timeout: `asyncio.wait_for(asyncio.to_thread(fn), timeout=20.0)` |
| Event loop ref | Use `asyncio.get_running_loop()` — never `asyncio.get_event_loop()` (deprecated) |
| mkdir / os.path | `await asyncio.to_thread(session_output_dir, session_id)` |
| S3 upload | `await asyncio.to_thread(upload_frames_json, data, session_id)` |
| S3 download | `await asyncio.to_thread(download_json, key)` |

**DO NOT use `asyncio.to_thread` for LLM calls in orchestration code.** The async SDK clients (`AsyncAnthropic`, `AsyncOpenAI`) are native async — wrapping them in `to_thread` wastes a thread and adds latency.

---

## Observability

**Health check:** `GET /api/health`
```json
{"status": "ok|degraded", "checks": {"db": true, "chromadb": true, "llm": true}}
```
Returns 503 only if `db` is false. chromadb/llm failures → "degraded" but still 200.

**Metrics:** `GET /metrics` — Prometheus text format.

**Request tracing:** Every request gets `X-Request-ID` header. Appears in all log lines for that request.

---

## Known gaps / future work

| Item | Risk | Fix |
|---|---|---|
| Base64 frames in SSE | 2–10 MB per generation over SSE | Upload to S3, emit CloudFront URLs instead |
| Video generation blocking | Long jobs hold SSE connection open | Celery/RQ worker + job polling |
| `time.sleep` in LLM retry | Holds thread pool threads during backoff | Replace with `asyncio.sleep` in retry loops |
| Local ChromaDB | Cannot share across instances | Replace with Pinecone or Qdrant |
| ChromaDB collections never cleaned | Disk fills over time | Delete collection on conversation soft-delete |
| Per-user rate limits | `/api/generate` rate-limited by IP, not user ID | `key_func=lambda req: req.state.request_user_id` |
| `turn_count` column missing | `list_conversations` does expensive `COUNT + GROUP BY` | Add `turn_count` column, increment in `insert_session` |
| Cursor pagination stability | Same-second `updated_at` can skip/duplicate pages | Add `(updated_at, id)` tiebreaker cursor |
| ffmpeg merge blocks HTTP thread | Up to 10 min blocking subprocess in sync route | Move to async job |
| Mermaid sidecar | Single point of failure | Backend auto-falls back to SVG path if :3001 is down |

---

## Test suite

```bash
python -m pytest tests/ -v
```

| Test file | What it covers |
|---|---|
| `test_extract_json.py` | `_extract_json()`: fence-first parsing, trailing commas, no-JSON error |
| `test_input_validation.py` | Empty/oversized/invalid messages and modes rejected before DB |
| `test_path_security.py` | `../../etc/passwd` blocked; symlinks blocked; valid paths allowed |
| `test_turn_index.py` | 5 concurrent threads → unique turn_indexes (race condition proof) |
| `test_auth.py` | JWT expiry, tamper detection, refresh rotation theft detection |
| `test_vector_store.py` | Thread-safe init, full UUID names, graceful ChromaDB/OpenAI degradation |

Note: `conftest.py` fixtures use SQLite for `tmp_db`. These need updating to use PostgreSQL or a mock when the test suite is next revisited.

---

## Quick reference — where things live

| Task | File |
|---|---|
| Add a config constant | `core/config.py` |
| Add a DB table or column | `core/database.py → init_db()` |
| Add a DB query helper | `core/database.py` |
| Add an S3 upload/key helper | `core/s3.py` |
| Add an API route | `routers/<appropriate_router>.py` |
| Add a response schema | `schemas/sessions.py` or `schemas/generation.py` |
| Change LLM provider or model | `services/llm_service.py → default_llm_service` |
| Add a new frame renderer | `services/frame_generation/<type>/` + route branch in `generation_service.py` |
| Change research behavior | `services/research/` |
| Change interactive lesson blocks | `services/interactive/` + frontend registry |
| Add a rate limit | `core/limiter.py` singleton + `@limiter.limit("N/minute")` on route |
| Fix a security gap | `core/utils.py → safe_resolve()` for path issues; `dependencies/auth.py` for auth issues |
| Upload generated media | `core/s3.py → upload_frame / upload_video / upload_scene_ir` |
| Get a CloudFront URL | `core/s3.py → cdn_url(key)` |
