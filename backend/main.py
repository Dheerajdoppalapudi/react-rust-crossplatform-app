import asyncio
import json
import logging
import logging.handlers
import os
import sqlite3
import subprocess
import tempfile
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
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from services.Frame_generation.excalidraw_enhancer import enhance
from services.Frame_generation.planner import create_plan, generate_all_frames, request_log, _log
from services.Frame_generation.combiner import combine_frames
from services.Frame_generation.mermaid.mermaid_generator import generate_mermaid_frames, _sidecar_available
from services.Frame_generation.manim.manim_generator import generate_manim_frames, manim_available
from services.Frame_generation.svg.svg_generator import generate_svg_frames, svg_available
from services.video.frame_exporter import export_frames
from services.video.tts_service import parse_narration, generate_audio, generate_audio_parallel
from services.video.video_assembler import assemble, moviepy_available

# Intent types routed to each generator
MERMAID_INTENT_TYPES = {"process", "architecture", "timeline"}
MANIM_INTENT_TYPES   = {"math"}
SVG_INTENT_TYPES     = {"illustration", "concept_analogy", "comparison"}

app = FastAPI(title="Zenith API")

_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Directories ───────────────────────────────────────────────────────────────
BASE_DIR       = os.path.dirname(__file__)
UPLOAD_DIR     = os.path.join(BASE_DIR, "uploads")
OUTPUTS_DIR    = os.path.join(BASE_DIR, "outputs")
EXCALIDRAW_DIR = os.path.join(BASE_DIR, "services", "Frame_generation")

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
                id                TEXT PRIMARY KEY,
                title             TEXT NOT NULL,
                created_at        TEXT NOT NULL,
                updated_at        TEXT NOT NULL,
                merged_video_path TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id                 TEXT PRIMARY KEY,
                prompt             TEXT NOT NULL,
                created_at         TEXT NOT NULL,
                status             TEXT NOT NULL DEFAULT 'pending',
                intent_type        TEXT,
                render_path        TEXT,
                frame_count        INTEGER,
                output_dir         TEXT,
                ui_output_file     TEXT,
                api_call_count     INTEGER DEFAULT 0,
                video_path         TEXT,
                conversation_id    TEXT,
                turn_index         INTEGER DEFAULT 1,
                parent_session_id  TEXT,
                parent_frame_index INTEGER
            )
        """)
        # Safe migrations for existing DBs — add new columns without breaking old data
        for col, typedef in [
            ("video_path",          "TEXT"),
            ("conversation_id",     "TEXT"),
            ("turn_index",          "INTEGER DEFAULT 1"),
            ("parent_session_id",   "TEXT"),
            ("parent_frame_index",  "INTEGER"),
        ]:
            try:
                conn.execute(f"ALTER TABLE sessions ADD COLUMN {col} {typedef}")
            except Exception:
                pass
        # Safe migrations for conversations table
        for col, typedef in [
            ("merged_video_path", "TEXT"),
        ]:
            try:
                conn.execute(f"ALTER TABLE conversations ADD COLUMN {col} {typedef}")
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


def _insert_session(
    session_id:         str,
    prompt:             str,
    conversation_id:    str  = None,
    turn_index:         int  = 1,
    parent_session_id:  str  = None,
    parent_frame_index: int  = None,
):
    with _get_db() as conn:
        conn.execute(
            "INSERT INTO sessions "
            "(id, prompt, created_at, status, conversation_id, turn_index, parent_session_id, parent_frame_index) "
            "VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)",
            (session_id, prompt, _now_iso(), conversation_id, turn_index,
             parent_session_id, parent_frame_index),
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


# ── Conversation context builder ──────────────────────────────────────────────

def _parse_narrations_from_file(narration_path: str) -> list[str]:
    """Read narration.txt and return a list of per-frame narration strings."""
    if not os.path.exists(narration_path):
        return []
    with open(narration_path) as f:
        text = f.read()
    # Format: "Frame N: Caption\nNarration text\n\nFrame N+1: ..."
    blocks = []
    current = []
    for line in text.splitlines():
        if line.strip().startswith("Frame ") and ":" in line and current:
            narration = " ".join(l for l in current if not l.strip().startswith("Frame ")).strip()
            blocks.append(narration)
            current = [line]
        else:
            current.append(line)
    if current:
        narration = " ".join(l for l in current if not l.strip().startswith("Frame ")).strip()
        blocks.append(narration)
    return blocks


def _build_conversation_context(
    conversation_id: str,
    current_session_id: str,
    pause_session_id: str | None = None,
    pause_frame_index: int | None = None,
    pause_caption: str | None = None,
) -> str:
    """
    Build the conversation context string injected into the planning prompt.

    Strategy (Option B — sliding window):
      - All prior turns except the most recent: prompt + captions only
      - Most recent prior turn:                 prompt + full narration
      - Pause context (if provided):            which frame + caption + narration at that frame
    """
    with _get_db() as conn:
        prior_turns = conn.execute(
            "SELECT id, prompt, turn_index, output_dir FROM sessions "
            "WHERE conversation_id = ? AND id != ? AND status = 'done' "
            "ORDER BY turn_index ASC",
            (conversation_id, current_session_id),
        ).fetchall()

    if not prior_turns:
        return ""

    lines: list[str] = [
        "────────────────────────────────────────────────────────────────────",
        "## CONVERSATION HISTORY — what has already been taught",
        "",
        "You are continuing an ongoing conversation. Build upon the lessons below.",
        "Do NOT repeat concepts already covered. Connect new content to prior lessons where natural.",
        "",
    ]

    for i, turn in enumerate(prior_turns):
        turn_idx   = turn["turn_index"]
        prompt     = turn["prompt"]
        output_dir = turn["output_dir"] or ""
        is_last    = (i == len(prior_turns) - 1)

        captions: list[str] = []
        frames_path = os.path.join(output_dir, "frames.json")
        if os.path.exists(frames_path):
            with open(frames_path) as f:
                captions = json.load(f).get("captions", [])

        lines.append(f"Turn {turn_idx}: \"{prompt}\"")

        if captions:
            lines.append(f"  Frames: {', '.join(captions)}")

        # Full narration only for the most recent prior turn
        if is_last:
            narration_path = os.path.join(output_dir, "narration.txt")
            if os.path.exists(narration_path):
                with open(narration_path) as f:
                    full_narration = f.read().strip()
                if full_narration:
                    lines.append("  Full narration of this turn:")
                    for narr_line in full_narration.splitlines():
                        lines.append(f"    {narr_line}")

        lines.append("")

    # ── Pause context ────────────────────────────────────────────────────────
    if pause_session_id and pause_frame_index is not None:
        pause_narration_text = ""
        with _get_db() as conn:
            pause_row = conn.execute(
                "SELECT output_dir FROM sessions WHERE id = ?", (pause_session_id,)
            ).fetchone()
        if pause_row and pause_row["output_dir"]:
            narrations = _parse_narrations_from_file(
                os.path.join(pause_row["output_dir"], "narration.txt")
            )
            if pause_frame_index < len(narrations):
                pause_narration_text = narrations[pause_frame_index]

        lines += [
            "## USER PAUSE CONTEXT",
            f"The user paused the video at frame {pause_frame_index + 1}"
            + (f" titled \"{pause_caption}\"" if pause_caption else "") + ".",
        ]
        if pause_narration_text:
            lines.append(f"The lesson was saying at that moment: \"{pause_narration_text}\"")
        lines += [
            "Their follow-up question is likely about this specific concept.",
            "Focus your new lesson on resolving the confusion or curiosity raised at this point.",
            "",
        ]

    lines += [
        "────────────────────────────────────────────────────────────────────",
        "",
    ]
    return "\n".join(lines)


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
async def image_generation(
    message:             str  = Form(""),
    conversation_id:     str  = Form(None),
    pause_session_id:    str  = Form(None),   # session the user paused on (for context)
    pause_frame_index:   int  = Form(None),   # frame index the user paused on
    pause_caption:       str  = Form(None),   # caption of the paused frame
    parent_session_id:   str  = Form(None),   # session this new session branches from (persisted)
    parent_frame_index:  int  = Form(None),   # frame on parent that triggered this branch (null = follow-up)
    notes_enabled:       str  = Form("false"), # "true" | "false"
):
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

    _insert_session(
        session_id,
        message,
        conversation_id,
        turn_index,
        parent_session_id=parent_session_id,
        parent_frame_index=parent_frame_index,
    )
    _touch_conversation(conversation_id)

    # Build conversation context for follow-up turns
    conversation_context = ""
    if turn_index > 1:
        conversation_context = _build_conversation_context(
            conversation_id   = conversation_id,
            current_session_id = session_id,
            pause_session_id  = pause_session_id,
            pause_frame_index = pause_frame_index,
            pause_caption     = pause_caption,
        )
        if conversation_context:
            logger.info(
                "Conversation context built  session=%s  turn=%d  chars=%d  has_pause=%s",
                session_id, turn_index, len(conversation_context), pause_session_id is not None,
            )

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
        plan = await create_plan(message, conversation_context)
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

        captions            = [frame.caption for frame in plan.frames]
        _notes_on           = notes_enabled.lower() == "true"
        suggested_followups = plan.suggested_followups or [] if _notes_on else []
        notes               = (plan.notes or "")              if _notes_on else ""
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
                json.dump({"render_path": "manim", "images": png_paths, "captions": captions,
                           "suggested_followups": suggested_followups, "notes": notes}, f, indent=2)

            result_payload = {
                "session_id": session_id,
                "render_path": "manim",
                "frame_count": plan.frame_count,
                "intent_type": plan.intent_type,
                "captions": captions,
                "images": png_paths,
                "ui_file_type": "python",
                "suggested_followups": suggested_followups,
                "notes": notes,
            }

        elif plan.intent_type in SVG_INTENT_TYPES and svg_available():
            logger.info("Render path → svg  session=%s", session_id)
            _log({"event": "stage_start", "stage": "frame_generation", "path": "svg", "frame_count": plan.frame_count})
            svg_output_dir = os.path.join(output_dir, "svg")
            png_paths = await generate_svg_frames(plan, svg_prompt_template, svg_output_dir)
            _log({"event": "stage_complete", "stage": "frame_generation", "path": "svg"})
            logger.info("SVG frames generated  session=%s  paths=%s", session_id, png_paths)

            with open(os.path.join(output_dir, "frames.json"), "w") as f:
                json.dump({"render_path": "svg", "images": png_paths, "captions": captions,
                           "suggested_followups": suggested_followups, "notes": notes}, f, indent=2)

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
                "suggested_followups": suggested_followups,
                "notes": notes,
            }

        else:
            use_mermaid = plan.intent_type in MERMAID_INTENT_TYPES and _sidecar_available()

            # Mermaid intent but sidecar down → fall back to SVG if cairosvg is available
            if not use_mermaid and plan.intent_type in MERMAID_INTENT_TYPES and svg_available():
                logger.warning(
                    "Mermaid sidecar unavailable — falling back to svg  session=%s  intent=%s",
                    session_id, plan.intent_type,
                )
                _log({"event": "info", "message": "Mermaid sidecar unavailable — falling back to SVG"})
                _log({"event": "stage_start", "stage": "frame_generation", "path": "svg_fallback", "frame_count": plan.frame_count})
                svg_output_dir = os.path.join(output_dir, "svg")
                png_paths = await generate_svg_frames(plan, svg_prompt_template, svg_output_dir)
                _log({"event": "stage_complete", "stage": "frame_generation", "path": "svg_fallback"})
                logger.info("SVG fallback frames generated  session=%s  paths=%s", session_id, png_paths)

                with open(os.path.join(output_dir, "frames.json"), "w") as f:
                    json.dump({"render_path": "svg", "images": png_paths, "captions": captions,
                               "suggested_followups": suggested_followups, "notes": notes}, f, indent=2)

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
                    "suggested_followups": suggested_followups,
                    "notes": notes,
                }

            else:
                path_label = "mermaid" if use_mermaid else "slim_json"

                if use_mermaid:
                    logger.info("Render path → mermaid  session=%s", session_id)
                else:
                    if plan.intent_type in MANIM_INTENT_TYPES:
                        logger.warning(
                            "Manim not available — falling back to slim_json  session=%s  intent=%s",
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
                    if plan.intent_type in SVG_INTENT_TYPES:
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
                    json.dump({"render_path": path_label, "images": [None] * plan.frame_count, "captions": captions,
                               "suggested_followups": suggested_followups, "notes": notes}, f, indent=2)

                result_payload = {
                    "session_id": session_id,
                    "excalidraw": excalidraw_result,
                    "elements_count": len(excalidraw_result["elements"]),
                    "frame_count": plan.frame_count,
                    "intent_type": plan.intent_type,
                    "render_path": path_label,
                    "captions": captions,
                    "ui_file_type": "json",
                    "suggested_followups": suggested_followups,
                    "notes": notes,
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

        result_payload["conversation_id"]    = conversation_id
        result_payload["turn_index"]         = turn_index
        result_payload["parent_session_id"]  = parent_session_id
        result_payload["parent_frame_index"] = parent_frame_index
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
            "frame_count, video_path, turn_index, parent_session_id, parent_frame_index "
            "FROM sessions WHERE conversation_id = ? ORDER BY turn_index ASC",
            (conversation_id,),
        ).fetchall()
    return {**dict(conv), "turns": [dict(t) for t in turns]}


@app.get("/api/conversations/{conversation_id}/tree")
def get_conversation_tree(conversation_id: str):
    """Lightweight endpoint for the canvas tree view.
    Returns only the fields needed to render nodes and edges — no captions or images.
    """
    with _get_db() as conn:
        conv = conn.execute(
            "SELECT id, title FROM conversations WHERE id = ?", (conversation_id,)
        ).fetchone()
        if not conv:
            return JSONResponse({"error": "Conversation not found"}, status_code=404)

        nodes = conn.execute(
            "SELECT id, prompt, status, intent_type, frame_count, video_path, "
            "turn_index, parent_session_id, parent_frame_index "
            "FROM sessions WHERE conversation_id = ? ORDER BY turn_index ASC",
            (conversation_id,),
        ).fetchall()

    return {
        "conversation_id": conv["id"],
        "title":           conv["title"],
        "nodes": [
            {
                **dict(n),
                "video_ready": bool(n["video_path"] and os.path.exists(n["video_path"])),
            }
            for n in nodes
        ],
    }


# ── Merge videos ──────────────────────────────────────────────────────────────

@app.post("/api/conversations/{conversation_id}/merge")
def merge_conversation_videos(conversation_id: str):
    try:
        with _get_db() as conn:
            rows = conn.execute(
                "SELECT id, prompt, video_path, parent_session_id, turn_index "
                "FROM sessions WHERE conversation_id = ? AND status = 'done' ORDER BY turn_index ASC",
                (conversation_id,),
            ).fetchall()

        if not rows:
            return JSONResponse({"error": "No completed sessions found for this conversation"}, status_code=400)

        # Build topological order via BFS from roots
        session_ids = {r["id"] for r in rows}
        session_map = {r["id"]: dict(r) for r in rows}

        children: dict = {}
        for r in rows:
            pid = r["parent_session_id"]
            if pid and pid in session_ids:
                children.setdefault(pid, []).append(r["id"])

        # Roots: sessions with no parent or parent not in this conversation's sessions
        roots = [
            r["id"] for r in rows
            if not r["parent_session_id"] or r["parent_session_id"] not in session_ids
        ]

        ordered_ids = []
        queue = list(roots)
        visited = set()
        while queue:
            sid = queue.pop(0)
            if sid in visited:
                continue
            visited.add(sid)
            ordered_ids.append(sid)
            for child_id in children.get(sid, []):
                queue.append(child_id)

        # Collect video paths, skip missing files
        video_paths = []
        ordered_sessions = []
        for sid in ordered_ids:
            s = session_map[sid]
            vp = s.get("video_path")
            if vp and os.path.exists(vp):
                video_paths.append(vp)
                ordered_sessions.append({"id": sid, "prompt": s["prompt"]})

        if len(video_paths) < 2:
            return JSONResponse(
                {"error": f"Need at least 2 videos to merge, found {len(video_paths)}"},
                status_code=400,
            )

        output_path = os.path.join(OUTPUTS_DIR, f"merged_{conversation_id}.mp4")

        # Resolve ffmpeg binary — prefer imageio_ffmpeg bundled binary, fall back to PATH
        try:
            import imageio_ffmpeg
            ffmpeg_bin = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            ffmpeg_bin = "ffmpeg"

        # Write concat list and run ffmpeg
        with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False) as f:
            for vp in video_paths:
                f.write(f"file '{vp}'\n")
            concat_file = f.name

        try:
            subprocess.run(
                [ffmpeg_bin, '-y', '-f', 'concat', '-safe', '0',
                 '-i', concat_file, '-c', 'copy', output_path],
                check=True,
                capture_output=True,
            )
        except FileNotFoundError:
            os.unlink(concat_file)
            return JSONResponse(
                {"error": "ffmpeg not found — please install ffmpeg and ensure it is on PATH"},
                status_code=500,
            )
        finally:
            if os.path.exists(concat_file):
                os.unlink(concat_file)

        # Persist merged video path
        with _get_db() as conn:
            conn.execute(
                "UPDATE conversations SET merged_video_path = ? WHERE id = ?",
                (output_path, conversation_id),
            )
            conn.commit()

        logger.info(
            "Merge complete  conversation=%s  sessions=%d  output=%s",
            conversation_id, len(video_paths), output_path,
        )

        return {
            "merged_video_url": f"/api/conversations/{conversation_id}/merged_video",
            "session_count": len(ordered_sessions),
            "sessions": ordered_sessions,
        }

    except subprocess.CalledProcessError as e:
        logger.error("ffmpeg merge failed  conversation=%s  stderr=%s", conversation_id, e.stderr)
        return JSONResponse(
            {"error": f"ffmpeg failed: {e.stderr.decode(errors='replace') if e.stderr else str(e)}"},
            status_code=500,
        )
    except Exception as e:
        logger.error("Merge failed  conversation=%s", conversation_id, exc_info=True)
        return JSONResponse({"error": f"Merge failed: {e}"}, status_code=500)


@app.get("/api/conversations/{conversation_id}/merged_video")
def get_merged_video(conversation_id: str):
    with _get_db() as conn:
        row = conn.execute(
            "SELECT merged_video_path FROM conversations WHERE id = ?", (conversation_id,)
        ).fetchone()

    if not row:
        return JSONResponse({"error": "Conversation not found"}, status_code=404)

    path = row["merged_video_path"]
    if path and os.path.exists(path):
        return FileResponse(
            path,
            media_type="video/mp4",
            filename=f"merged_{conversation_id[:8]}.mp4",
        )

    return JSONResponse({"error": "Merged video not found"}, status_code=404)


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

def _sse(payload: dict) -> str:
    """
    Format one Server-Sent Event line.

    SSE protocol: each event is  'data: <json>\\n\\n'
    The double newline is what signals the browser that the event is complete.
    """
    return f"data: {json.dumps(payload)}\n\n"


# SSE response headers sent on every streaming video response.
# X-Accel-Buffering: no  → tells nginx NOT to buffer the stream (critical for SSE behind a proxy)
# Cache-Control: no-cache → prevents any intermediate cache from holding the stream
_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


@app.post("/api/generate_video/{session_id}")
async def generate_video(
    session_id: str,
    use_openai_tts: bool = True,
):
    """
    Generate a video for an existing session — streams progress via SSE.

    Returns a text/event-stream response. Each event is a JSON object:

      {"type": "stage",        "stage": "export_frames", "message": "..."}
      {"type": "stage",        "stage": "tts",           "total": 5}
      {"type": "tts_progress", "frame": 1,               "total": 5}
      {"type": "stage",        "stage": "assembling",    "message": "..."}
      {"type": "done",         "session_id": "...",      "video_path": "...", ...}
      {"type": "error",        "message": "..."}

    The stream keeps the HTTP connection alive for the full duration of the
    pipeline (frame export → parallel TTS → video assembly), so nginx/ALB
    timeouts never fire on an idle connection.

    Query param:
      use_openai_tts=false  → fall back to gTTS (free, no API key needed)
    """
    logger.info("Video generation requested  session=%s  openai_tts=%s", session_id, use_openai_tts)

    # ── Pre-flight checks (return plain JSON errors before the stream opens) ───
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

    output_dir = row["output_dir"]
    if not output_dir or not os.path.isdir(output_dir):
        return JSONResponse({"error": "Session output directory missing"}, status_code=404)

    frames_json_path = os.path.join(output_dir, "frames.json")
    if not os.path.exists(frames_json_path):
        return JSONResponse({"error": "frames.json not found — re-run image generation"}, status_code=404)

    narration_path = os.path.join(output_dir, "narration.txt")
    if not os.path.exists(narration_path):
        return JSONResponse({"error": "narration.txt not found"}, status_code=404)

    # ── Load session data ──────────────────────────────────────────────────────
    with open(frames_json_path) as f:
        frames_data = json.load(f)
    captions = frames_data.get("captions", [])

    with open(narration_path) as f:
        narration_txt = f.read()
    narration_texts = parse_narration(narration_txt)

    # Pad/trim narration list to match caption count
    while len(narration_texts) < len(captions):
        narration_texts.append("")
    narration_texts = narration_texts[: len(captions)]

    video_path = os.path.join(output_dir, "final_video.mp4")
    tts_backend = "openai" if use_openai_tts else "gtts"

    # ── Idempotency: already done — emit a single "done" event and close ───────
    if row["video_path"] and os.path.exists(row["video_path"]):
        logger.info("Video already exists — returning cached  session=%s", session_id)

        async def _cached_stream():
            yield _sse({
                "type":        "done",
                "session_id":  session_id,
                "video_path":  row["video_path"],
                "frame_count": row["frame_count"],
                "tts_backend": "cached",
            })

        return StreamingResponse(_cached_stream(), media_type="text/event-stream", headers=_SSE_HEADERS)

    # ── Main pipeline as an async generator ───────────────────────────────────
    async def event_stream():
        t_start = time.time()

        def elapsed() -> float:
            return round(time.time() - t_start, 1)

        try:
            # ── Stage 1: normalize frames to 1920×1080 PNGs ───────────────────
            logger.info("Video stage 1/3: frame export  session=%s  frames=%d", session_id, len(captions))
            yield _sse({"type": "stage", "stage": "export_frames", "message": "Exporting frames", "elapsed_s": elapsed()})

            t1 = time.time()
            normalized_pngs = await asyncio.to_thread(export_frames, output_dir, captions)
            d1 = round(time.time() - t1, 1)

            logger.info("Frame export done  session=%s  exported=%d  duration=%.1fs", session_id, len(normalized_pngs), d1)
            yield _sse({"type": "stage_done", "stage": "export_frames", "count": len(normalized_pngs), "duration_s": d1, "elapsed_s": elapsed()})

            # ── Stage 2: parallel TTS with per-frame progress ─────────────────
            # All N frames fire concurrently. Each frame puts its index into
            # progress_queue the moment its audio file is ready, so we can
            # stream a progress event immediately — no waiting for the full batch.
            total_frames = len(narration_texts)
            logger.info("Video stage 2/3: TTS  session=%s  backend=%s  frames=%d", session_id, tts_backend, total_frames)
            yield _sse({"type": "stage", "stage": "tts", "message": "Generating audio", "total": total_frames, "elapsed_s": elapsed()})

            progress_queue: asyncio.Queue[int] = asyncio.Queue()

            t2 = time.time()
            # create_task schedules TTS in the background so we can consume
            # progress events from the queue while TTS runs concurrently
            tts_task = asyncio.create_task(
                generate_audio_parallel(narration_texts, output_dir, use_openai_tts, progress_queue)
            )

            # Stream one progress event per frame as each audio file completes
            for _ in range(total_frames):
                frame_idx = await progress_queue.get()
                yield _sse({"type": "tts_progress", "frame": frame_idx + 1, "total": total_frames, "elapsed_s": elapsed()})

            audio_paths = await tts_task
            d2 = round(time.time() - t2, 1)
            audio_ok = sum(1 for p in audio_paths if p)
            logger.info("TTS done  session=%s  generated=%d/%d  duration=%.1fs", session_id, audio_ok, total_frames, d2)
            yield _sse({"type": "stage_done", "stage": "tts", "generated": audio_ok, "total": total_frames, "duration_s": d2, "elapsed_s": elapsed()})

            # ── Stage 3: assemble the final .mp4 ─────────────────────────────
            # Assembly (libx264 encoding) can take 60–120s on a server.
            # We can't yield mid-function, so we run assemble() as a background
            # task and send a heartbeat every 20s while we wait. This prevents
            # nginx's proxy_read_timeout (default 60s) from killing the
            # connection during the silent encoding gap.
            logger.info("Video stage 3/3: assembly  session=%s  output=%s", session_id, video_path)
            yield _sse({"type": "stage", "stage": "assembling", "message": "Assembling video", "elapsed_s": elapsed()})

            t3 = time.time()
            assemble_task = asyncio.create_task(
                asyncio.to_thread(assemble, normalized_pngs, audio_paths, narration_texts, video_path, captions)
            )

            # Ping every 20s so nginx never sees a 60s silent gap
            while not assemble_task.done():
                try:
                    await asyncio.wait_for(asyncio.shield(assemble_task), timeout=20.0)
                except asyncio.TimeoutError:
                    yield _sse({"type": "heartbeat", "elapsed_s": elapsed()})

            await assemble_task  # raise any exception from the thread
            d3 = round(time.time() - t3, 1)

            logger.info("Video assembly complete  session=%s  path=%s  duration=%.1fs", session_id, video_path, d3)

            # ── Persist and signal done ───────────────────────────────────────
            _update_session(session_id, video_path=video_path)

            total = elapsed()
            logger.info("Video generation done  session=%s  frames=%d  tts=%s  total=%.1fs  (export=%.1fs tts=%.1fs assembly=%.1fs)",
                        session_id, len(normalized_pngs), tts_backend, total, d1, d2, d3)
            yield _sse({
                "type":        "done",
                "session_id":  session_id,
                "video_path":  video_path,
                "frame_count": len(normalized_pngs),
                "tts_backend": tts_backend,
                "elapsed_s":   total,
                "stage_times": {"export_s": d1, "tts_s": d2, "assembly_s": d3},
            })

        except Exception as e:
            logger.error("Video SSE stream failed  session=%s  elapsed=%.1fs", session_id, elapsed(), exc_info=True)
            yield _sse({"type": "error", "message": str(e), "elapsed_s": elapsed()})

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=_SSE_HEADERS)


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
