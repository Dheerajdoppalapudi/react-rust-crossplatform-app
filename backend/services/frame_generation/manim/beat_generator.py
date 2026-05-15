"""
Beat generator — renders each beat and assembles into a final MP4.

For structural beats: fills a Python template (no LLM).
For visualization beats: calls the user's selected LLM to write Manim code,
  then renders it with the Manim CLI.

Up to BEAT_MAX_CONCURRENT_RENDERS renders run in parallel via asyncio.Semaphore.
Results stream back via async generator as each beat completes.
Failed beats are logged and skipped (mp4_path=None); no retries in the beat path.
"""

import ast
import asyncio
import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import AsyncGenerator, Optional

from core.config import (
    BEAT_MAX_CONCURRENT_RENDERS,
    BEAT_RENDER_TIMEOUT_S,
    BEAT_RENDER_QUALITY,
)
from services.frame_generation.planner import call_llm, _log
from services.frame_generation.manim.manim_generator import (
    _manim_cmd, _extract_code, _sanitize_manim_code,
    _classify_render_error, _extract_bad_name, _build_fallback_prompt,
)
from .beat_types import BeatPlan, BeatResult, BeatScript
from .beat_cache import get as cache_get, store as cache_store


def _get_ffmpeg_exe() -> Optional[str]:
    """Locate ffmpeg — system PATH first, then imageio-ffmpeg bundle."""
    if shutil.which("ffmpeg"):
        return "ffmpeg"
    try:
        import imageio_ffmpeg  # type: ignore
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


_FFMPEG_EXE: Optional[str] = _get_ffmpeg_exe()

from .template_filler import fill_template

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
_CODEGEN_PROMPT_TEMPLATE: str = (
    _PROMPTS_DIR / "manim_codegen_prompt.md"
).read_text(encoding="utf-8")

# Static prefix for Anthropic prompt caching — everything before {{BEAT_DESCRIPTION}}
_split_marker = "{{BEAT_DESCRIPTION}}"
_split_idx = _CODEGEN_PROMPT_TEMPLATE.find(_split_marker)
_STATIC_PREFIX = _CODEGEN_PROMPT_TEMPLATE[:_split_idx] if _split_idx != -1 else ""

_semaphore = asyncio.Semaphore(BEAT_MAX_CONCURRENT_RENDERS)


# ---------------------------------------------------------------------------
# Render helper (sync — run via asyncio.to_thread)
# ---------------------------------------------------------------------------

def _render_beat_sync(
    code: str,
    beat_index: int,
    output_dir: str,
) -> tuple[Optional[str], str]:
    """Write code to disk and run Manim. Returns (mp4_path_or_None, stderr)."""
    beat_dir = os.path.join(output_dir, f"beat_{beat_index}")
    os.makedirs(beat_dir, exist_ok=True)

    scene_file = os.path.join(beat_dir, "scene.py")
    with open(scene_file, "w", encoding="utf-8") as f:
        f.write(code)

    media_dir = os.path.join(beat_dir, "media")
    cmd = [
        _manim_cmd(), "render",
        BEAT_RENDER_QUALITY,
        "--media_dir", media_dir,
        scene_file,
        "GeneratedScene",
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=BEAT_RENDER_TIMEOUT_S,
        )
        if result.returncode != 0:
            logger.error(
                "beat_render_failed beat=%d\nSTDERR:\n%s",
                beat_index, result.stderr[-600:],
            )
            return None, result.stderr

        mp4s = list(Path(media_dir).rglob("*.mp4"))
        if not mp4s:
            logger.error(
                "beat_render_no_mp4 beat=%d media_dir=%s", beat_index, media_dir
            )
            return None, result.stderr

        best = str(max(mp4s, key=lambda p: p.stat().st_mtime))
        logger.info("beat_rendered beat=%d path=%s", beat_index, best)
        return best, ""

    except subprocess.TimeoutExpired:
        logger.error("beat_render_timeout beat=%d timeout_s=%d", beat_index, BEAT_RENDER_TIMEOUT_S)
        return None, "TimeoutExpired"
    except FileNotFoundError:
        logger.error("beat_render_manim_missing — run: pip install manim")
        return None, "FileNotFoundError: manim CLI missing"
    except Exception as exc:
        logger.error("beat_render_unexpected beat=%d error=%s", beat_index, exc, exc_info=True)
        return None, str(exc)


# ---------------------------------------------------------------------------
# Code-gen helper (sync, called via asyncio.to_thread)
# ---------------------------------------------------------------------------

