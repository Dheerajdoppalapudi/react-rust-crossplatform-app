import os
import uuid
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from services.excel_formatter import format_excel

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


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/chat")
async def chat(message: str = Form("")):
    return {"reply": message}


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
