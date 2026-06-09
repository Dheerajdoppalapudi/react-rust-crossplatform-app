"""
Video Assembler — stitches frame images/clips + audio into a final .mp4.

Replaces the MoviePy implementation with direct ffmpeg subprocess calls.

Why: MoviePy pumps every output frame through Python → Unix pipe → ffmpeg,
which means ~3 GB of raw pixel data flowing through Python for a 3-frame
1920×1080 video.  Calling ffmpeg directly bypasses Python entirely — the
encoder reads PNGs and audio natively, cutting assembly from ~60s to ~3–5s.

Pipeline:
  1. Per frame: build an intermediate clip (PNG → looped video, or MP4 trim/pad)
  2. Write an ffmpeg concat list
  3. Concat all clips with -c copy  (no re-encode, extremely fast)
  4. Clean up temp files

Supports two frame types:
  PNG  → static image held for audio duration   (-loop 1 -t <dur>)
  MP4  → Manim animation padded/trimmed to audio length

Final output: 1920×1080, 24 fps, H.264 + AAC.

Requires: ffmpeg in system PATH  (already required by MoviePy)
"""

import structlog
import os
import re
import shutil
import subprocess
import tempfile
from typing import Optional

from services.video_generation.tts_service import estimate_duration

logger = structlog.get_logger(__name__)

VIDEO_W    = 1920
VIDEO_H    = 1080
VIDEO_FPS  = 60    # Manim -qh renders at 1080p60; match it to avoid frame duplication

# Letterbox: fit content into 1920×1080 preserving its aspect ratio, padding the
# remainder with black. Replaces a bare `scale=1920:1080`, which stretched any
# non-16:9 source (SVG frames have variable viewBox heights) into distortion.
_SCALE_PAD = (
    f"scale={VIDEO_W}:{VIDEO_H}:force_original_aspect_ratio=decrease,"
    f"pad={VIDEO_W}:{VIDEO_H}:(ow-iw)/2:(oh-ih)/2:color=black"
)

# Font candidates for Manim subtitle drawtext (same list as frame_exporter)
_FONT_CANDIDATES = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


# ---------------------------------------------------------------------------
# ffmpeg helpers
# ---------------------------------------------------------------------------

def _get_ffmpeg_exe() -> Optional[str]:
    """
    Locate the ffmpeg binary, trying two sources in order:

    1. System PATH  — present on most Linux servers ('ffmpeg' command).
    2. imageio-ffmpeg bundle — installed automatically with MoviePy via pip.
       This is the binary MoviePy itself has always used, so it is always
       available in environments where MoviePy was installed even if ffmpeg
       is not on the system PATH.

    Returns the executable path/name, or None if neither source works.
    """
    # 1. System ffmpeg
    if shutil.which("ffmpeg"):
        return "ffmpeg"
    # 2. imageio-ffmpeg bundled binary (ships with moviepy)
    try:
        import imageio_ffmpeg  # type: ignore
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


# Resolved once at import time so every _ffmpeg() call uses the same binary.
_FFMPEG_EXE: Optional[str] = _get_ffmpeg_exe()


def _ffmpeg(args: list[str]) -> None:
    """
    Run ffmpeg with the given arguments, raising RuntimeError on failure.

    -y           overwrite output without asking
    -hide_banner suppress the version/config banner
    -loglevel error  only print errors (keeps logs clean)
    """
    if not _FFMPEG_EXE:
        raise RuntimeError("ffmpeg not found — install ffmpeg or pip install imageio-ffmpeg")
    cmd = [_FFMPEG_EXE, "-y", "-hide_banner", "-loglevel", "error"] + args
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"ffmpeg timed out after 120s — cmd: {' '.join(args[:6])}")
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed (exit {result.returncode}):\n{result.stderr.strip()}")


def _find_ffprobe() -> Optional[str]:
    """
    Locate a real ffprobe binary.

    NOTE: imageio-ffmpeg (our usual ffmpeg source) bundles ffmpeg ONLY — there is
    no ffprobe beside it, so the old `_FFMPEG_EXE.replace("ffmpeg","ffprobe")`
    pointed at a non-existent file and every probe silently returned None. That is
    what truncated narration: durations fell back to the planner's *guess* instead
    of the real audio length. We now look for ffprobe properly and, failing that,
    fall back to parsing `ffmpeg -i` (which we always have).
    """
    probe = shutil.which("ffprobe")
    if probe:
        return probe
    if _FFMPEG_EXE:
        cand = _FFMPEG_EXE.replace("ffmpeg", "ffprobe")
        if cand != _FFMPEG_EXE and os.path.exists(cand):
            return cand
    return None


_FFPROBE_EXE: Optional[str] = _find_ffprobe()


