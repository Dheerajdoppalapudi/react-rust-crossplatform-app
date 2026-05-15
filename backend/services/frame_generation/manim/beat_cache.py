"""
Content-addressed MP4 cache for beat renders.

Cache key = sha256(description + beat_class) — excludes title/narration/keywords
so that semantically identical animations reuse the same render regardless of
minor metadata changes.

Cache dir: OUTPUTS_DIR/beat_cache/{key[:2]}/{key}.mp4
No TTL — invalidate manually: rm -rf outputs/beat_cache/
"""

import hashlib
import json
import logging
import shutil
from pathlib import Path

from core.config import BEAT_CACHE_DIR
from .beat_types import BeatPlan

logger = logging.getLogger(__name__)


def _key(beat: BeatPlan) -> str:
    payload = json.dumps(
        {"desc": beat.description, "class": beat.beat_class},
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _cache_path(key: str) -> Path:
    return BEAT_CACHE_DIR / key[:2] / f"{key}.mp4"


def get(beat: BeatPlan) -> str | None:
    """Return cached mp4 path string if it exists, else None."""
    key = _key(beat)
    p = _cache_path(key)
    if p.exists():
        logger.info("beat_cache hit  key=%s  beat_index=%d", key[:12], beat.index)
        return str(p)
    return None


def store(beat: BeatPlan, src_mp4: str) -> str:
    """Copy rendered mp4 into the cache and return the cache path string."""
    key = _key(beat)
    dest = _cache_path(key)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_mp4, dest)
    logger.info("beat_cache stored  key=%s  beat_index=%d", key[:12], beat.index)
    return str(dest)
