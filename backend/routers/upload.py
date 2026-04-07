"""
Upload router — file uploads and multimodal chat.

Fixes applied:
  CRIT-4: Both endpoints now require authentication via Depends(get_current_user).
          Uploaded files are scoped to a user-specific subdirectory so users
          cannot enumerate or access each other's uploads.
"""

import logging
import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from core.config import UPLOAD_DIR
from core.db_models import User
from core.responses import success
from dependencies.auth import get_current_user
from schemas.sessions import UploadResponse, ChatWithFilesResponse

logger = logging.getLogger(__name__)

router = APIRouter()

_MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB per file


def _user_upload_dir(user_id: str):
    """
    CRIT-4: Scope uploads to a per-user directory.
    Prevents users from guessing each other's file names and reading them.
    """
    d = UPLOAD_DIR / user_id
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("/api/upload")
async def upload_files(
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
):
    upload_dir = _user_upload_dir(current_user.id)
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
        filepath = upload_dir / filename
        filepath.write_bytes(content)
        logger.info(
            "file_uploaded  user=%s  filename=%r  size=%d",
            current_user.id, file.filename, len(content),
        )
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
    current_user: User = Depends(get_current_user),
):
    upload_dir = _user_upload_dir(current_user.id)
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
        (upload_dir / filename).write_bytes(content)
        logger.info(
            "file_uploaded  user=%s  filename=%r  size=%d",
            current_user.id, file.filename, len(content),
        )
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
