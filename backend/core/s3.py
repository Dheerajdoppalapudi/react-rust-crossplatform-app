"""
S3 + CloudFront helpers for Zenith media storage.

Two buckets:
  zenith-app-media   — public, served via CloudFront (frames, videos, scene_ir)
  zenith-app-uploads — private, accessed via presigned URLs (user uploads)

Key structure (zenith-app-media):
  frames/{session_id}/{index:03d}.png   — video frame PNGs
  video/{session_id}/final.mp4          — assembled video
  meta/{session_id}/scene_ir.json       — interactive lesson JSON
  meta/{session_id}/frames.json         — video frame metadata

Keys are always derived from session_id — never stored as paths in the DB.
"""

import io
from pathlib import Path
from typing import Optional

import boto3
from botocore.exceptions import ClientError

from core.config import AWS_REGION, S3_MEDIA_BUCKET, S3_UPLOADS_BUCKET, CLOUDFRONT_DOMAIN

import structlog
logger = structlog.get_logger(__name__)

# Module-level client — one connection pool shared across all requests.
_s3: Optional[boto3.client] = None


def _get_client():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3", region_name=AWS_REGION)
    return _s3


# ── Key derivation ────────────────────────────────────────────────────────────

def frame_key(session_id: str, index: int) -> str:
    return f"frames/{session_id}/{index:03d}.png"

def video_key(session_id: str) -> str:
    return f"video/{session_id}/final.mp4"

def meta_key(session_id: str, filename: str) -> str:
    return f"meta/{session_id}/{filename}"

def upload_key(user_id: str, upload_id: str, filename: str) -> str:
    return f"{user_id}/{upload_id}_{filename}"

def cdn_url(key: str) -> str:
    return f"https://{CLOUDFRONT_DOMAIN}/{key}"


# ── Upload helpers ────────────────────────────────────────────────────────────

def upload_file(local_path: str | Path, key: str, content_type: str = "application/octet-stream") -> str:
    """Upload a local file to zenith-app-media. Returns the CloudFront URL."""
    _get_client().upload_file(
        str(local_path),
        S3_MEDIA_BUCKET,
        key,
        ExtraArgs={"ContentType": content_type},
    )
    url = cdn_url(key)
    logger.info("s3_upload", key=key, bucket=S3_MEDIA_BUCKET)
    return url


def upload_bytes(data: bytes, key: str, content_type: str = "application/octet-stream") -> str:
    """Upload raw bytes to zenith-app-media. Returns the CloudFront URL."""
    _get_client().put_object(
        Body=data,
        Bucket=S3_MEDIA_BUCKET,
        Key=key,
        ContentType=content_type,
    )
    return cdn_url(key)


def upload_user_file(local_path: str | Path, key: str, content_type: str = "application/octet-stream") -> str:
    """Upload a user-uploaded file to the private zenith-app-uploads bucket."""
    _get_client().upload_file(
        str(local_path),
        S3_UPLOADS_BUCKET,
        key,
        ExtraArgs={"ContentType": content_type},
    )
    logger.info("s3_upload_private", key=key, bucket=S3_UPLOADS_BUCKET)
    return key


# ── Convenience uploaders ─────────────────────────────────────────────────────

def upload_frame(local_path: str | Path, session_id: str, index: int) -> str:
    """Upload a frame PNG and return its CloudFront URL."""
    return upload_file(local_path, frame_key(session_id, index), "image/png")


def upload_video(local_path: str | Path, session_id: str) -> str:
    """Upload the assembled MP4 and return its CloudFront URL."""
    return upload_file(local_path, video_key(session_id), "video/mp4")


def upload_scene_ir(data: bytes, session_id: str) -> str:
    """Upload scene_ir.json bytes and return its CloudFront URL."""
    return upload_bytes(data, meta_key(session_id, "scene_ir.json"), "application/json")


def upload_frames_json(data: bytes, session_id: str) -> str:
    """Upload frames.json bytes and return its CloudFront URL."""
    return upload_bytes(data, meta_key(session_id, "frames.json"), "application/json")


# ── Existence check ───────────────────────────────────────────────────────────

def object_exists(key: str, bucket: str = S3_MEDIA_BUCKET) -> bool:
    """Return True if the S3 key exists in the given bucket."""
    try:
        _get_client().head_object(Bucket=bucket, Key=key)
        return True
    except ClientError:
        return False


def video_ready(session_id: str) -> bool:
    """Return True if the final video has been uploaded for this session."""
    return object_exists(video_key(session_id))


# ── Presigned URLs (private bucket) ──────────────────────────────────────────

def presigned_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned GET URL for a private upload."""
    return _get_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_UPLOADS_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )


# ── Delete helpers ────────────────────────────────────────────────────────────

def delete_session_objects(session_id: str) -> None:
    """Delete all S3 objects for a session (frames, video, meta)."""
    client = _get_client()
    for prefix in (f"frames/{session_id}/", f"video/{session_id}/", f"meta/{session_id}/"):
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=S3_MEDIA_BUCKET, Prefix=prefix):
            objects = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
            if objects:
                client.delete_objects(Bucket=S3_MEDIA_BUCKET, Delete={"Objects": objects})
    logger.info("s3_session_deleted", session_id=session_id)
