"""
TTS Service — converts per-frame narration text into audio files.

Supports two backends, selected via the USE_OPENAI_TTS env variable:
  - gTTS (default, free):  pip install gtts
  - OpenAI TTS (quality):  pip install openai  +  OPENAI_API_KEY env var

narration.txt format (written by main.py):
    Frame 1: Step 1: DNS Lookup
    When you type a URL into your browser, it doesn't know where to go...

    Frame 2: Step 2: IP Returned
    The DNS Resolver looks up its records and replies with the IP address...

parse_narration() splits this into one string per frame.
generate_audio() writes one .mp3 per frame and returns the list of paths.

If TTS fails for a frame, that entry in the returned list is None.
The video assembler uses word-count-based timing as a fallback for None entries.
"""

import asyncio
import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Narration parser
# ---------------------------------------------------------------------------

def parse_narration(narration_txt: str) -> list[str]:
    """
    Parse narration.txt content into a list of per-frame narration strings.

    Each entry is the body text for that frame (the lines between the
    "Frame N: ..." header and the next header or end of file).

    Returns an empty list if the file is empty or has no Frame headers.
    """
    # Split on the "Frame N:" marker lines (captures the index)
    parts = re.split(r"^Frame\s+\d+:.*$", narration_txt, flags=re.MULTILINE)

    # First part is empty (before "Frame 1:") — skip it
    narrations = []
    for part in parts[1:]:
        text = part.strip()
        narrations.append(text if text else "")

    return narrations


# ---------------------------------------------------------------------------
# Word-count fallback duration (used when TTS fails)
# ---------------------------------------------------------------------------

_WORDS_PER_SECOND = 2.3  # average speaking pace


def estimate_duration(text: str) -> float:
    """Estimate audio duration in seconds based on word count."""
    words = len(text.split())
    return max(2.0, words / _WORDS_PER_SECOND)


# ---------------------------------------------------------------------------
# gTTS backend (default)
# ---------------------------------------------------------------------------

def _gtts_generate(text: str, out_path: str) -> bool:
    """Generate speech with gTTS. Returns True on success."""
    try:
        from gtts import gTTS  # type: ignore
        tts = gTTS(text=text, lang="en", slow=False)
        tts.save(out_path)
        return True
    except ImportError:
        logger.error("gtts not installed — run: pip install gtts")
        return False
    except Exception as e:
        logger.error("gTTS error: %s", e, exc_info=True)
        return False


# ---------------------------------------------------------------------------
# OpenAI TTS backend
# ---------------------------------------------------------------------------

def _openai_tts_generate(text: str, out_path: str) -> bool:
    """Generate speech with OpenAI TTS (tts-1 model). Returns True on success."""
    try:
        from openai import OpenAI  # type: ignore
        client = OpenAI(timeout=30.0)
        response = client.audio.speech.create(
            model="tts-1",
            voice="alloy",   # clear, neutral voice — good for education
            input=text,
        )
        response.stream_to_file(out_path)
        return True
    except ImportError:
        logger.error("openai not installed — run: pip install openai")
        return False
    except Exception as e:
        logger.error("OpenAI TTS error: %s", e, exc_info=True)
        return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_audio(
    narration_texts: list[str],
    output_dir: str,
    use_openai: bool = True,
) -> list[Optional[str]]:
    """
    Generate one .mp3 audio file per frame narration.

    Audio files are written to output_dir/audio/frame_{i:03d}.mp3.
    Skips generation if the file already exists (idempotent — safe to
    re-run generate_video without re-paying TTS costs).

    Args:
        narration_texts: per-frame narration strings (from parse_narration)
        output_dir:      session output directory
        use_openai:      if True, use OpenAI TTS instead of gTTS

    Returns:
        List of absolute .mp3 paths, one per frame.
        None entries indicate frames where TTS failed — caller uses
        estimate_duration() for timing fallback.
    """
    audio_dir = os.path.join(output_dir, "audio")
    os.makedirs(audio_dir, exist_ok=True)

    backend = _openai_tts_generate if use_openai else _gtts_generate
    paths: list[Optional[str]] = []

    for i, text in enumerate(narration_texts):
        out_path = os.path.join(audio_dir, f"frame_{i:03d}.mp3")

        if os.path.exists(out_path):
            # Already generated — skip (idempotent)
            paths.append(out_path)
            continue

        if not text:
            logger.warning("Frame %d: empty narration text — skipping audio", i)
            paths.append(None)
            continue

        logger.debug("Generating audio for frame %d  chars=%d  path=%s", i, len(text), out_path)
        success = backend(text, out_path)
        paths.append(out_path if success else None)
        if not success:
            logger.warning("Frame %d: TTS failed — video will use estimated duration", i)
        else:
            logger.debug("Audio generated  frame=%d  path=%s", i, out_path)

    return paths


# ---------------------------------------------------------------------------
# Parallel async version (used by the SSE video endpoint)
# ---------------------------------------------------------------------------

async def generate_audio_parallel(
    narration_texts: list[str],
    output_dir: str,
    use_openai: bool = True,
    progress_queue: asyncio.Queue | None = None,
) -> list[Optional[str]]:
    """
    Async, parallel version of generate_audio.

    All TTS calls fire concurrently — one asyncio.to_thread per frame — so a
    5-frame video takes as long as the *slowest* single frame instead of the
    *sum* of all frames.

    As each frame finishes its index is put into progress_queue (if provided)
    so the caller can stream per-frame progress events to the client without
    waiting for the full batch to complete.

    Args:
        narration_texts: per-frame narration strings (from parse_narration)
        output_dir:      session output directory
        use_openai:      True = OpenAI tts-1 model; False = gTTS (free)
        progress_queue:  optional asyncio.Queue; receives each frame's index
                         the moment that frame's audio is ready

    Returns:
        List of absolute .mp3 paths, one per frame.
        None entries = TTS failed or narration was empty for that frame.
    """
    audio_dir = os.path.join(output_dir, "audio")
    os.makedirs(audio_dir, exist_ok=True)

    backend = _openai_tts_generate if use_openai else _gtts_generate
    results: list[Optional[str]] = [None] * len(narration_texts)

    async def _one(i: int, text: str) -> None:
        out_path = os.path.join(audio_dir, f"frame_{i:03d}.mp3")

        if os.path.exists(out_path):
            # Already cached from a previous run — skip the API call
            results[i] = out_path
        elif not text:
            logger.warning("Frame %d: empty narration — skipping audio", i)
            results[i] = None
        else:
            logger.debug("TTS frame %d  chars=%d", i, len(text))
            # Run the blocking HTTP call in a thread so other frames
            # can proceed concurrently on the event loop
            ok = await asyncio.to_thread(backend, text, out_path)
            results[i] = out_path if ok else None
            if not ok:
                logger.warning("Frame %d: TTS failed — video will use estimated duration", i)

        # Signal the SSE stream that this frame is done
        if progress_queue is not None:
            await progress_queue.put(i)

    # Fire all frames at the same time
    await asyncio.gather(*[_one(i, text) for i, text in enumerate(narration_texts)])
    return results
