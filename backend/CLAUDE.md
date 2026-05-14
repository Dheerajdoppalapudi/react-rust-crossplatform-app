# Zenith Backend — CLAUDE.md

> Read this file before touching any backend code. It gives you the full mental model.

---

## What this project is

**Zenith** is an AI-powered visual learning studio. A user types a question; the system generates an educational lesson as either:
- **Interactive mode** — live cited lesson blocks (text, diagrams, charts, code) streamed via SSE
- **Video mode** — an animated educational video (SVG frames / Manim animations / Mermaid diagrams + narration)

The backend is a **FastAPI / Python** application running on EC2 behind Nginx. All AI generation is streamed to the client via Server-Sent Events (SSE).

---

## How to run

```bash
# Backend
cd backend/
source env/bin/activate
python main.py           # FastAPI + Uvicorn on :8000, hot reload enabled

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
JWT_SECRET_KEY=<64-char random string>
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
TAVILY_API_KEY=tvly-...
ENV=production            # only on EC2 — enables Secure cookies
```

---

## Directory map

```
backend/
├── main.py                          # App wiring ONLY: app, middleware, routers, lifespan
│
├── core/                            # Shared infrastructure — import from here, never bypass
│   ├── config.py                    # ALL constants and env vars — single source of truth
│   ├── database.py                  # ALL SQLite helpers: get_db(), init_db(), insert_*, update_*
│   ├── db_models.py                 # Typed dataclasses for DB rows: User, RefreshToken
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
{"type": "heartbeat", "elapsed_s": 22.0}           // every 20s to prevent Nginx timeout
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
_anthropic_client = None   # lazy-init via _get_anthropic_client()
_openai_client    = None   # lazy-init via _get_openai_client()
```

**Key methods:**
```python
llm_service.make_completion_request(messages)
llm_service.make_single_prompt_request(prompt, cache_prefix="", tool_schema=None)
llm_service.make_system_user_request(system_prompt, user_prompt)
```

**Prompt caching** (Anthropic only): pass `cache_prefix=<static_template_text>` to split the user message into a cached block (10× cheaper on cache hits).

**Tool use** (Anthropic only): pass `tool_schema=<schema_dict>` to force structured JSON output guaranteed to match the schema.

All LLM calls are blocking (`client.messages.create()`). Always call them via `asyncio.to_thread()` from async contexts:
```python
raw, usage = await asyncio.to_thread(llm_service.make_system_user_request, sys_prompt, user_prompt)
```

---

## Authentication

**Pattern:** dual-token — access JWT in React memory + refresh token in HTTP-only cookie.

| Token | Lifetime | Stored |
|---|---|---|
| Access JWT | 15 min | React state (XSS-safe) |
| Refresh token (opaque UUID) | 30 days | HTTP-only Secure cookie |

**Flow:** `POST /auth/google` → Google userinfo → upsert user → issue JWT + refresh cookie.

**Refresh token rotation:** Every `/auth/refresh` invalidates the old token and issues a new one. Reuse of an already-rotated token = theft detected → clear cookie + return 401.

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
    rows = conn.execute("SELECT * FROM x WHERE user_id = ?", (current_user.id,))
```

**`User` dataclass fields:** `id`, `email`, `name`, `avatar`, `created_at`, `last_login`, `password_hash`, `auth_provider` (`"google"` | `"password"`).

---

## Database

**Engine:** SQLite with WAL mode. File: `backend/database.sqlite`.

**All DB access** must go through `core/database.py`. Never open SQLite connections directly in routers or services.

```python
from core.database import get_db, insert_session, update_session, insert_conversation
```

### Tables

| Table | Key columns |
|---|---|
| `users` | `id` (Google sub or UUID), `email`, `auth_provider`, `password_hash` |
| `refresh_tokens` | `token`, `user_id`, `expires_at` (FK to users) |
| `conversations` | `id`, `title`, `user_id`, `starred`, `deleted_at` |
| `sessions` | `id`, `prompt`, `conversation_id`, `turn_index`, `user_id`, `status`, `intent_type`, `render_path`, `frame_count`, `output_dir`, `sources_json`, `synthesis_text` |

### Indexes

```sql
idx_sessions_status         ON sessions(status)
idx_sessions_created_at     ON sessions(created_at DESC)
idx_conversations_deleted   ON conversations(deleted_at) WHERE deleted_at IS NOT NULL
idx_sessions_conv_turn_user UNIQUE ON sessions(conversation_id, turn_index, user_id)
                             WHERE conversation_id IS NOT NULL
