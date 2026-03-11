"""
Frame Exporter — normalizes any session's frame output into a list of
1920×1080 PNGs with subtitle overlays, ready for video assembly.

Handles two input cases:
  1. PNG paths already exist (SVG / Manim paths) — resize + letterbox
  2. No PNGs (Mermaid / Slim JSON paths) — generate a clean caption
     placeholder card using Pillow (Phase 2 will use Playwright for proper
     Excalidraw rendering)

Every output frame is a 1920×1080 RGB PNG saved inside output_dir/video_frames/.
Subtitle (caption text) is burned as a semi-transparent bar at the bottom.
"""

import json
import os
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

# Target video resolution
VIDEO_W = 1920
VIDEO_H = 1080

# Subtitle bar height at the bottom (pixels)
SUBTITLE_BAR_H = 90

# Font size for subtitle text
SUBTITLE_FONT_SIZE = 38

# Fallback caption card background color (light gray)
PLACEHOLDER_BG = (245, 245, 245)
PLACEHOLDER_TEXT_COLOR = (30, 30, 30)

# Font search paths — tried in order, first found wins
_FONT_CANDIDATES = [
    "/System/Library/Fonts/Helvetica.ttc",          # macOS
    "/Library/Fonts/Arial.ttf",                      # macOS alt
    "/System/Library/Fonts/Supplemental/Arial.ttf",  # macOS Ventura+
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",       # Linux
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", # Linux alt
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",         # Linux fallback
]


def _load_font(size: int) -> ImageFont.FreeTypeFont:
    """Load the best available TrueType font at the given size."""
    for path in _FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _letterbox(img: Image.Image) -> Image.Image:
    """
    Fit img inside a 1920×1080 white canvas while preserving aspect ratio.

    If the image is already 1920×1080, it is returned as-is.
    Smaller or differently-sized images are scaled up or down to fill the
    height or width, then centered on a white background.
    """
    if img.width == VIDEO_W and img.height == VIDEO_H:
        return img.convert("RGB")

    scale = min(VIDEO_W / img.width, VIDEO_H / img.height)
    new_w = int(img.width * scale)
    new_h = int(img.height * scale)
    resized = img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGB", (VIDEO_W, VIDEO_H), (255, 255, 255))
    offset_x = (VIDEO_W - new_w) // 2
    offset_y = (VIDEO_H - new_h) // 2
    canvas.paste(resized.convert("RGB"), (offset_x, offset_y))
    return canvas


def _add_subtitle(img: Image.Image, caption: str) -> Image.Image:
    """
    Burn the caption as a subtitle bar at the bottom of the image.

    A semi-transparent dark rectangle is drawn over the last SUBTITLE_BAR_H
    pixels, then white caption text is centered inside it.

    The composite is returned as a new RGB image (no transparency in output).
    """
    rgba = img.convert("RGBA")
    overlay = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    bar_y = VIDEO_H - SUBTITLE_BAR_H
    draw.rectangle([(0, bar_y), (VIDEO_W, VIDEO_H)], fill=(0, 0, 0, 175))

    font = _load_font(SUBTITLE_FONT_SIZE)
    bbox = draw.textbbox((0, 0), caption, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    text_x = (VIDEO_W - text_w) // 2
    text_y = bar_y + (SUBTITLE_BAR_H - text_h) // 2 - bbox[1]
    draw.text((text_x, text_y), caption, fill=(255, 255, 255, 255), font=font)

    composite = Image.alpha_composite(rgba, overlay)
    return composite.convert("RGB")


def _make_placeholder(caption: str, frame_index: int) -> Image.Image:
    """
    Generate a clean 1920×1080 placeholder card for frames that have no PNG.

    Used when the session was rendered via the Mermaid or Slim JSON path,
    which produces Excalidraw JSON instead of PNGs.  The card shows the
    frame number and caption in a clean, legible layout.
    """
    img = Image.new("RGB", (VIDEO_W, VIDEO_H), PLACEHOLDER_BG)
    draw = ImageDraw.Draw(img)

    title_font = _load_font(56)
    body_font = _load_font(36)

    # Light border rectangle
    draw.rectangle([(60, 60), (VIDEO_W - 60, VIDEO_H - 60)],
                   outline=(200, 200, 200), width=3)

    # Frame number
    label = f"Frame {frame_index + 1}"
    bbox = draw.textbbox((0, 0), label, font=title_font)
    lw = bbox[2] - bbox[0]
    draw.text(((VIDEO_W - lw) // 2, VIDEO_H // 2 - 80),
              label, fill=PLACEHOLDER_TEXT_COLOR, font=title_font)

    # Caption text
    bbox = draw.textbbox((0, 0), caption, font=body_font)
    cw = bbox[2] - bbox[0]
    draw.text(((VIDEO_W - cw) // 2, VIDEO_H // 2 + 20),
              caption, fill=(100, 100, 100), font=body_font)

    return img


def export_frames(
    output_dir: str,
    captions: list[str],
) -> list[str]:
    """
    Read frames.json from output_dir, normalize every frame to a 1920×1080 PNG
    with a subtitle bar, and write the results to output_dir/video_frames/.

    Args:
        output_dir: session output directory (contains frames.json + narration.txt)
        captions:   per-frame caption strings (used for subtitles + placeholders)

    Returns:
        List of absolute paths to the normalized PNG files, one per frame,
        in frame order.  Every entry is guaranteed to be a valid PNG file.
    """
    frames_json_path = os.path.join(output_dir, "frames.json")
    if os.path.exists(frames_json_path):
        with open(frames_json_path) as f:
            frames_data = json.load(f)
        png_paths: list[Optional[str]] = frames_data.get("images", [])
    else:
        # No frames.json — all frames are placeholders
        frame_count = len(captions)
        png_paths = [None] * frame_count

    video_frames_dir = os.path.join(output_dir, "video_frames")
    os.makedirs(video_frames_dir, exist_ok=True)

    output_paths = []
    for i, (src_path, caption) in enumerate(zip(png_paths, captions)):
        out_path = os.path.join(video_frames_dir, f"frame_{i:03d}.png")

        # MP4 frames (Manim animations) are passed through directly —
        # the video assembler handles them as VideoFileClip.
        # Letterboxing and subtitle burning are skipped for video frames.
        if src_path and src_path.lower().endswith(".mp4") and os.path.exists(src_path):
            output_paths.append(src_path)
            continue

        if src_path and os.path.exists(src_path):
            img = Image.open(src_path)
        else:
            if src_path:
                print(f"[frame_exporter] Frame {i}: PNG not found at {src_path} — using placeholder")
            img = _make_placeholder(caption, i)

        img = _letterbox(img)
        img = _add_subtitle(img, caption)
        img.save(out_path, "PNG")
        output_paths.append(out_path)

    return output_paths
