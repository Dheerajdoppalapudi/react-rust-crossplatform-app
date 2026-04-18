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

import logging
import os
import shutil
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

from services.video.tts_service import estimate_duration

logger = logging.getLogger(__name__)

VIDEO_W    = 1920
VIDEO_H    = 1080
VIDEO_FPS  = 60    # Manim -qh renders at 1080p60; match it to avoid frame duplication
_FADE_DUR  = 0.3   # seconds — fade-through-black between frames

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
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed (exit {result.returncode}):\n{result.stderr.strip()}")


def _probe_duration(path: str) -> Optional[float]:
    """
    Return the media duration in seconds using ffprobe (or ffmpeg -i as fallback).
    Returns None if the file is missing or the probe fails.
    """
    if not _FFMPEG_EXE:
        return None
    # Derive ffprobe path from the ffmpeg binary location
    ffprobe = _FFMPEG_EXE.replace("ffmpeg", "ffprobe")
    try:
        result = subprocess.run(
            [
                ffprobe, "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                path,
            ],
            capture_output=True,
            text=True,
        )
        return float(result.stdout.strip())
    except Exception:
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
    # Fade-through-black: fade in at start, fade out at end
    fade_out_start = max(0.0, duration - _FADE_DUR)
    vf = (
        f"scale={VIDEO_W}:{VIDEO_H},"
        f"fade=t=in:st=0:d={_FADE_DUR},"
        f"fade=t=out:st={fade_out_start:.3f}:d={_FADE_DUR}"
    )

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

    Duration logic (audio always wins):
      - animation shorter than audio → pad last frame with tpad filter
      - animation longer  than audio → trim with -t

    Caption: rendered directly by ffmpeg's drawbox + drawtext filters,
    matching the subtitle bar style used by frame_exporter for PNG frames.
    """
    video_dur = _probe_duration(mp4_path) or fallback_duration
    audio_dur = (
        _probe_duration(audio_path)
        if audio_path and os.path.exists(audio_path)
        else None
    )
    target_dur = audio_dur or fallback_duration

    # ── Build video filter chain ──────────────────────────────────────────────
    vf_parts = [f"scale={VIDEO_W}:{VIDEO_H}"]

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

    # tpad must come before fade filters (pads in the time dimension first)
    if audio_dur and video_dur < audio_dur:
        freeze = round(audio_dur - video_dur, 3)
        vf_parts.append(f"tpad=stop_mode=clone:stop_duration={freeze}")

    # Fade-through-black: in at start, out at end (matching PNG clip behaviour)
    fade_out_start = max(0.0, target_dur - _FADE_DUR)
    vf_parts.append(f"fade=t=in:st=0:d={_FADE_DUR}")
    vf_parts.append(f"fade=t=out:st={fade_out_start:.3f}:d={_FADE_DUR}")

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
# Per-clip builder (called in parallel by assemble())
# ---------------------------------------------------------------------------

# Max number of ffmpeg processes running simultaneously.
# Each ffmpeg process spawns its own threads internally; keeping this at 4
# avoids saturating CPU/IO while still cutting wall-clock time by 3-4×.
_MAX_CLIP_WORKERS = 4


def _build_one_clip(
    index: int,
    frame_path: str,
    audio_path: Optional[str],
    narration: str,
    caption: str,
    temp_dir: str,
) -> tuple[int, str]:
    """
    Build one intermediate clip (.mp4) for a single frame.
    Returns (index, clip_out_path) on success; raises on failure.
    Called from a ThreadPoolExecutor — must be fully thread-safe (it is,
    since each call writes to a unique path and spawns its own subprocess).
    """
    clip_out     = os.path.join(temp_dir, f"clip_{index:03d}.mp4")
    fallback_dur = estimate_duration(narration)

    if frame_path.lower().endswith(".mp4"):
        logger.debug("Building video clip %d  path=%s", index, frame_path)
        _build_video_clip(frame_path, audio_path, fallback_dur, caption, clip_out)
    else:
        logger.debug("Building image clip %d  path=%s", index, frame_path)
        audio_dur = (
            _probe_duration(audio_path)
            if audio_path and os.path.exists(audio_path)
            else None
        )
        _build_png_clip(frame_path, audio_path, audio_dur or fallback_dur, clip_out)

    return index, clip_out


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
    logger.info("Assembly temp dir: %s", temp_dir)

    try:
        # ── Step 1: build one clip per frame (in parallel) ────────────────────
        # Filter out missing frames first so we don't submit no-op futures.
        valid_frames = [
            (i, fp, ap, nr, cap)
            for i, (fp, ap, nr, cap) in enumerate(
                zip(frame_paths, audio_paths, narration_texts, captions)
            )
            if fp and os.path.exists(fp)
        ]
        skipped = len(frame_paths) - len(valid_frames)
        if skipped:
            logger.warning("%d frame path(s) missing — skipping", skipped)

        # clip_results maps index → clip_path so we can reassemble in order
        # after parallel execution completes.
        clip_results: dict[int, str] = {}
        workers = min(_MAX_CLIP_WORKERS, len(valid_frames)) if valid_frames else 1

        with ThreadPoolExecutor(max_workers=workers) as pool:
            future_to_idx = {
                pool.submit(_build_one_clip, i, fp, ap, nr, cap, temp_dir): i
                for i, fp, ap, nr, cap in valid_frames
            }
            for future in as_completed(future_to_idx):
                i = future_to_idx[future]
                try:
                    idx, clip_out = future.result()
                    clip_results[idx] = clip_out
                    logger.debug("Clip %d ready  path=%s", idx, clip_out)
                except Exception:
                    logger.error("Failed to build clip %d — skipping", i, exc_info=True)

        # Reconstruct clip list in original frame order
        clip_paths = [clip_results[i] for i in sorted(clip_results)]

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
        logger.info("Concatenating %d clips → %s", len(clip_paths), output_path)
        _ffmpeg([
            "-f", "concat", "-safe", "0", "-i", concat_list,
            "-c", "copy",
            output_path,
        ])

        logger.info("Assembly complete  output=%s", output_path)

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
