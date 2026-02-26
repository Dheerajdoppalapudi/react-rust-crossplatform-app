import os
import json
import uuid
import urllib.parse
import webbrowser
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from services.beautification_agent.excel_formatter import format_excel
from services.excalidraw.excalidraw_enhancer import enhance
from services.excalidraw.planner import create_plan, generate_all_frames
from services.excalidraw.combiner import combine_frames
from services.excalidraw.mermaid_generator import generate_mermaid_frames, _sidecar_available

# Intent types that use the Mermaid path (auto-layout, no coordinate invention)
MERMAID_INTENT_TYPES = {"process", "architecture", "timeline"}

app = FastAPI(title="Falcon API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
FORMATTED_DIR = os.path.join(os.path.dirname(__file__), "formatted")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(FORMATTED_DIR, exist_ok=True)


EXCALIDRAW_DIR = os.path.join(os.path.dirname(__file__), "services", "excalidraw")
OUTPUT_FILE = os.path.join(EXCALIDRAW_DIR, "sample_output.excalidraw")


def open_in_excalidraw(excalidraw_data: dict, excalidraw_url: str = "http://localhost:3000") -> bool:
    """
    Open the generated Excalidraw diagram in the local Excalidraw instance.
    Uses URL encoding to pass the diagram data directly to Excalidraw.
    """
    try:
        # Convert the excalidraw data to a compact JSON string (no spaces)
        json_str = json.dumps(excalidraw_data, separators=(",", ":"))

        # URL-encode the JSON so it survives being placed in a URL fragment
        encoded_data = urllib.parse.quote(json_str)

        # Excalidraw reads scene data from the URL hash
        excalidraw_load_url = f"{excalidraw_url}#{encoded_data}"

        print(f"Opening diagram in Excalidraw at: {excalidraw_url}")
        print(f"Diagram data size: {len(json_str)} characters")

        # Opens in the default browser on the same machine as the server
        webbrowser.open(excalidraw_load_url)
        return True
    except Exception as e:
        print(f"Failed to open in Excalidraw: {e}")
        return False


@app.get("/api/open_in_excalidraw")
def open_excalidraw_endpoint():
    """
    Read sample_output.excalidraw and open it in the locally running
    Excalidraw instance at http://localhost:3000.
    """
    if not os.path.exists(OUTPUT_FILE):
        return {"success": False, "error": "No diagram found. Generate one first."}

    with open(OUTPUT_FILE) as f:
        excalidraw_data = json.load(f)

    success = open_in_excalidraw(excalidraw_data)
    return {"success": success}


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/chat")
async def chat(message: str = Form("")):
    return {"reply": message}


@app.post("/api/image_generation")
async def image_generation(message: str = Form("")):
    excalidraw_dir = os.path.join(os.path.dirname(__file__), "services", "excalidraw")

    # Load prompt templates (both paths read up front, only one is used per request)
    with open(os.path.join(excalidraw_dir, "prompts", "prompt_template.md")) as f:
        prompt_template = f.read()
    with open(os.path.join(excalidraw_dir, "prompts", "mermaid_prompt.md")) as f:
        mermaid_prompt_template = f.read()

    # Stage 1 — Planning call (1 LLM call)
    # Decides how many frames are needed, what each frame shows,
    # what caption goes under each frame, shared visual style, and intent_type.
    plan = await create_plan(message)

    # Stage 2 — Frame generation (N parallel LLM calls)
    # Route based on intent_type:
    #   Mermaid path  → process, architecture, timeline
    #                   LLM writes Mermaid syntax → Node sidecar converts to elements
    #                   Auto-layout: no coordinate hallucination, no overlaps
    #   Slim JSON path → concept_analogy, math, comparison
    #                   LLM writes element coordinates → enhancer fills defaults
    use_mermaid = (
        plan.intent_type in MERMAID_INTENT_TYPES
        and _sidecar_available()
    )
    if use_mermaid:
        print(f"[main] Using Mermaid path for intent_type='{plan.intent_type}'")
        frame_slims = await generate_mermaid_frames(plan, mermaid_prompt_template)
    else:
        if plan.intent_type in MERMAID_INTENT_TYPES:
            print(f"[main] Mermaid sidecar unavailable — falling back to slim JSON path")
        frame_slims = await generate_all_frames(plan, prompt_template)

    # Stage 3 — Combine
    # Shift each frame's coordinates into its horizontal slot and merge
    # everything into one slim JSON. Captions are added as text elements.
    captions = [frame.caption for frame in plan.frames]
    combined_slim = combine_frames(frame_slims, captions)

    # Persist the combined slim JSON (useful for debugging)
    slim_path = os.path.join(excalidraw_dir, "sample_slim.json")
    with open(slim_path, "w") as f:
        json.dump(combined_slim, f, indent=2)

    # Stage 4 — Enhance
    # The existing enhancer runs on the combined slim JSON exactly as before.
    result = enhance(combined_slim)
    output_path = os.path.join(excalidraw_dir, "sample_output.excalidraw")
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2)

    # Save narrations to narration.txt alongside the .excalidraw file.
    # Format: one block per frame with the caption as a header and the
    # teaching-voice narration as the body, separated by blank lines.
    narration_path = os.path.join(excalidraw_dir, "narration.txt")
    narration_lines = []
    for i, frame in enumerate(plan.frames):
        narration_lines.append(f"Frame {i + 1}: {frame.caption}")
        narration_lines.append(frame.narration)
        narration_lines.append("")  # blank line between frames
    with open(narration_path, "w") as f:
        f.write("\n".join(narration_lines).strip() + "\n")

    return {
        "excalidraw": result,
        "elements_count": len(result["elements"]),
        "frame_count": plan.frame_count,
        "intent_type": plan.intent_type,
        "render_path": "mermaid" if use_mermaid else "slim_json",
        "captions": captions,
    }