```

The UNIQUE index on `(conversation_id, turn_index, user_id)` is the safety net for the atomic `turn_index` insert.

### Atomic turn_index insert

`insert_session()` uses a SQL subquery to assign `turn_index` atomically — no race condition:
```sql
INSERT INTO sessions (..., turn_index)
VALUES (..., COALESCE(
    (SELECT MAX(turn_index) FROM sessions WHERE conversation_id=? AND user_id=?), 0
) + 1)
```
Pass `turn_index=1` explicitly only for the first turn of a new conversation.

### Schema migrations

`init_db()` in `core/database.py` runs on every startup. New columns are added with `ALTER TABLE ... ADD COLUMN` wrapped in `try/except` (intentional — SQLite has no `IF NOT EXISTS` for ALTER TABLE).

---

## Configuration — `core/config.py`

**Rule:** Never call `os.getenv()` outside `core/config.py`. Every other file imports from here.

### Key constants

```python
# Paths
DB_PATH, UPLOAD_DIR, OUTPUTS_DIR, CHROMADB_PATH

# LLM
ANTHROPIC_API_KEY, OPENAI_API_KEY
CLAUDE_MODEL        = "claude-sonnet-4-6"        # default generation model
CLASSIFY_MODEL      = "claude-haiku-4-5-20251001" # cheap model for intent classification
OPENAI_MODEL        = "gpt-4.1"
EMBEDDING_MODEL     = "text-embedding-3-small"
PROMPT_CACHE_ENABLED = True

# Research
TAVILY_API_KEY
DEEP_SEARCH_ROUNDS, DEEP_SEARCH_QUERIES, DEEP_SEARCH_SOURCES
FOLLOWUP_TOP_K_SOURCES = 8     # ChromaDB top-K retrieval for follow-ups
INSTANT_MAX_QUERIES    = 3
DEEP_MAX_QUERIES       = 5

# Generation tuning
HEARTBEAT_INTERVAL_SECS      = 20    # SSE heartbeat to prevent Nginx proxy_read_timeout
CONVERSATION_TITLE_MAX_CHARS = 80    # title is first 80 chars of prompt
LLM_DEFAULT_MAX_TOKENS       = 4096
SCENE_PLANNER_MAX_TOKENS     = 8192  # interactive scene planning needs more space
SOURCES_SNIPPET_MAX_CHARS    = 2500  # source content injected into interactive prompts
MAX_FRAMES_JSON_BYTES        = 10_000_000  # 10 MB size guard on frames.json reads

# Auth
JWT_SECRET_KEY, JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES  = 15
REFRESH_TOKEN_EXPIRE_DAYS    = 30
COOKIE_SECURE                = True  # only when ENV=production

# Intent routing
MANIM_INTENT_TYPES, SVG_INTENT_TYPES

# Video
VIDEO_WIDTH=1920, VIDEO_HEIGHT=1080, VIDEO_FPS=24
TTS_WORDS_PER_SECOND = 2.3
```

All tunable via env vars with the same name (e.g., `HEARTBEAT_INTERVAL_SECS=30` in `.env`).

---

## Research pipeline — `services/research/`

| File | Role |
|---|---|
| `search_provider.py` | `TavilyProvider.search()` + `.extract()` — all web access flows through here. Module-level singleton `tavily`. Both methods have `asyncio.wait_for(timeout=20.0)`. |
| `source_processor.py` | `rank_and_deduplicate()` + `truncate_content()` — filters and trims raw Tavily results |
| `vector_store.py` | ChromaDB wrapper. `upsert_sources()` + `retrieve_sources()`. Thread-safe init (double-checked lock). Collection name = `f"conv_{conversation_id}"` (full UUID, no truncation). |
| `synthesiser.py` | `stream()` — async generator yielding cited markdown tokens. Uses real Anthropic streaming via `_get_anthropic_client()` singleton. Falls back to blocking call if streaming fails. |
| `file_extractor.py` | `extract_urls_from_text()` + `extract_text()` — pulls text from uploaded PDFs and PPTXes for use as additional context |
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

`safe_resolve()` uses `Path.resolve()` to collapse `../../` before checking the prefix. String `startswith()` alone is insufficient.

### 2. All endpoints require auth

Every endpoint reading or writing user data must have:
```python
current_user: User = Depends(get_current_user)
```

Exceptions (public by design — health check, auth endpoints) must have an inline comment explaining why.

Always filter DB queries by `user_id = current_user.id`.

### 3. Rate limiting on auth endpoints

The `limiter` singleton lives in `core/limiter.py` — import from there, not `main.py`:
```python
from core.limiter import limiter

@router.post("/auth/login")
@limiter.limit("5/minute")
def login(request: Request, ...):  # request param required by slowapi
```

### 4. Never return raw JSONResponse for errors

```python
# WRONG
return JSONResponse({"error": "something went wrong"})

# RIGHT
raise HTTPException(status_code=400, detail="something went wrong")
```

The global handler in `main.py` wraps all `HTTPException`s in the standard envelope.

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
import logging
logger = logging.getLogger(__name__)

# Use structured key=value pairs — never f-strings
logger.info("session_complete  session_id=%s  duration_s=%.1f  tokens=%d", sid, t, n)
logger.warning("tavily_timeout  query=%r  timeout_s=%.1f", query[:80], timeout)
logger.error("llm_failed  error=%s", exc, exc_info=True)
```