def _codegen(beat_description: str, prompt_template: str) -> str:
    """One LLM call → raw Manim Python code string."""
    prompt = prompt_template.replace("{{BEAT_DESCRIPTION}}", beat_description)
    raw = call_llm(
        prompt,
        2800,
        "manim_codegen_prompt.md",
        _STATIC_PREFIX,
    )
    code = _extract_code(raw)
    code, fixes = _sanitize_manim_code(code)
    if fixes:
        logger.info("beat_sanitized fixes=%s", fixes)
    return code


def _is_valid_syntax(code: str) -> tuple[bool, str]:
    try:
        ast.parse(code)
        return True, ""
    except SyntaxError as e:
        return False, str(e)


# ---------------------------------------------------------------------------
# Single beat generation
# ---------------------------------------------------------------------------

async def _generate_one_beat(beat: BeatPlan, output_dir: str) -> BeatResult:
    # 1. Cache check — skip all LLM + render if we have a cached result
    cached_path = cache_get(beat)
    if cached_path:
        return BeatResult(
            beat_index=beat.index,
            mp4_path=cached_path,
            caption=beat.title,
            keywords=beat.keywords,
            narration=beat.narration,
            duration_s=beat.duration_s,
            render_method="cached",
            cache_hit=True,
        )

    async with _semaphore:
        # 2. Structural beats: fill template (no LLM)
        if beat.beat_class == "structural":
            code = fill_template(beat)
            method = "template"
            if code is None:
                _log({"event": "beat_template_failed", "index": beat.index,
                      "template_type": beat.template_type})
                return BeatResult(
                    beat_index=beat.index,
                    mp4_path=None,
                    caption=beat.title,
                    keywords=beat.keywords,
                    narration=beat.narration,
                    duration_s=beat.duration_s,
                    render_method="template",
                )
            # Templates don't go through retry — skip to render
            valid, _ = _is_valid_syntax(code)
            if not valid:
                return BeatResult(beat_index=beat.index, mp4_path=None,
                                  caption=beat.title, keywords=beat.keywords,
                                  narration=beat.narration, duration_s=beat.duration_s,
                                  render_method=method)
            mp4, stderr = await asyncio.to_thread(
                _render_beat_sync, code, beat.index, output_dir
            )
            if mp4:
                cache_store(beat, mp4)
            return BeatResult(beat_index=beat.index, mp4_path=mp4,
                              caption=beat.title, keywords=beat.keywords,
                              narration=beat.narration, duration_s=beat.duration_s,
                              render_method=method)

        # 3. Visualization beats: attempt 1
        method = "codegen"
        code = await asyncio.to_thread(_codegen, beat.description, _CODEGEN_PROMPT_TEMPLATE)

        valid, syn_err = _is_valid_syntax(code)
        if not valid:
            logger.warning("beat_syntax_error_attempt1 beat=%d err=%s — retrying", beat.index, syn_err)
            _log({"event": "beat_retry", "index": beat.index, "reason": f"syntax: {syn_err}"})
            retry_template = (
                f"⚠️ RETRY — previous attempt had a syntax error: {syn_err}\n"
                "Write simpler code: fewer objects, shorter animation sequences, no complex string formatting.\n\n"
            ) + _CODEGEN_PROMPT_TEMPLATE
            code = await asyncio.to_thread(_codegen, beat.description, retry_template)
            valid, syn_err2 = _is_valid_syntax(code)
            if not valid:
                logger.error("beat_syntax_error_attempt2 beat=%d err=%s — skipping", beat.index, syn_err2)
                _log({"event": "beat_failed", "index": beat.index, "reason": "syntax_after_retry"})
                return BeatResult(beat_index=beat.index, mp4_path=None,
                                  caption=beat.title, keywords=beat.keywords,
                                  narration=beat.narration, duration_s=beat.duration_s,
                                  render_method=method)

        # 4. Render attempt 1
        mp4, stderr = await asyncio.to_thread(
            _render_beat_sync, code, beat.index, output_dir
        )

        if mp4:
            cache_store(beat, mp4)
            return BeatResult(beat_index=beat.index, mp4_path=mp4,
                              caption=beat.title, keywords=beat.keywords,
                              narration=beat.narration, duration_s=beat.duration_s,
                              render_method=method)

        # 5. Render failed — classify error and retry with targeted hint
        error_cat = _classify_render_error(stderr)
        bad_name  = _extract_bad_name(stderr)
        logger.warning(
            "beat_render_failed_attempt1 beat=%d category=%s%s — retrying",
            beat.index, error_cat, f" bad={bad_name!r}" if bad_name else "",
        )
        _log({"event": "beat_retry", "index": beat.index,
              "reason": error_cat, "stderr": stderr[-300:]})

        retry_template = _build_fallback_prompt(_CODEGEN_PROMPT_TEMPLATE, error_cat, bad_name)
        code2 = await asyncio.to_thread(_codegen, beat.description, retry_template)

        valid2, syn_err3 = _is_valid_syntax(code2)
        if not valid2:
            logger.error("beat_syntax_error_retry beat=%d err=%s — skipping", beat.index, syn_err3)
            _log({"event": "beat_failed", "index": beat.index, "reason": "syntax_on_error_retry"})
            return BeatResult(beat_index=beat.index, mp4_path=None,
                              caption=beat.title, keywords=beat.keywords,
                              narration=beat.narration, duration_s=beat.duration_s,
                              render_method=method)

        mp4_2, _ = await asyncio.to_thread(
            _render_beat_sync, code2, beat.index, output_dir + "_retry"
        )

        if mp4_2:
            logger.info("beat_recovered_on_retry beat=%d category=%s", beat.index, error_cat)
            cache_store(beat, mp4_2)
        else:
            logger.error("beat_failed_both_attempts beat=%d category=%s", beat.index, error_cat)
            _log({"event": "beat_failed", "index": beat.index, "reason": "render_after_retry"})

        return BeatResult(beat_index=beat.index, mp4_path=mp4_2,
            caption=beat.title,
            keywords=beat.keywords,
            narration=beat.narration,
            duration_s=beat.duration_s,
            render_method=method,
        )


