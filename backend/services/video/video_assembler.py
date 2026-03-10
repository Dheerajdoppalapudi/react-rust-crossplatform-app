"""
Video Assembler — stitches frame images/clips + audio files into a final .mp4.

Supports two frame types:
  PNG  → static ImageClip with subtle Ken Burns zoom (1.0 → 1.02)
  MP4  → VideoFileClip (full Manim animation); if audio is longer than the
         animation, the last frame is frozen to fill the remaining duration.

Pipeline per frame:
  1. Detect frame type (.mp4 vs .png)
  2. Set duration = audio duration (preferred) or text estimate
  3. For .mp4: freeze last frame if animation is shorter than audio
  4. Attach narration audio
  5. Add 0.4s crossfade in/out to adjacent frames

Final output: 1920×1080, 24 fps, H.264 video + AAC audio.

Requires: pip install moviepy
"""

import os
from typing import Optional

from services.video.tts_service import estimate_duration

# Crossfade duration between consecutive frames (seconds)
FADE_DURATION = 0.4

# Output video settings
VIDEO_FPS = 24
VIDEO_CODEC = "libx264"
AUDIO_CODEC = "aac"


def _make_clip(frame_path: str, audio_path: Optional[str], duration: Optional[float]):
    """
    Build a single video clip for one frame.

    PNG frames:
      - Static ImageClip with Ken Burns zoom (1.0 → 1.02)
      - Duration = audio duration or text estimate

    MP4 frames (Manim animations):
      - Full VideoFileClip (plays the animation naturally)
      - If audio is longer than the animation, the last frame is frozen
        to fill the gap (audio always wins)
      - No Ken Burns (the animation already has motion)

    Returns a moviepy VideoClip ready for concatenation.
    """
    from moviepy.editor import ImageClip, AudioFileClip, VideoFileClip, concatenate_videoclips

    # Determine target duration from audio
    if audio_path and os.path.exists(audio_path):
        audio_clip = AudioFileClip(audio_path)
        target_duration = audio_clip.duration
    else:
        audio_clip = None
        target_duration = duration or 5.0  # hard fallback

    is_video = frame_path.lower().endswith(".mp4")

    if is_video:
        base_clip = VideoFileClip(frame_path).resize((1920, 1080))
        anim_duration = base_clip.duration

        if anim_duration < target_duration:
            # Freeze last frame to fill the remaining time
            freeze_duration = target_duration - anim_duration
            last_frame = ImageClip(base_clip.get_frame(anim_duration - 0.001)).set_duration(freeze_duration)
            clip = concatenate_videoclips([base_clip, last_frame])
        else:
            # Animation is longer than audio — trim to audio length
            clip = base_clip.subclip(0, target_duration)
    else:
        # Static PNG: apply Ken Burns zoom
        clip = ImageClip(frame_path).set_duration(target_duration)
        clip = clip.resize(lambda t: 1 + 0.02 * (t / target_duration))

    # Attach audio
    if audio_clip is not None:
        clip = clip.set_audio(audio_clip)

    return clip


def assemble(
    frame_paths: list[str],
    audio_paths: list[Optional[str]],
    narration_texts: list[str],
    output_path: str,
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

    Returns:
        output_path (the same value passed in).
    """
    from moviepy.editor import concatenate_videoclips

    if not frame_paths:
        raise ValueError("No frames to assemble — frame_paths is empty")

    clips = []
    for i, (frame_path, audio_path, narration) in enumerate(
        zip(frame_paths, audio_paths, narration_texts)
    ):
        fallback_duration = estimate_duration(narration)
        clip = _make_clip(frame_path, audio_path, fallback_duration)

        # Apply crossfade transitions
        if i > 0:
            clip = clip.crossfadein(FADE_DURATION)
        if i < len(frame_paths) - 1:
            clip = clip.crossfadeout(FADE_DURATION)

        clips.append(clip)

    # Concatenate with overlapping fades
    final = concatenate_videoclips(clips, padding=-FADE_DURATION, method="compose")

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
    """Return True if moviepy is installed."""
    try:
        import moviepy.editor  # noqa: F401
        return True
    except ImportError:
        return False