@app.post("/api/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    saved = []
    for file in files:
        ext = os.path.splitext(file.filename)[1]
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
        saved.append({
            "original_name": file.filename,
            "saved_as": filename,
            "size": len(content),
            "content_type": file.content_type,
        })
    return {"files": saved}


@app.post("/api/chat-with-files")
async def chat_with_files(
    message: str = Form(""),
    files: list[UploadFile] = File(default=[]),
):
    # Save files
    saved = []
    for file in files:
        ext = os.path.splitext(file.filename)[1]
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
        saved.append({
            "original_name": file.filename,
            "saved_as": filename,
            "size": len(content),
            "content_type": file.content_type,
        })

    # Echo reply
    if message and saved:
        reply = f"{message}\n\n[Received {len(saved)} file(s): {', '.join(f['original_name'] for f in saved)}]"
    elif saved:
        reply = f"Received {len(saved)} file(s): {', '.join(f['original_name'] for f in saved)}"
    else:
        reply = message

    return {"reply": reply, "files": saved}


@app.post("/api/excel-formatting")
async def excel_formatting(file: UploadFile = File(...)):
    if not file.filename.endswith((".xlsx", ".xls")):
        return {"error": "Only Excel files (.xlsx, .xls) are accepted"}

    # Save uploaded file
    ext = os.path.splitext(file.filename)[1]
    upload_name = f"{uuid.uuid4().hex}{ext}"
    upload_path = os.path.join(UPLOAD_DIR, upload_name)
    content = await file.read()
    with open(upload_path, "wb") as f:
        f.write(content)

    # Format and save to formatted dir
    original_stem = os.path.splitext(file.filename)[0]
    output_name = f"{original_stem}_formatted_{uuid.uuid4().hex[:8]}{ext}"
    output_path = os.path.join(FORMATTED_DIR, output_name)

    try:
        result = format_excel(upload_path, output_path)
    except Exception as e:
        return {"error": f"Formatting failed: {str(e)}"}

    return FileResponse(
        path=output_path,
        filename=output_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "X-Sheets-Processed": str(result["sheets_processed"]),
            "X-Total-Rows": str(result["total_rows"]),
            "X-LLM-Enhanced": str(result["llm_enhanced"]),
            "X-Theme-Applied": result.get("theme_applied") or "rule-based-only",
        },
    )
