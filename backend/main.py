import asyncio
import json
import logging
import logging.handlers
import os
import sqlite3
import time
import uuid
import urllib.parse
import webbrowser
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

# ---------------------------------------------------------------------------
# Logging setup — run once at import time
# ---------------------------------------------------------------------------

LOG_FORMAT = "%(asctime)s  %(levelname)-8s  %(name)s:%(lineno)d  %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

def _setup_logging() -> None:
    """
    Configure root logger with:
      - StreamHandler  → console (INFO and above)
      - RotatingFileHandler → logs/app.log (DEBUG and above, 5 MB × 3 backups)
    All third-party loggers (uvicorn, httpx, openai) are left at their
    default levels so they don't flood the console.
    """
    log_dir = os.path.join(os.path.dirname(__file__), "logs")
    os.makedirs(log_dir, exist_ok=True)

    formatter = logging.Formatter(LOG_FORMAT, datefmt=LOG_DATE_FORMAT)

    # Console handler — INFO+
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(formatter)

    # Rotating file handler — DEBUG+ (captures everything for post-mortem)
    file_handler = logging.handlers.RotatingFileHandler(
        os.path.join(log_dir, "app.log"),
        maxBytes=5 * 1024 * 1024,   # 5 MB per file
        backupCount=3,
        encoding="utf-8",
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)
    root.addHandler(console)
    root.addHandler(file_handler)

    # Quiet down noisy third-party loggers
    for noisy in ("httpx", "httpcore", "openai", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

_setup_logging()
logger = logging.getLogger(__name__)

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

from services.excalidraw.excalidraw_enhancer import enhance
from services.excalidraw.planner import create_plan, generate_all_frames, request_log, _log
from services.excalidraw.combiner import combine_frames
from services.excalidraw.mermaid.mermaid_generator import generate_mermaid_frames, _sidecar_available
from services.excalidraw.manim.manim_generator import generate_manim_frames, manim_available
from services.excalidraw.svg.svg_generator import generate_svg_frames, svg_available
from services.video.frame_exporter import export_frames
from services.video.tts_service import parse_narration, generate_audio
from services.video.video_assembler import assemble, moviepy_available

# Intent types routed to each generator
MERMAID_INTENT_TYPES = {"process", "architecture", "timeline"}
MANIM_INTENT_TYPES   = {"math"}
SVG_INTENT_TYPES     = {"illustration", "concept_analogy", "comparison"}

app = FastAPI(title="Falcon API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Directories ───────────────────────────────────────────────────────────────
BASE_DIR       = os.path.dirname(__file__)
UPLOAD_DIR     = os.path.join(BASE_DIR, "uploads")
OUTPUTS_DIR    = os.path.join(BASE_DIR, "outputs")
EXCALIDRAW_DIR = os.path.join(BASE_DIR, "services", "excalidraw")

os.makedirs(UPLOAD_DIR,  exist_ok=True)
os.makedirs(OUTPUTS_DIR, exist_ok=True)

# ── SQLite ────────────────────────────────────────────────────────────────────
DB_PATH = os.path.join(BASE_DIR, "database.sqlite")


def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    with _get_db() as conn:
        # Conversations table — one row per chat thread
        conn.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id         TEXT PRIMARY KEY,
                title      TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id            TEXT PRIMARY KEY,
                prompt        TEXT NOT NULL,
                created_at    TEXT NOT NULL,
                status        TEXT NOT NULL DEFAULT 'pending',
                intent_type   TEXT,
                render_path   TEXT,
                frame_count   INTEGER,
                output_dir    TEXT,
                ui_output_file TEXT,
                api_call_count INTEGER DEFAULT 0,
                video_path    TEXT,
                conversation_id TEXT,
                turn_index    INTEGER DEFAULT 1
            )
        """)
        # Safe migrations for existing DBs
        for col, typedef in [
            ("video_path",      "TEXT"),
            ("conversation_id", "TEXT"),
            ("turn_index",      "INTEGER DEFAULT 1"),
        ]:
            try:
                conn.execute(f"ALTER TABLE sessions ADD COLUMN {col} {typedef}")
            except Exception:
                pass
        conn.commit()


_init_db()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _session_output_dir(session_id: str) -> str:
    path = os.path.join(OUTPUTS_DIR, session_id)
    os.makedirs(path, exist_ok=True)
    return path


def _insert_conversation(conv_id: str, title: str):
    now = _now_iso()
    with _get_db() as conn:
        conn.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (conv_id, title, now, now),
        )
        conn.commit()


def _touch_conversation(conv_id: str):
    with _get_db() as conn:
        conn.execute(
            "UPDATE conversations SET updated_at = ? WHERE id = ?",
            (_now_iso(), conv_id),
        )
        conn.commit()


def _insert_session(session_id: str, prompt: str, conversation_id: str = None, turn_index: int = 1):
    with _get_db() as conn:
        conn.execute(
            "INSERT INTO sessions (id, prompt, created_at, status, conversation_id, turn_index) "
            "VALUES (?, ?, ?, 'pending', ?, ?)",
            (session_id, prompt, _now_iso(), conversation_id, turn_index),
        )
        conn.commit()


def _update_session(session_id: str, **fields):
    if not fields:
        return
    sets = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [session_id]
    with _get_db() as conn:
        conn.execute(f"UPDATE sessions SET {sets} WHERE id = ?", values)
        conn.commit()


def _count_llm_calls(log: list) -> int:
    return sum(1 for e in log if e.get("event") == "llm_call")


# ── Excalidraw browser opener (kept for reference) ────────────────────────────

def open_in_excalidraw(excalidraw_data: dict, excalidraw_url: str = "http://localhost:3000") -> bool:
    try:
        json_str     = json.dumps(excalidraw_data, separators=(",", ":"))
        encoded_data = urllib.parse.quote(json_str)
        webbrowser.open(f"{excalidraw_url}#{encoded_data}")
        return True
    except Exception as e:
        print(f"Failed to open in Excalidraw: {e}")
        return False


# ── App ───────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/chat")
async def chat(message: str = Form("")):
    return {"reply": message}


@app.post("/api/image_generation")
async def image_generation(message: str = Form(""), conversation_id: str = Form(None)):
    session_id = uuid.uuid4().hex
    output_dir = _session_output_dir(session_id)
    start_time = time.time()

    # Resolve conversation — create new one if none provided
    if not conversation_id:
        conversation_id = uuid.uuid4().hex
        _insert_conversation(conversation_id, message[:80])
        turn_index = 1
    else:
        with _get_db() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS cnt FROM sessions WHERE conversation_id = ?",
                (conversation_id,),
            ).fetchone()
            turn_index = (row["cnt"] or 0) + 1

    _insert_session(session_id, message, conversation_id, turn_index)
    _touch_conversation(conversation_id)

    # Activate per-request lifecycle log
    lifecycle_log: list = []
    token = request_log.set(lifecycle_log)

    _log({"event": "request_received", "prompt": message, "session_id": session_id})
    logger.info("Request received  session=%s  prompt=%r", session_id, message[:120])
    logger.debug("Full prompt: %s", message)

    prompts_dir = os.path.join(EXCALIDRAW_DIR, "prompts")
    with open(os.path.join(prompts_dir, "prompt_template.md")) as f:
        prompt_template = f.read()
    with open(os.path.join(prompts_dir, "mermaid_prompt.md")) as f:
        mermaid_prompt_template = f.read()
    with open(os.path.join(prompts_dir, "manim_prompt.md")) as f:
        manim_prompt_template = f.read()
    with open(os.path.join(prompts_dir, "svg_prompt.md")) as f:
        svg_prompt_template = f.read()

    try:
        # ── Stage 1: Planning ────────────────────────────────────────────────
        _log({"event": "stage_start", "stage": "planning"})
        plan = await create_plan(message)
        _log({
            "event": "stage_complete",
            "stage": "planning",
            "intent_type": plan.intent_type,
            "frame_count": plan.frame_count,
            "layout": plan.layout,
        })
        logger.info(
            "Planning complete  session=%s  intent=%s  frames=%d  layout=%s",
            session_id, plan.intent_type, plan.frame_count, plan.layout,
        )

        captions = [frame.caption for frame in plan.frames]
        narration_lines = []
        for i, frame in enumerate(plan.frames):
            narration_lines.append(f"Frame {i + 1}: {frame.caption}")
            narration_lines.append(frame.narration)
            narration_lines.append("")

        ui_output_file = None
        result_payload = {}

        # ── Stage 2: Frame generation ────────────────────────────────────────
        if plan.intent_type in MANIM_INTENT_TYPES and manim_available():
            logger.info("Render path → manim  session=%s", session_id)
            _log({"event": "stage_start", "stage": "frame_generation", "path": "manim", "frame_count": plan.frame_count})
            manim_output_dir = os.path.join(output_dir, "manim")
            png_paths = await generate_manim_frames(plan, manim_prompt_template, manim_output_dir)
            _log({"event": "stage_complete", "stage": "frame_generation", "path": "manim"})
            logger.info("Manim frames generated  session=%s  paths=%s", session_id, png_paths)

            # Save Python code (last frame LLM responses) as final output
            manim_calls = [e for e in lifecycle_log if e.get("event") == "llm_call"]
            # First entry is planning; rest are frame code responses
            frame_codes = [e["full_response"] for e in manim_calls[1:]]
            py_content = "\n\n# " + "=" * 70 + "\n\n".join(
                f"# Frame {i+1}: {captions[i] if i < len(captions) else ''}\n\n{code}"
                for i, code in enumerate(frame_codes)
            )
            ui_output_file = os.path.join(output_dir, "final_output.py")
            with open(ui_output_file, "w") as f:
                f.write(py_content)

            with open(os.path.join(output_dir, "frames.json"), "w") as f:
                json.dump({"render_path": "manim", "images": png_paths, "captions": captions}, f, indent=2)

            result_payload = {
                "session_id": session_id,
                "render_path": "manim",
                "frame_count": plan.frame_count,
                "intent_type": plan.intent_type,
                "captions": captions,
                "images": png_paths,
                "ui_file_type": "python",
            }

        elif plan.intent_type in SVG_INTENT_TYPES and svg_available():
            logger.info("Render path → svg  session=%s", session_id)
            _log({"event": "stage_start", "stage": "frame_generation", "path": "svg", "frame_count": plan.frame_count})
            svg_output_dir = os.path.join(output_dir, "svg")
            png_paths = await generate_svg_frames(plan, svg_prompt_template, svg_output_dir)
            _log({"event": "stage_complete", "stage": "frame_generation", "path": "svg"})
            logger.info("SVG frames generated  session=%s  paths=%s", session_id, png_paths)

            with open(os.path.join(output_dir, "frames.json"), "w") as f:
                json.dump({"render_path": "svg", "images": png_paths, "captions": captions}, f, indent=2)

            ui_output_file = os.path.join(output_dir, "final_output.json")
            with open(ui_output_file, "w") as f:
                json.dump({"render_path": "svg", "images": png_paths, "captions": captions}, f, indent=2)

            result_payload = {
                "session_id": session_id,
                "render_path": "svg",
                "frame_count": plan.frame_count,
                "intent_type": plan.intent_type,
                "captions": captions,
                "images": png_paths,
                "ui_file_type": "images",
            }

        else:
            use_mermaid = plan.intent_type in MERMAID_INTENT_TYPES and _sidecar_available()
            path_label  = "mermaid" if use_mermaid else "slim_json"

            if use_mermaid:
                logger.info("Render path → mermaid  session=%s", session_id)
            else:
                if plan.intent_type in MANIM_INTENT_TYPES:
                    logger.warning(
                        "Manim not available — falling back to slim_json  session=%s  intent=%s",
                        session_id, plan.intent_type,
                    )
                elif plan.intent_type in MERMAID_INTENT_TYPES:
                    logger.warning(
                        "Mermaid sidecar unavailable — falling back to slim_json  session=%s  intent=%s",
                        session_id, plan.intent_type,
                    )
                elif plan.intent_type in SVG_INTENT_TYPES:
                    logger.warning(
                        "cairosvg unavailable — falling back to slim_json  session=%s  intent=%s",
                        session_id, plan.intent_type,
                    )
                else:
                    logger.info("Render path → slim_json  session=%s  intent=%s", session_id, plan.intent_type)

            _log({"event": "stage_start", "stage": "frame_generation", "path": path_label, "frame_count": plan.frame_count})
            if use_mermaid:
                frame_slims = await generate_mermaid_frames(plan, mermaid_prompt_template)
            else:
                if plan.intent_type in MERMAID_INTENT_TYPES:
                    _log({"event": "info", "message": "Mermaid sidecar unavailable — falling back to slim JSON"})
                elif plan.intent_type in SVG_INTENT_TYPES:
                    _log({"event": "info", "message": "cairosvg unavailable — falling back to slim JSON"})
                frame_slims = await generate_all_frames(plan, prompt_template)
            _log({"event": "stage_complete", "stage": "frame_generation", "path": path_label})
            logger.info("Frame generation complete  session=%s  path=%s", session_id, path_label)

            # ── Stage 3: Combine ─────────────────────────────────────────────
            _log({"event": "stage_start", "stage": "combine_frames"})
            combined_slim = combine_frames(frame_slims, captions)
            _log({"event": "stage_complete", "stage": "combine_frames"})

            with open(os.path.join(output_dir, "sample_slim.json"), "w") as f:
                json.dump(combined_slim, f, indent=2)

            # ── Stage 4: Enhance ─────────────────────────────────────────────
            _log({"event": "stage_start", "stage": "enhance_excalidraw"})
            excalidraw_result = enhance(combined_slim)
            _log({"event": "stage_complete", "stage": "enhance_excalidraw", "elements_count": len(excalidraw_result.get("elements", []))})

            ui_output_file = os.path.join(output_dir, "final_output.json")
            with open(ui_output_file, "w") as f:
                json.dump(excalidraw_result, f, indent=2)

            # No real PNGs for this path — store nulls so video uses placeholders
            with open(os.path.join(output_dir, "frames.json"), "w") as f:
                json.dump({"render_path": path_label, "images": [None] * plan.frame_count, "captions": captions}, f, indent=2)

            result_payload = {
                "session_id": session_id,
                "excalidraw": excalidraw_result,
                "elements_count": len(excalidraw_result["elements"]),
                "frame_count": plan.frame_count,
                "intent_type": plan.intent_type,
                "render_path": path_label,
                "captions": captions,
                "ui_file_type": "json",
            }

        # ── Save narration ────────────────────────────────────────────────────
        with open(os.path.join(output_dir, "narration.txt"), "w") as f:
            f.write("\n".join(narration_lines).strip() + "\n")

        # ── Save activity log ─────────────────────────────────────────────────
        duration_ms = int((time.time() - start_time) * 1000)
        _log({"event": "request_complete", "duration_ms": duration_ms, "session_id": session_id})
        logger.info(
            "Request complete  session=%s  render_path=%s  duration_ms=%d  llm_calls=%d",
            session_id,
            result_payload.get("render_path"),
            duration_ms,
            _count_llm_calls(lifecycle_log),
        )

        with open(os.path.join(output_dir, "activity_log.json"), "w") as f:
            json.dump(lifecycle_log, f, indent=2)

        # ── Persist to DB ─────────────────────────────────────────────────────
        api_call_count = _count_llm_calls(lifecycle_log)
        _update_session(
            session_id,
            status="done",
            intent_type=plan.intent_type,
            render_path=result_payload.get("render_path"),
            frame_count=plan.frame_count,
            output_dir=output_dir,
            ui_output_file=ui_output_file,
            api_call_count=api_call_count,
        )

        result_payload["conversation_id"] = conversation_id
        result_payload["turn_index"]      = turn_index
        return result_payload

    except Exception as exc:
        logger.error("Request failed  session=%s  error=%s", session_id, exc, exc_info=True)
        _log({"event": "error", "error": str(exc)})
        with open(os.path.join(output_dir, "activity_log.json"), "w") as f:
            json.dump(lifecycle_log, f, indent=2)
        _update_session(session_id, status="error")
        raise

    finally:
        request_log.reset(token)


# ── Conversations API ─────────────────────────────────────────────────────────

@app.get("/api/conversations")
def list_conversations():
    with _get_db() as conn:
        rows = conn.execute("""
            SELECT c.id, c.title, c.created_at, c.updated_at,
                   COUNT(s.id) AS turn_count,
                   MIN(s.intent_type) AS intent_type
            FROM conversations c
            LEFT JOIN sessions s ON s.conversation_id = c.id AND s.status = 'done'
            GROUP BY c.id
            ORDER BY c.updated_at DESC
        """).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    with _get_db() as conn:
        conv = conn.execute(
            "SELECT * FROM conversations WHERE id = ?", (conversation_id,)
        ).fetchone()
        if not conv:
            return JSONResponse({"error": "Conversation not found"}, status_code=404)
        turns = conn.execute(
            "SELECT id, prompt, created_at, status, intent_type, render_path, "
            "frame_count, video_path, turn_index "
            "FROM sessions WHERE conversation_id = ? ORDER BY turn_index ASC",
            (conversation_id,),
        ).fetchall()
    return {**dict(conv), "turns": [dict(t) for t in turns]}


# ── Sessions API ───────────────────────────────────────────────────────────────

@app.get("/api/sessions")
def list_sessions():
    with _get_db() as conn:
        rows = conn.execute(
            "SELECT id, prompt, created_at, status, intent_type, render_path, frame_count, api_call_count "
            "FROM sessions ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/sessions/{session_id}/output")
def get_session_output(session_id: str):
    with _get_db() as conn:
        row = conn.execute(
            "SELECT ui_output_file, status FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()

    if not row:
        return JSONResponse({"error": "Session not found"}, status_code=404)
    if row["status"] != "done" or not row["ui_output_file"]:
        return JSONResponse({"error": "Output not available"}, status_code=404)

    path = row["ui_output_file"]
    if not os.path.exists(path):
        return JSONResponse({"error": "Output file missing"}, status_code=404)

    file_type = "python" if path.endswith(".py") else "json"
    with open(path) as f:
        content = f.read()

    return {"file_type": file_type, "content": content}


@app.get("/api/sessions/{session_id}/log")
def get_session_log(session_id: str):
    with _get_db() as conn:
        row = conn.execute("SELECT output_dir FROM sessions WHERE id = ?", (session_id,)).fetchone()

    if not row or not row["output_dir"]:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    log_path = os.path.join(row["output_dir"], "activity_log.json")
    if not os.path.exists(log_path):
        return JSONResponse({"error": "Log not available"}, status_code=404)

    with open(log_path) as f:
        log = json.load(f)
    return {"log": log}


# ── Video generation ───────────────────────────────────────────────────────────

@app.post("/api/generate_video/{session_id}")
async def generate_video(
    session_id: str,
    use_openai_tts: bool = True,
):
    """
    Generate a video for an existing session.

    Reads the session's frames.json + narration.txt, runs TTS on each frame's
    narration, normalizes all frames to 1920×1080 PNGs, and assembles a final
    .mp4 with Ken Burns zoom + crossfade transitions.

    Query param:
      use_openai_tts=false  → fall back to gTTS (free, no API key needed)
    """
    logger.info("Video generation requested  session=%s  openai_tts=%s", session_id, use_openai_tts)

    if not moviepy_available():
        logger.error("moviepy not installed  session=%s", session_id)
        return JSONResponse({"error": "moviepy not installed — run: pip install moviepy"}, status_code=503)

    with _get_db() as conn:
        row = conn.execute(
            "SELECT output_dir, frame_count, status, render_path, video_path FROM sessions WHERE id = ?",
            (session_id,),
        ).fetchone()

    if not row:
        return JSONResponse({"error": "Session not found"}, status_code=404)
    if row["status"] != "done":
        return JSONResponse({"error": f"Session not ready (status: {row['status']})"}, status_code=400)

    # ── Idempotency: return cached video if it already exists ──────────────────
    if row["video_path"] and os.path.exists(row["video_path"]):
        logger.info("Video already exists — returning cached  session=%s  path=%s", session_id, row["video_path"])
        return {
            "session_id":   session_id,
            "video_path":   row["video_path"],
            "frame_count":  row["frame_count"],
            "tts_backend":  "cached",
        }

    output_dir = row["output_dir"]
    if not output_dir or not os.path.isdir(output_dir):
        return JSONResponse({"error": "Session output directory missing"}, status_code=404)

    # ── Load captions from frames.json ────────────────────────────────────────
    frames_json_path = os.path.join(output_dir, "frames.json")
    if not os.path.exists(frames_json_path):
        return JSONResponse({"error": "frames.json not found — re-run image generation"}, status_code=404)

    with open(frames_json_path) as f:
        frames_data = json.load(f)
    captions = frames_data.get("captions", [])

    # ── Load narration text ────────────────────────────────────────────────────
    narration_path = os.path.join(output_dir, "narration.txt")
    if not os.path.exists(narration_path):
        return JSONResponse({"error": "narration.txt not found"}, status_code=404)

    with open(narration_path) as f:
        narration_txt = f.read()
    narration_texts = parse_narration(narration_txt)

    # Pad/trim narration list to match caption count
    while len(narration_texts) < len(captions):
        narration_texts.append("")
    narration_texts = narration_texts[: len(captions)]

    # ── Stage 1: Normalize frames → 1920×1080 PNGs with subtitle bars ─────────
    logger.info("Video stage 1/3: frame export  session=%s  frames=%d", session_id, len(captions))
    try:
        normalized_pngs = await asyncio.to_thread(export_frames, output_dir, captions)
        logger.info("Frame export done  session=%s  exported=%d", session_id, len(normalized_pngs))
    except Exception as e:
        logger.error("Frame export failed  session=%s", session_id, exc_info=True)
        return JSONResponse({"error": f"Frame export failed: {e}"}, status_code=500)

    # ── Stage 2: TTS — narration text → per-frame .mp3 ────────────────────────
    logger.info("Video stage 2/3: TTS  session=%s  backend=%s", session_id, "openai" if use_openai_tts else "gtts")
    try:
        audio_paths = await asyncio.to_thread(
            generate_audio, narration_texts, output_dir, use_openai_tts
        )
        audio_ok = sum(1 for p in audio_paths if p)
        logger.info("TTS done  session=%s  generated=%d/%d", session_id, audio_ok, len(audio_paths))
    except Exception as e:
        logger.error("TTS generation failed  session=%s", session_id, exc_info=True)
        return JSONResponse({"error": f"TTS generation failed: {e}"}, status_code=500)

    # ── Stage 3: Assemble video ────────────────────────────────────────────────
    video_path = os.path.join(output_dir, "final_video.mp4")
    logger.info("Video stage 3/3: assembly  session=%s  output=%s", session_id, video_path)
    try:
        await asyncio.to_thread(
            assemble, normalized_pngs, audio_paths, narration_texts, video_path, captions
        )
        logger.info("Video assembly complete  session=%s  path=%s", session_id, video_path)
    except Exception as e:
        logger.error("Video assembly failed  session=%s", session_id, exc_info=True)
        return JSONResponse({"error": f"Video assembly failed: {e}"}, status_code=500)

    # ── Persist video path to DB ───────────────────────────────────────────────
    _update_session(session_id, video_path=video_path)

    logger.info(
        "Video generation done  session=%s  frames=%d  tts=%s",
        session_id, len(normalized_pngs), "openai" if use_openai_tts else "gtts",
    )
    return {
        "session_id": session_id,
        "video_path": video_path,
        "frame_count": len(normalized_pngs),
        "tts_backend": "openai" if use_openai_tts else "gtts",
    }


@app.get("/api/sessions/{session_id}/frames-meta")
def get_session_frames_meta(session_id: str):
    """Return the frames.json content (images paths, captions, render_path)."""
    with _get_db() as conn:
        row = conn.execute("SELECT output_dir FROM sessions WHERE id = ?", (session_id,)).fetchone()

    if not row or not row["output_dir"]:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    frames_json_path = os.path.join(row["output_dir"], "frames.json")
    if not os.path.exists(frames_json_path):
        return JSONResponse({"error": "frames.json not found"}, status_code=404)

    with open(frames_json_path) as f:
        return json.load(f)


@app.get("/api/sessions/{session_id}/frame/{frame_index}")
def get_session_frame(session_id: str, frame_index: int):
    """Serve a rendered frame as a PNG image, or 404 if not a PNG."""
    with _get_db() as conn:
        row = conn.execute("SELECT output_dir FROM sessions WHERE id = ?", (session_id,)).fetchone()

    if not row or not row["output_dir"]:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    frames_json_path = os.path.join(row["output_dir"], "frames.json")
    if not os.path.exists(frames_json_path):
        return JSONResponse({"error": "frames.json not found"}, status_code=404)

    with open(frames_json_path) as f:
        frames_data = json.load(f)

    images = frames_data.get("images", [])
    if frame_index >= len(images):
        return JSONResponse({"error": "Frame index out of range"}, status_code=404)

    image_path = images[frame_index]
    if image_path and image_path.lower().endswith(".png") and os.path.exists(image_path):
        return FileResponse(image_path, media_type="image/png")

    return JSONResponse({"error": "Frame image not available (non-PNG or missing)"}, status_code=404)


@app.get("/api/sessions/{session_id}/video")
def get_session_video(session_id: str):
    """Stream the generated .mp4 video for a session."""
    with _get_db() as conn:
        row = conn.execute(
            "SELECT video_path FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()

    if not row:
        return JSONResponse({"error": "Session not found"}, status_code=404)
    if not row["video_path"]:
        return JSONResponse({"error": "Video not yet generated for this session"}, status_code=404)

    video_path = row["video_path"]
    if not os.path.exists(video_path):
        return JSONResponse({"error": "Video file missing from disk"}, status_code=404)

    return FileResponse(
        video_path,
        media_type="video/mp4",
        filename=f"lesson_{session_id[:8]}.mp4",
    )


# ── Upload ────────────────────────────────────────────────────────────────────

@app.post("/api/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    saved = []
    for file in files:
        ext      = os.path.splitext(file.filename)[1]
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        content  = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
        saved.append({
            "original_name": file.filename,
            "saved_as":      filename,
            "size":          len(content),
            "content_type":  file.content_type,
        })
    return {"files": saved}


@app.post("/api/chat-with-files")
async def chat_with_files(
    message: str = Form(""),
    files: list[UploadFile] = File(default=[]),
):
    saved = []
    for file in files:
        ext      = os.path.splitext(file.filename)[1]
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        content  = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
        saved.append({
            "original_name": file.filename,
            "saved_as":      filename,
            "size":          len(content),
            "content_type":  file.content_type,
        })

    if message and saved:
        reply = f"{message}\n\n[Received {len(saved)} file(s): {', '.join(f['original_name'] for f in saved)}]"
    elif saved:
        reply = f"Received {len(saved)} file(s): {', '.join(f['original_name'] for f in saved)}"
    else:
        reply = message

    return {"reply": reply, "files": saved}