def _probe_duration(path: str) -> Optional[float]:
    """
    Return the media duration in seconds. Tries ffprobe first, then falls back to
    parsing the `Duration:` line from `ffmpeg -i`. Returns None only if the file
    is missing or both methods fail.
    """
    if not path or not os.path.exists(path):
        return None

    # 1. ffprobe (clean, machine-readable) — when a real one exists
    if _FFPROBE_EXE:
        try:
            result = subprocess.run(
                [
                    _FFPROBE_EXE, "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    path,
                ],
                capture_output=True, text=True, timeout=30,
            )
            val = result.stdout.strip()
            if val:
                return float(val)
        except Exception:
            pass

    # 2. Fallback: parse `ffmpeg -i <file>` stderr for "Duration: HH:MM:SS.ms"
    #    This needs no extra binary — imageio-ffmpeg's bundled ffmpeg works.
    if _FFMPEG_EXE:
        try:
            result = subprocess.run(
                [_FFMPEG_EXE, "-i", path],
                capture_output=True, text=True, timeout=30,
            )
            m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", result.stderr)
            if m:
                h, mnt, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
                return h * 3600 + mnt * 60 + s
        except Exception:
            pass

    return None


def _find_font() -> Optional[str]:
    """Return the first available system font path, or None."""
    for fp in _FONT_CANDIDATES:
        if os.path.exists(fp):
            return fp
    return None


def _escape_drawtext(text: str) -> str:
    """
    Escape special characters for ffmpeg's drawtext filter value.
    These characters have meaning in the filter graph syntax.
    """
    return (
        text
        .replace("\\", "\\\\")
        .replace("'",  "\\'")
        .replace(":",  "\\:")
        .replace("[",  "\\[")
        .replace("]",  "\\]")
        .replace(",",  "\\,")
    )


# ---------------------------------------------------------------------------
# Per-frame clip builders
# ---------------------------------------------------------------------------

def _build_png_clip(
    png_path: str,
    audio_path: Optional[str],
    duration: float,
    out_path: str,
) -> None:
    """
    Build a video clip from a static PNG + optional audio.

    Uses -loop 1 to hold the image for the full duration.
    -tune stillimage tells libx264 to optimise for static content.

    If no audio: inserts a silent AAC track so the clip has the same
    stream layout as audio clips — required for -c copy concat.
    """
    # Letterbox to 1920×1080 (no aspect distortion). Hard cuts between clips —
    # the previous per-clip fade-to-black produced a black flash on every frame.
    vf = _SCALE_PAD

    if audio_path and os.path.exists(audio_path):
        _ffmpeg([
            "-loop", "1", "-t", str(duration), "-i", png_path,
            "-i", audio_path,
            "-map", "0:v", "-map", "1:a",
            "-c:v", "libx264", "-preset", "fast", "-tune", "stillimage",
            "-pix_fmt", "yuv420p",
            "-vf", vf,
            "-r", str(VIDEO_FPS),
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            out_path,
        ])
    else:
        # Generate a silent audio stream so all clips are stream-consistent
        _ffmpeg([
            "-loop", "1", "-t", str(duration), "-i", png_path,
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-map", "0:v", "-map", "1:a",
            "-c:v", "libx264", "-preset", "fast", "-tune", "stillimage",
            "-pix_fmt", "yuv420p",
            "-vf", vf,
            "-r", str(VIDEO_FPS),
            "-c:a", "aac", "-b:a", "192k",
            "-t", str(duration),
            out_path,
        ])