In production (`ENV=production`): structlog outputs JSON lines — queryable in CloudWatch.
In development: coloured human-readable console via structlog ConsoleRenderer.
Log file: `backend/logs/app.log` (5 MB × 3 rotating backups).

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

---

## Async rules

**The event loop must never be blocked.** Blocking calls in async functions stall all concurrent requests.

| Blocking operation | Correct pattern |
|---|---|
| File read/write | `await asyncio.to_thread(Path(p).read_text)` |
| LLM call (sync SDK) | `await asyncio.to_thread(llm_service.make_system_user_request, ...)` |
| DB query (sqlite3) | `with get_db() as conn:` — synchronous, but fast (<1ms); call from sync helpers only |
| CPU-heavy work | `await asyncio.to_thread(heavy_function, args)` |
| External HTTP | Use timeout: `asyncio.wait_for(asyncio.to_thread(fn), timeout=20.0)` |

---

## Observability

**Health check:** `GET /api/health`
```json
{"status": "ok|degraded", "checks": {"db": true, "chromadb": true, "llm": true}}
```
Returns 503 only if `db` is false (hard dependency). chromadb/llm = "degraded" but still 200.

**Metrics:** `GET /metrics` — Prometheus text format (if `prometheus-client` is installed).

**Request tracing:** Every request gets `X-Request-ID` header (generated or echoed from caller). Appears in all log lines for that request.

---

## Deployment (EC2 + GitHub Actions)

**Infrastructure:**
- EC2 `m7i-flex.large`, `eu-north-1`, Ubuntu 22.04
- Nginx on port 80 → FastAPI on port 8000 (localhost only)
- CloudFront: `/api/*` → EC2, `*` → S3 (React frontend)

**Services:**
```bash
sudo systemctl status falcon-backend     # FastAPI
sudo systemctl status mermaid-converter  # Node sidecar on :3001
sudo systemctl status nginx
journalctl -u falcon-backend -f          # live logs
tail -f /home/ubuntu/react-rust-crossplatform-app/backend/logs/app.log
```

**CI/CD:** Push to `main` → GitHub Actions auto-deploys frontend (S3 + CloudFront) and backend (SSH → git pull → pip install → restart).

**Backend `.env` on EC2** lives at `/home/ubuntu/react-rust-crossplatform-app/backend/.env` — never committed to git.

---

## Known gaps / future work

| Item | Risk | Fix |
|---|---|---|
| SQLite | Not horizontally scalable | Migrate to PostgreSQL (RDS) when multi-instance needed |
| Video generation blocking | Runs in-process; long jobs hold a request open | Push to Celery/RQ worker + job polling |
| CloudFront 60s timeout | Long SVG/video generation may timeout | Async job pattern: POST returns job_id, client polls |
| Upload auth | `POST /api/upload` lacks `Depends(get_current_user)` | Add auth + scope files to user_id |
| `time.sleep` in LLM retry | Holds thread pool threads during backoff | Replace with `tenacity` retry library |
| CORS `allow_methods=["*"]` | Permissive | Restrict to `["GET", "POST"]` in production |
| Mermaid sidecar | Single point of failure | Backend auto-falls back to SVG path if :3001 is down |
| Token revocation | Access tokens not revocable (15-min TTL acceptable) | Add revocation list to Redis if needed |

---

## Test suite

```bash
python -m pytest tests/ -v
# 40 tests, ~0.5s
```

| Test file | What it covers |
|---|---|
| `test_extract_json.py` | `_extract_json()`: fence-first parsing, trailing commas, no-JSON error |
| `test_input_validation.py` | Empty/oversized/invalid messages and modes rejected before DB |
| `test_path_security.py` | `../../etc/passwd` blocked; symlinks blocked; valid paths allowed |
| `test_turn_index.py` | 5 concurrent threads → unique turn_indexes (race condition proof) |
| `test_auth.py` | JWT expiry, tamper detection, refresh rotation theft detection |
| `test_vector_store.py` | Thread-safe init, full UUID names, graceful ChromaDB/OpenAI degradation |

Fixtures in `conftest.py`: `tmp_db` (isolated SQLite), `mock_llm` (stub provider), `mock_tavily` (no real HTTP calls).

---

## Quick reference — where things live

| Task | File |
|---|---|
| Add a config constant | `core/config.py` |
| Add a DB table or column | `core/database.py → init_db()` |
| Add a DB query helper | `core/database.py` |
| Add an API route | `routers/<appropriate_router>.py` |
| Add a response schema | `schemas/sessions.py` or `schemas/generation.py` |
| Change LLM provider or model | `services/llm_service.py → default_llm_service` |
| Add a new frame renderer | `services/frame_generation/<type>/` + route branch in `generation_service.py` |
| Change research behavior | `services/research/` |
| Change interactive lesson blocks | `services/interactive/` + frontend registry |
| Add a rate limit | `core/limiter.py` singleton + `@limiter.limit("N/minute")` on route |
| Fix a security gap | `core/utils.py → safe_resolve()` for path issues; `dependencies/auth.py` for auth issues |
