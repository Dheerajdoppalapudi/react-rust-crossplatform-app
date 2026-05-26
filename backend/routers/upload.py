"""
Upload router — file uploads and multimodal chat.

Fixes applied:
  CRIT-4: Both endpoints now require authentication via Depends(get_current_user).
          Uploaded files are scoped to a user-specific subdirectory so users
          cannot enumerate or access each other's uploads.
"""

import asyncio
import structlog
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from core.config import UPLOAD_DIR
from core.s3 import upload_user_file as _s3_upload_user_file, upload_key as _s3_upload_key
from core.db_models import User
from core.limiter import limiter, get_user_key
from core.responses import success
from dependencies.auth import get_current_user
from schemas.sessions import UploadResponse, ChatWithFilesResponse

logger = structlog.get_logger(__name__)

router = APIRouter()

_MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB per file

_ALLOWED_EXTENSIONS = frozenset({
    '.pdf', '.pptx', '.docx', '.txt', '.csv',
    '.png', '.jpg', '.jpeg', '.gif', '.webp',
    '.mp4', '.mov', '.mp3', '.wav',
})


def _user_upload_dir(user_id: str):
    """
    CRIT-4: Scope uploads to a per-user directory.
    Prevents users from guessing each other's file names and reading them.
    """
    d = UPLOAD_DIR / user_id
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("/upload")
@limiter.limit("20/minute", key_func=get_user_key)
async def upload_files(
    request: Request,
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
):
    upload_dir = _user_upload_dir(current_user.id)
    saved = []
    for file in files:
        ext = Path(file.filename or "").suffix.lower()
        if ext not in _ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=415,
                detail=f"File type {ext!r} not allowed. Allowed: {', '.join(sorted(_ALLOWED_EXTENSIONS))}",
            )
        content = await file.read()
        if len(content) > _MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File {file.filename!r} exceeds the 50 MB limit",
            )
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = upload_dir / filename
        filepath.write_bytes(content)
        logger.info("file_uploaded", user=current_user.id, filename=file.filename, size=len(content))
        try:
            s3_key = _s3_upload_key(current_user.id, Path(filename).stem, file.filename or filename)
            await asyncio.to_thread(
                _s3_upload_user_file, str(filepath), s3_key,
                file.content_type or "application/octet-stream",
            )
        except Exception as exc:
            logger.warning("s3_user_upload_failed", user=current_user.id, filename=file.filename, error=str(exc))
        saved.append({
            "original_name": file.filename,
            "saved_as":      filename,
            "size":          len(content),
            "content_type":  file.content_type,
        })
    return success({"files": saved})


@router.post("/chat-with-files")
@limiter.limit("20/minute", key_func=get_user_key)
async def chat_with_files(
    request: Request,
    message: str = Form(""),
    files: list[UploadFile] = File(default=[]),
    current_user: User = Depends(get_current_user),
):
    upload_dir = _user_upload_dir(current_user.id)
    saved = []
    for file in files:
        ext = Path(file.filename or "").suffix.lower()
        if ext not in _ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=415,
                detail=f"File type {ext!r} not allowed. Allowed: {', '.join(sorted(_ALLOWED_EXTENSIONS))}",
            )
        content = await file.read()
        if len(content) > _MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File {file.filename!r} exceeds the 50 MB limit",
            )
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = upload_dir / filename
        filepath.write_bytes(content)
        logger.info("file_uploaded", user=current_user.id, filename=file.filename, size=len(content))
        try:
            s3_key = _s3_upload_key(current_user.id, Path(filename).stem, file.filename or filename)
            await asyncio.to_thread(
                _s3_upload_user_file, str(filepath), s3_key,
                file.content_type or "application/octet-stream",
            )
        except Exception as exc:
            logger.warning("s3_user_upload_failed", user=current_user.id, filename=file.filename, error=str(exc))
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