def _build_video_clip(
    mp4_path: str,
    audio_path: Optional[str],
    fallback_duration: float,
    caption: str,
    out_path: str,
) -> None:
    """
    Build a clip from a Manim MP4 animation + optional audio.

    Duration logic — clip length = max(animation, narration) so NEITHER is cut:
      - animation shorter than audio → freeze last frame (tpad) until narration ends
      - animation longer  than audio → narration finishes, animation plays to its end

    Caption: rendered directly by ffmpeg's drawbox + drawtext filters,
    matching the subtitle bar style used by frame_exporter for PNG frames.
    """
    video_dur = _probe_duration(mp4_path) or fallback_duration
    audio_dur = (
        _probe_duration(audio_path)
        if audio_path and os.path.exists(audio_path)
        else None
    )
    # max() so a long narration is never truncated AND a long animation is never cut.
    target_dur = max(video_dur, audio_dur) if audio_dur else (video_dur or fallback_duration)

    # ── Build video filter chain ──────────────────────────────────────────────
    vf_parts = [_SCALE_PAD]

    if caption:
        font       = _find_font()
        bar_y      = VIDEO_H - 90
        escaped    = _escape_drawtext(caption)
        font_part  = f"fontfile={font}:" if font else ""
        vf_parts.append(
            f"drawbox=y={bar_y}:color=black@0.69:width=iw:height=90:t=fill"
        )
        vf_parts.append(
            f"drawtext={font_part}text='{escaped}'"
            f":fontsize=38:fontcolor=white"
            f":x=(w-tw)/2:y={bar_y}+(90-th)/2"
        )

    # Freeze the last animation frame to cover any remaining narration.
    if audio_dur and video_dur < audio_dur:
        freeze = round(audio_dur - video_dur, 3)
        vf_parts.append(f"tpad=stop_mode=clone:stop_duration={freeze}")

    # Hard cuts between clips (no fade-to-black flash on every beat).
    vf = ",".join(vf_parts)

    if audio_path and os.path.exists(audio_path):
        _ffmpeg([
            "-i", mp4_path,
            "-i", audio_path,
            "-map", "0:v", "-map", "1:a",
            "-vf", vf,
            "-c:v", "libx264", "-preset", "fast",
            "-pix_fmt", "yuv420p",
            "-r", str(VIDEO_FPS),
            "-c:a", "aac", "-b:a", "192k",
            "-t", str(target_dur),
            out_path,
        ])
    else:
        _ffmpeg([
            "-i", mp4_path,
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-map", "0:v", "-map", "1:a",
            "-vf", vf,
            "-c:v", "libx264", "-preset", "fast",
            "-pix_fmt", "yuv420p",
            "-r", str(VIDEO_FPS),
            "-c:a", "aac", "-b:a", "192k",
            "-t", str(target_dur),
            out_path,
        ])


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def assemble(
    frame_paths: list[str],
    audio_paths: list[Optional[str]],
    narration_texts: list[str],
    output_path: str,
    captions: Optional[list[str]] = None,
) -> str:
    """
    Assemble frame images/clips + audio into a final .mp4 using ffmpeg.

    Steps:
      1. Build one intermediate .mp4 clip per frame in a temp directory
      2. Write an ffmpeg concat list (plain text, one 'file' entry per clip)
      3. Concat with -c copy — no re-encode, just mux the streams together
      4. Remove temp directory

    The -c copy concat step is what makes this fast: ffmpeg copies the
    already-encoded H.264/AAC streams straight into the container without
    touching a single frame.

    Args:
        frame_paths:     Per-frame file paths (.png or .mp4). None = skip.
        audio_paths:     Per-frame .mp3 paths. None = silent audio for that frame.
        narration_texts: Per-frame narration (used as duration fallback).
        output_path:     Destination .mp4 path.
        captions:        Per-frame caption strings (Manim subtitle overlay only;
                         PNG captions are already burned in by frame_exporter).

    Returns:
        output_path
    """
    if not frame_paths:
        raise ValueError("No frames to assemble — frame_paths is empty")

    captions = captions or [""] * len(frame_paths)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    temp_dir = tempfile.mkdtemp(prefix="video_assemble_")
    logger.info("video_assemble_start", temp_dir=temp_dir)

    try:
        # ── Step 1: build one clip per frame (sequential) ────────────────────
        clip_paths: list[str] = []
        for i, (fp, ap, nr, cap) in enumerate(
            zip(frame_paths, audio_paths, narration_texts, captions)
        ):
            if not fp or not os.path.exists(fp):
                logger.warning("video_assemble_frame_missing", frame=i)
                continue
            clip_out     = os.path.join(temp_dir, f"clip_{i:03d}.mp4")
            fallback_dur = estimate_duration(nr)
            try:
                if fp.lower().endswith(".mp4"):
                    logger.debug("video_assemble_video_clip", frame=i, path=fp)
                    _build_video_clip(fp, ap, fallback_dur, cap, clip_out)
                else:
                    logger.debug("video_assemble_image_clip", frame=i, path=fp)
                    audio_dur = (
                        _probe_duration(ap)
                        if ap and os.path.exists(ap)
                        else None
                    )
                    _build_png_clip(fp, ap, audio_dur or fallback_dur, clip_out)
                clip_paths.append(clip_out)
            except Exception:
                logger.error("video_assemble_clip_failed", frame=i, exc_info=True)

        if not clip_paths:
            raise ValueError("All frames failed — no clips to concat")

        # ── Step 2: write concat list ─────────────────────────────────────────
        # ffmpeg concat demuxer format: one "file '<path>'" line per clip
        concat_list = os.path.join(temp_dir, "concat.txt")
        with open(concat_list, "w") as f:
            for cp in clip_paths:
                f.write(f"file '{cp}'\n")

        # ── Step 3: stream-copy concat (no re-encode) ─────────────────────────
        # All clips share the same codec/resolution/fps so -c copy is safe.
        # This step takes < 1s regardless of video length.
        logger.info("video_assemble_concat", clips=len(clip_paths), output=output_path)
        _ffmpeg([
            "-f", "concat", "-safe", "0", "-i", concat_list,
            "-c", "copy",
            output_path,
        ])

        logger.info("video_assemble_done", output=output_path)

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    return output_path


def moviepy_available() -> bool:
    """
    Return True if ffmpeg is available (system PATH or imageio-ffmpeg bundle).

    Kept as 'moviepy_available' for backward compatibility with main.py,
    which uses this as the video-generation feature flag.
    """
    return _FFMPEG_EXE is not None
