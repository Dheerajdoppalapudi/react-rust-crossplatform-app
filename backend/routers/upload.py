"""
Upload router — file uploads and multimodal chat.
"""

import logging
import os
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from core.config import UPLOAD_DIR
from core.responses import success
from schemas.sessions import UploadResponse, ChatWithFilesResponse

logger = logging.getLogger(__name__)

router = APIRouter()

_MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB per file


@router.post("/api/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    saved = []
    for file in files:
        content = await file.read()
        if len(content) > _MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File {file.filename!r} exceeds the 50 MB limit",
            )
        ext      = os.path.splitext(file.filename or "")[1]
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = UPLOAD_DIR / filename
        filepath.write_bytes(content)
        saved.append({
            "original_name": file.filename,
            "saved_as":      filename,
            "size":          len(content),
            "content_type":  file.content_type,
        })
    return success({"files": saved})


@router.post("/api/chat-with-files")
async def chat_with_files(
    message: str = Form(""),
    files: list[UploadFile] = File(default=[]),
):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    saved = []
    for file in files:
        content = await file.read()
        if len(content) > _MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File {file.filename!r} exceeds the 50 MB limit",
            )
        ext      = os.path.splitext(file.filename or "")[1]
        filename = f"{uuid.uuid4().hex}{ext}"
        (UPLOAD_DIR / filename).write_bytes(content)
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

    return success({"reply": reply, "files": saved})