# ---------------------------------------------------------------------------
# Public API: stream results as each beat completes
# ---------------------------------------------------------------------------

class BeatGenerator:
    async def generate_beats(
        self, script: BeatScript, output_dir: str
    ) -> AsyncGenerator[BeatResult, None]:
        """
        Yields BeatResult for each beat as it finishes (order not guaranteed).
        Caller should sort by beat_index after collecting all results.
        """
        os.makedirs(output_dir, exist_ok=True)
        tasks = [
            asyncio.create_task(_generate_one_beat(b, output_dir))
            for b in script.beats
        ]
        for completed in asyncio.as_completed(tasks):
            yield await completed


# ---------------------------------------------------------------------------
# Audio: TTS + mix per beat
# ---------------------------------------------------------------------------

from services.video_generation.video_assembler import _probe_duration


def _mix_audio_into_video(
    video_path: str,
    audio_path: str,
    output_path: str,
) -> Optional[str]:
    """
    Mix a narration audio file into a silent Manim MP4.

    - If audio is shorter than video: pad audio with silence so the video
      continues playing quietly after the narration ends.
    - If audio is longer than video: freeze the last video frame so the
      narration completes rather than being cut off mid-sentence.

    Returns output_path on success, None on failure.
    """
    if not _FFMPEG_EXE:
        logger.error("beat_mix_no_ffmpeg")
        return None

    video_dur = _probe_duration(video_path)
    audio_dur = _probe_duration(audio_path)

    if video_dur is None or audio_dur is None:
        logger.error("beat_mix_probe_failed video=%s audio=%s", video_path, audio_path)
        return None

    try:
        if audio_dur > video_dur + 0.3:
            # Audio is longer — freeze last frame to let narration finish
            extra = audio_dur - video_dur
            cmd = [
                _FFMPEG_EXE, "-y", "-hide_banner", "-loglevel", "error",
                "-i", video_path,
                "-i", audio_path,
                "-filter_complex",
                f"[0:v]tpad=stop_mode=clone:stop_duration={extra:.3f}[vout]",
                "-map", "[vout]",
                "-map", "1:a",
                "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                "-c:a", "aac", "-b:a", "128k",
                output_path,
            ]
        else:
            # Audio is shorter or equal — pad audio with silence, copy video stream
            cmd = [
                _FFMPEG_EXE, "-y", "-hide_banner", "-loglevel", "error",
                "-i", video_path,
                "-i", audio_path,
                "-filter_complex", "[1:a]apad[apadded]",
                "-map", "0:v",
                "-map", "[apadded]",
                "-c:v", "copy",
                "-c:a", "aac", "-b:a", "128k",
                "-shortest",
                output_path,
            ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            logger.error("beat_mix_failed video=%s\nSTDERR: %s",
                         video_path, result.stderr[-400:])
            return None
        return output_path

    except subprocess.TimeoutExpired:
        logger.error("beat_mix_timeout video=%s", video_path)
        return None
    except Exception as exc:
        logger.error("beat_mix_error error=%s", exc, exc_info=True)
        return None


async def _add_audio_to_one_beat(
    result: BeatResult,
    audio_dir: str,
    use_openai: bool,
) -> str:
    """
    Generate TTS for one beat and mix into its MP4.
    Returns path to the audio+video MP4, or the original silent MP4 on any failure.
    """
    from services.video_generation.tts_service import (
        _openai_tts_generate, _gtts_generate,
    )

    silent_mp4 = result.mp4_path
    if not result.narration.strip():
        return silent_mp4

    audio_path = os.path.join(audio_dir, f"beat_{result.beat_index:03d}.mp3")
    mixed_path = os.path.join(audio_dir, f"beat_{result.beat_index:03d}_av.mp4")

    # TTS (idempotent — skip if already generated)
    if not os.path.exists(audio_path):
        backend = _openai_tts_generate if use_openai else _gtts_generate
        ok = await asyncio.to_thread(backend, result.narration, audio_path)
        if not ok:
            logger.warning("beat_tts_failed beat=%d — keeping silent", result.beat_index)
            return silent_mp4

    mixed = await asyncio.to_thread(
        _mix_audio_into_video, silent_mp4, audio_path, mixed_path
    )
    if mixed is None:
        logger.warning("beat_mix_failed beat=%d — keeping silent", result.beat_index)
        return silent_mp4

    logger.info("beat_audio_done beat=%d", result.beat_index)
    return mixed


async def add_audio_to_beats(
    results: list[BeatResult],
    output_dir: str,
    use_openai: bool = False,
) -> list[str]:
    """
    Run TTS + audio mix concurrently for all beats that have an mp4 and narration.
    Returns a list of mp4 paths (with audio where possible), in the same order
    as the input results list (only beats with mp4_path included).

    Failures are silent — each beat falls back to its original silent MP4
    so the assembled video is never blocked by a TTS error.
    """
    audio_dir = os.path.join(output_dir, "audio")
    os.makedirs(audio_dir, exist_ok=True)

    successful = [r for r in results if r.mp4_path]
    if not successful:
        return []

    mixed = await asyncio.gather(
        *[_add_audio_to_one_beat(r, audio_dir, use_openai) for r in successful],
        return_exceptions=True,
    )

    paths: list[str] = []
    for r, outcome in zip(successful, mixed):
        if isinstance(outcome, Exception):
            logger.warning("beat_audio_exception beat=%d error=%s", r.beat_index, outcome)
            paths.append(r.mp4_path)  # fallback to silent
        else:
            paths.append(outcome)
    return paths


# ---------------------------------------------------------------------------
# ffmpeg assembly
# ---------------------------------------------------------------------------

async def assemble_beats(beat_mp4s: list[str], output_path: str) -> Optional[str]:
    """
    Concatenate beat MP4s (in given order) into one session MP4 via ffmpeg.
    Returns output_path on success, None on failure.
    """
    if not beat_mp4s:
        logger.error("assemble_beats no mp4s to concat")
        return None

    ffmpeg = _FFMPEG_EXE
    if not ffmpeg:
        logger.error("assemble_beats ffmpeg not found — install ffmpeg or pip install imageio-ffmpeg")
        return None

    concat_list = output_path.replace(".mp4", "_list.txt")
    with open(concat_list, "w", encoding="utf-8") as f:
        for p in beat_mp4s:
            f.write(f"file '{p}'\n")

    cmd = [
        ffmpeg, "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_list,
        # Re-encode so mixed streams (copy vs libx264) concat cleanly.
        # fast preset + crf 22 keeps quality high at ~2× real-time speed.
        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        output_path,
    ]

    def _run():
        return subprocess.run(
            cmd, capture_output=True, text=True, timeout=120
        )

    try:
        result = await asyncio.to_thread(_run)
        if result.returncode != 0:
            logger.error("assemble_beats ffmpeg failed\nSTDERR:\n%s", result.stderr[-400:])
            return None
        logger.info("assemble_beats done  output=%s", output_path)
        return output_path
    except subprocess.TimeoutExpired:
        logger.error("assemble_beats ffmpeg timeout")
        return None
    except Exception as exc:
        logger.error("assemble_beats unexpected error=%s", exc, exc_info=True)
        return None
