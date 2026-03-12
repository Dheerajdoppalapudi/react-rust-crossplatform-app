"""
Video Assembler — stitches frame images/clips + audio files into a final .mp4.

Supports two frame types:
  PNG  → static ImageClip with subtle Ken Burns zoom (1.0 → 1.02)
  MP4  → VideoFileClip (full Manim animation); if audio is longer than the
         animation, the last frame is frozen to fill the remaining duration.
         A subtitle caption bar is composited on top.

Pipeline per frame:
  1. Detect frame type (.mp4 vs .png)
  2. Set duration = audio duration (preferred) or text estimate
  3. For .mp4: freeze last frame if animation is shorter than audio
  4. For .mp4: composite a semi-transparent subtitle caption bar on top
  5. Attach narration audio
  6. Add 0.4s crossfade in/out to adjacent frames

Final output: 1920×1080, 24 fps, H.264 video + AAC audio.

Requires: pip install moviepy  (version 2.x)
"""

import logging
import os
from typing import Optional

import numpy as np

from services.video.tts_service import estimate_duration

logger = logging.getLogger(__name__)

# Crossfade duration between consecutive frames (seconds)
FADE_DURATION = 0.4

# Output video settings
VIDEO_FPS = 24
VIDEO_CODEC = "libx264"
AUDIO_CODEC = "aac"

# Subtitle bar settings (must match frame_exporter for visual consistency)
_SUBTITLE_BAR_H = 90
_SUBTITLE_FONT_SIZE = 38
_FONT_CANDIDATES = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


