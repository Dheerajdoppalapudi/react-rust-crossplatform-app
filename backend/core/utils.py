"""
Shared utilities used across routers and services.
"""

import json
import logging
from pathlib import Path

from fastapi import HTTPException

from core.config import MAX_FRAMES_JSON_BYTES, OUTPUTS_DIR

logger = logging.getLogger(__name__)


def safe_resolve(
    db_path: str | None,
    *,
    base: str = OUTPUTS_DIR,
    label: str = "resource",
) -> Path:
    """
    Resolve `db_path` to an absolute Path and verify it is inside `base`.

    Raises 404 if the path is missing/None and 403 if it escapes the base
    directory. This prevents path-traversal attacks on any file-serving endpoint.
    """
    if not db_path:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    resolved = Path(db_path).resolve()
    base_resolved = Path(base).resolve()
    if not str(resolved).startswith(str(base_resolved) + "/") and resolved != base_resolved:
        logger.warning(
            "path_traversal_blocked  label=%s  raw=%r  resolved=%s",
            label, db_path, resolved,
        )
        raise HTTPException(status_code=403, detail="Access denied")
    return resolved


def read_json_file(path: Path, *, max_bytes: int = MAX_FRAMES_JSON_BYTES) -> dict | list:
    """
    Read and parse a JSON file with a size guard.

    Raises 413 if the file exceeds `max_bytes` (default 10 MB) to prevent
    DoS via pathologically large output files.
    """
    size = path.stat().st_size
    if size > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size} bytes, max {max_bytes})",
        )
    return json.loads(path.read_text(encoding="utf-8"))
