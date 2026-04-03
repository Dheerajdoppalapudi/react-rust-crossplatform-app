# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What this project is

**Zenith** — an AI-powered visual learning studio. Users submit a text prompt; the system generates an educational video composed of animated diagrams, math visualizations, and narration.

---

## Repository layout

```
/
├── client/               # React + Vite frontend (see client/CLAUDE.md for detail)
├── backend/              # Python FastAPI backend
│   ├── main.py           # App entry point, all routes, DB schema + migrations
│   ├── services/
│   │   ├── llm_service.py           # Provider-swappable LLM client
│   │   ├── Frame_generation/
│   │   │   ├── planner.py           # Intent classification + frame plan
│   │   │   ├── mermaid/             # Process/architecture/timeline diagrams
│   │   │   ├── manim/               # Math animations
│   │   │   ├── svg/                 # Illustrations, comparisons
│   │   │   ├── excalidraw_enhancer.py
│   │   │   └── combiner.py
│   │   └── video/
│   │       ├── tts_service.py       # Narration → GTTS audio
│   │       ├── video_assembler.py   # MoviePy: frames + audio → MP4
│   │       └── frame_exporter.py
├── mermaid-converter/    # Sidecar Express service: Mermaid → Excalidraw
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

1. **Frontend** (`client/src/services/api.js` → `api.imageGeneration(...)`) sends prompt + conversation context to `POST /api/generate`.
2. **Planner** (`services/Frame_generation/planner.py`) calls the LLM to classify intent (`process`, `math`, `illustration`, `comparison`, `timeline`, `architecture`) and produces a structured frame plan.
3. **Frame generators** — one per intent type — produce image assets:
   - Mermaid → rendered via headless browser through the `mermaid-converter` sidecar
   - Manim → renders Python animation scripts to video clips
   - SVG → LLM-generated SVG, rasterised with CairoSVG
4. **TTS** (`services/video/tts_service.py`) generates per-frame narration audio via GTTS.
5. **Assembler** (`services/video/video_assembler.py`) uses MoviePy to combine frames + audio into a final MP4.
6. **Response** — session row written to SQLite, video path returned to frontend; frontend plays the video and shows the frame strip.

### LLM provider switching

`services/llm_service.py` wraps both OpenAI and Anthropic clients. The active provider/model is passed per-request from the frontend (`provider: 'openai'|'claude'`, `model: '<model-id>'`). Default is `gpt-4.1`. Switching providers requires no backend restart.

### Database

SQLite (`backend/database.sqlite`). Schema and safe `ALTER TABLE` migrations live in `main.py` (search for `CREATE TABLE` and `ALTER TABLE`). No migration tool — migrations run on every startup, guarded by `try/except`.

### Conversation threading

Each generation produces a **session** (one video). Sessions belong to a **conversation**. Follow-up prompts carry `conversation_id` + `parent_session_id` + `parent_frame_index` so the LLM has prior-turn context. The "pause-to-ask" feature adds `pauseContext` (frame index + timestamp) to refine the next generation.

---

## Deployment

CI/CD lives in `.github/workflows/deploy.yml` (triggers on push to `main`):

- **Frontend**: `npm ci` → `npm run build` → S3 sync → CloudFront invalidation.
- **Backend**: SSH to EC2, `git pull`, `pip install -r requirements.txt`, restart systemd services for `backend` and `mermaid-converter`.

Required GitHub secrets: `VITE_API_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`, `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`.

---

## Frontend detail

See [client/CLAUDE.md](client/CLAUDE.md) for: state ownership patterns, error boundary levels, toast API, model constants, theming, pause-to-ask, keyboard shortcuts, and frame strip accessibility.