def _make_subtitle_overlay(caption: str, video_w: int, video_h: int, duration: float):
    """
    Render a semi-transparent subtitle bar as a moviepy ImageClip overlay.

    Returns an ImageClip (RGBA) sized video_w × video_h, positioned at (0,0),
    with the caption centered in a dark bar at the bottom of the frame.
    The overlay is fully transparent except for the subtitle bar area.
    """
    from moviepy import ImageClip
    from PIL import Image, ImageDraw, ImageFont

    # Load best available font
    font = None
    for fp in _FONT_CANDIDATES:
        if os.path.exists(fp):
            try:
                from PIL import ImageFont as _IF
                font = _IF.truetype(fp, _SUBTITLE_FONT_SIZE)
                break
            except Exception:
                continue
    if font is None:
        from PIL import ImageFont as _IF
        font = _IF.load_default()

    # Create transparent overlay
    overlay = Image.new("RGBA", (video_w, video_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    bar_y = video_h - _SUBTITLE_BAR_H
    draw.rectangle([(0, bar_y), (video_w, video_h)], fill=(0, 0, 0, 175))

    bbox = draw.textbbox((0, 0), caption, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    text_x = (video_w - text_w) // 2
    text_y = bar_y + (_SUBTITLE_BAR_H - text_h) // 2 - bbox[1]
    draw.text((text_x, text_y), caption, fill=(255, 255, 255, 255), font=font)

    arr = np.array(overlay)   # shape: (H, W, 4) uint8
    return ImageClip(arr).with_duration(duration)


def _make_clip(
    frame_path: str,
    audio_path: Optional[str],
    duration: Optional[float],
    caption: str = "",
):
    """
    Build a single video clip for one frame.

    PNG frames:
      - Static ImageClip with Ken Burns zoom (1.0 → 1.02)
      - Duration = audio duration or text estimate
      - Subtitle already burned in by frame_exporter — no overlay added here

    MP4 frames (Manim animations):
      - Full VideoFileClip (plays the animation naturally)
      - If audio is longer than the animation, the last frame is frozen
        to fill the gap (audio always wins)
      - No Ken Burns (the animation already has motion)
      - Semi-transparent subtitle caption bar composited on top

    Returns a moviepy VideoClip ready for concatenation.
    """
    from moviepy import ImageClip, AudioFileClip, VideoFileClip, concatenate_videoclips, CompositeVideoClip

    # Determine target duration from audio
    if audio_path and os.path.exists(audio_path):
        audio_clip = AudioFileClip(audio_path)
        target_duration = audio_clip.duration
    else:
        audio_clip = None
        target_duration = duration or 5.0  # hard fallback

    is_video = frame_path.lower().endswith(".mp4")

    if is_video:
        base_clip = VideoFileClip(frame_path).resized((1920, 1080))
        anim_duration = base_clip.duration

        if anim_duration < target_duration:
            # Freeze last frame to fill the remaining time
            freeze_duration = target_duration - anim_duration
            last_frame = (
                ImageClip(base_clip.get_frame(anim_duration - 0.001))
                .with_duration(freeze_duration)
            )
            clip = concatenate_videoclips([base_clip, last_frame])
        else:
            # Animation is longer than audio — trim to audio length
            clip = base_clip.subclipped(0, target_duration)

        # Composite subtitle caption bar on top of the Manim animation
        if caption:
            subtitle = _make_subtitle_overlay(caption, 1920, 1080, clip.duration)
            clip = CompositeVideoClip([clip, subtitle])

    else:
        # Static PNG: apply Ken Burns zoom (1.0 → 1.02 over clip duration)
        # Subtitle was already burned in by frame_exporter — no overlay needed
        clip = ImageClip(frame_path).with_duration(target_duration)
        clip = clip.resized(lambda t: 1 + 0.02 * (t / target_duration))

    # Attach audio
    if audio_clip is not None:
        clip = clip.with_audio(audio_clip)

    return clip


def assemble(
    frame_paths: list[str],
    audio_paths: list[Optional[str]],
    narration_texts: list[str],
    output_path: str,
    captions: Optional[list[str]] = None,
) -> str:
    """
    Assemble frame images/clips + audio into a final .mp4 video.

    Args:
        frame_paths:     Per-frame paths — .png (SVG/Mermaid/placeholder) or
                         .mp4 (Manim animations). Mixed lists are supported.
        audio_paths:     Per-frame .mp3 paths (None = TTS failed for that frame).
        narration_texts: Per-frame narration strings (duration fallback when
                         audio_path is None).
        output_path:     Absolute path for the output .mp4 file.
        captions:        Per-frame caption strings used for subtitle overlay on
                         Manim .mp4 frames (optional; None = no subtitle overlay).

    Returns:
        output_path (the same value passed in).
    """
    from moviepy import concatenate_videoclips
    from moviepy.video.fx import CrossFadeIn, CrossFadeOut

    if not frame_paths:
        raise ValueError("No frames to assemble — frame_paths is empty")

    captions = captions or [""] * len(frame_paths)

    clips = []
    for i, (frame_path, audio_path, narration, caption) in enumerate(
        zip(frame_paths, audio_paths, narration_texts, captions)
    ):
        logger.debug("Building clip %d/%d  path=%s", i + 1, len(frame_paths), frame_path)
        fallback_duration = estimate_duration(narration)
        clip = _make_clip(frame_path, audio_path, fallback_duration, caption=caption)
        logger.debug("Clip %d duration=%.2fs", i + 1, clip.duration)

        # Apply crossfade transitions
        if i > 0:
            clip = clip.with_effects([CrossFadeIn(FADE_DURATION)])
        if i < len(frame_paths) - 1:
            clip = clip.with_effects([CrossFadeOut(FADE_DURATION)])

        clips.append(clip)

    # Concatenate with overlapping fades
    final = concatenate_videoclips(clips, padding=-FADE_DURATION, method="compose")
    logger.info("Concatenated %d clips  total_duration=%.2fs", len(clips), final.duration)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    final.write_videofile(
        output_path,
        fps=VIDEO_FPS,
        codec=VIDEO_CODEC,
        audio_codec=AUDIO_CODEC,
        logger=None,       # suppress verbose moviepy progress bars in API context
        temp_audiofile=output_path + ".temp_audio.m4a",
    )

    # Cleanup temp audio file if moviepy left it behind
    temp = output_path + ".temp_audio.m4a"
    if os.path.exists(temp):
        os.remove(temp)

    return output_path


def moviepy_available() -> bool:
    """Return True if moviepy 2.x is installed."""
    try:
        import moviepy  # noqa: F401
        return True
    except ImportError:
        return False
