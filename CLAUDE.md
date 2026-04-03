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
│   │   ├── database.py            # ALL SQLite helpers — get_db(), init_db(), insert_*/update_*
│   │   └── logging_config.py      # setup_logging() — called once at process start in main.py
│   ├── routers/
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

### Database

SQLite (`backend/database.sqlite`). Schema and safe `ALTER TABLE` migrations live in `core/database.py → init_db()`, which is called once at startup via the FastAPI lifespan hook in `main.py`. No migration tool — migrations run on every startup, guarded by `try/except` (intentional — SQLite has no IF NOT EXISTS for ALTER TABLE).

All DB helpers (`get_db`, `insert_session`, `update_session`, `insert_conversation`, etc.) are in `core/database.py`. Import from there — do not open SQLite connections directly in routers or services.

### Conversation threading

Each generation produces a **session** (one video). Sessions belong to a **conversation**. Follow-up prompts carry `conversation_id` + `parent_session_id` + `parent_frame_index` so the LLM has prior-turn context. The "pause-to-ask" feature adds `pauseContext` (frame index + caption) to refine the next generation.

Conversation context is built in `services/generation_service.py → build_conversation_context()`.

---

## Adding a new endpoint — checklist

1. **Add the route** in the appropriate file under `routers/`. If it doesn't fit any existing router, create a new one and `include_router()` in `main.py`.
2. **Add request/response schemas** in `schemas/`. Every endpoint must have a typed `response_model=`.
3. **Put business logic in `services/`**, not in the route handler. Route handlers should: validate input → call service → return response.
4. **Read config from `core/config.py`** — never hardcode URLs, paths, or model names.
5. **Use `get_db()` from `core/database.py`** for any DB access.
6. **Use `logger = logging.getLogger(__name__)`** — never `print()`.
7. **Use `raise HTTPException(...)`** — never return raw `JSONResponse({"error": ...})` for error cases.

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
- **Global handler** in `main.py` catches any unhandled `Exception` and returns `{"error": "Internal server error"}` with a 500. Raw tracebacks never reach the client.
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

Required GitHub secrets: `VITE_API_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`, `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`.

---

## Known gaps / future work

| Item | Status | Notes |
|---|---|---|
| Auth on API endpoints | Not implemented | All endpoints are public. Add before any multi-user deployment. |
| CORS `allow_methods=["*"]` | Permissive | Restrict to `["GET", "POST"]` for production. |
| `/api/chat` endpoint | Stub — echoes message back | Confirm with team: implement or delete. |
| `Frame_generation/` folder name | PascalCase (non-standard) | Rename to `frame_generation/` when ready — touches ~15 import paths. |
| Video generation blocking | Runs in-process | At scale, push to Celery/RQ task queue so long jobs don't block workers. |

---

## Frontend detail

See [client/CLAUDE.md](client/CLAUDE.md) for: state ownership patterns, error boundary levels, toast API, model constants, theming, pause-to-ask, keyboard shortcuts, and frame strip accessibility.
