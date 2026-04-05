"""
Slide Generator — produces 1920×1080 Pillow PNGs for chapter intro and text slides.

No LLM calls. No external dependencies beyond Pillow (already used by frame_exporter.py).

Two slide types:
  chapter_intro — cinematic section opener with chapter number + title + subtitle.
  text_slide    — informational slide in two sub-layouts:
    standard    — heading + bulleted list with optional [[hl:...]] highlights
    split       — two-column comparison (left label+bullets, right label+bullets)

Style variety:
  4 named style presets per slide type. The style for a session is picked by
  hashing the accent_color string → style_index = hash % 4.
  Because different topic types get different accent colors from the planner
  (blue=technical, yellow=educational, purple=analogy, green=science), different
  topic categories naturally land on different styles. Regenerating the same topic
  gives the same style (deterministic, feels intentional).

  chapter_intro styles: number_left, centered_dark, full_accent, minimal_stripe
  text_slide styles:    clean_bars, dark_header, minimal_left, card_on_gray

Rich text markup:
  Wrap key phrases in [[hl:phrase]] in bullet text. The renderer draws a rounded
  colored highlight rectangle behind those words.

Public API:
  generate_slide(slide_spec: dict, out_path: str) -> str
    Picks the style from slide_spec["accent_color"], dispatches to the right renderer.
    Returns out_path.

  generate_summary_slide(bullets, accent_color, out_path) -> str
    Convenience wrapper that generates a "Key Takeaways" text_slide.
"""

import hashlib
import logging
import os
import re

logger = logging.getLogger(__name__)

try:
    from PIL import Image, ImageDraw, ImageFont
    _PILLOW_AVAILABLE = True
except ImportError:
    _PILLOW_AVAILABLE = False

# ---------------------------------------------------------------------------
# Canvas
# ---------------------------------------------------------------------------

W, H = 1920, 1080

# ---------------------------------------------------------------------------
# Font resolution
# ---------------------------------------------------------------------------

_FONT_CANDIDATES = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
]


def _load_font(size: int):
    for path in _FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


# ---------------------------------------------------------------------------
# Color math
# ---------------------------------------------------------------------------

_WHITE  = (255, 255, 255)
_DARK   = (18,  18,  18)
_GRAY   = (110, 110, 110)
_LGRAY  = (215, 215, 215)
_BGRAY  = (240, 240, 240)


def _hex_to_rgb(hex_color: str) -> tuple:
    try:
        h = hex_color.lstrip("#")
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
    except Exception:
        return (165, 216, 255)


def _darken(rgb: tuple, factor: float = 0.30) -> tuple:
    return tuple(max(0, int(c * factor)) for c in rgb)


def _lighten(rgb: tuple, factor: float = 0.5) -> tuple:
    return tuple(min(255, int(c + (255 - c) * factor)) for c in rgb)


def _highlight_bg(rgb: tuple) -> tuple:
    return _lighten(rgb, 0.50)


def _near_black(rgb: tuple) -> tuple:
    """A very dark version of accent (for dark_header style backgrounds)."""
    return tuple(max(0, int(c * 0.18)) for c in rgb)


# ---------------------------------------------------------------------------
# Style picker — deterministic per accent_color
# ---------------------------------------------------------------------------

def _pick_style(accent_color: str) -> int:
    """
    Deterministically pick a style index 0–3 from the accent color.
    Same color → same style every time. Different colors → usually different styles.
    """
    digest = hashlib.md5(accent_color.strip().lower().encode()).hexdigest()
    return int(digest, 16) % 4


# ---------------------------------------------------------------------------
# Rich text helpers
# ---------------------------------------------------------------------------

_HL_RE = re.compile(r'\[\[hl:(.*?)\]\]')


def _strip_hl(text: str) -> str:
    return _HL_RE.sub(lambda m: m.group(1), text)


def _parse_rich(text: str) -> list:
    segments, last = [], 0
    for m in _HL_RE.finditer(text):
        if m.start() > last:
            segments.append((text[last:m.start()], False))
        segments.append((m.group(1), True))
        last = m.end()
    if last < len(text):
        segments.append((text[last:], False))
    return segments or [(text, False)]


def _measure(draw, text: str, font) -> tuple:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def _render_rich(draw, raw: str, x: int, y: int, font, accent_rgb: tuple,
                 text_color: tuple = None) -> int:
    """
    Render one rich-text line. Returns rendered width.
    text_color defaults to _DARK; highlighted spans use darken(accent) on lighten(accent) bg.
    """
    if text_color is None:
        text_color = _DARK
    hl_bg = _highlight_bg(accent_rgb)
    hl_fg = _darken(accent_rgb, 0.28)
    pad_x, pad_y = 9, 5
    cx = x

    for seg, is_hl in _parse_rich(raw):
        if not seg:
            continue
        tw, th = _measure(draw, seg, font)
        if is_hl:
            draw.rounded_rectangle([cx - pad_x, y - pad_y, cx + tw + pad_x, y + th + pad_y],
                                   radius=9, fill=hl_bg)
            draw.text((cx, y), seg, font=font, fill=hl_fg)
        else:
            draw.text((cx, y), seg, font=font, fill=text_color)
        cx += tw
    return cx - x


def _wrap_line(draw, text: str, font, max_w: int) -> list[str]:
    """Word-wrap `text` to fit within max_w. Returns list of lines."""
    plain = _strip_hl(text)
    tw, _ = _measure(draw, plain, font)
    if tw <= max_w:
        return [text]
    words = text.split()
    lines, cur = [], []
    for w in words:
        test = " ".join(cur + [w])
        pw, _ = _measure(draw, _strip_hl(test), font)
        if pw <= max_w or not cur:
            cur.append(w)
        else:
            lines.append(" ".join(cur))
            cur = [w]
    if cur:
        lines.append(" ".join(cur))
    return lines or [text]


# ---------------------------------------------------------------------------
# Gradient helper
# ---------------------------------------------------------------------------

def _gradient_bar(img, y0: int, y1: int, color_top: tuple, color_bot: tuple) -> None:
    draw = ImageDraw.Draw(img)
    h = max(1, y1 - y0)
    for row in range(h):
        t = row / h
        r = int(color_top[0] * (1 - t) + color_bot[0] * t)
        g = int(color_top[1] * (1 - t) + color_bot[1] * t)
        b = int(color_top[2] * (1 - t) + color_bot[2] * t)
        draw.line([(0, y0 + row), (W, y0 + row)], fill=(r, g, b))


# ---------------------------------------------------------------------------
# Bullet renderers (shared, style-aware)
# ---------------------------------------------------------------------------

def _render_bullets_standard(draw, bullets, font, accent_rgb, text_x, text_x_max, start_y,
                               row_gap, dot_x, text_color=None):
    """Circle-dot bullet list. Returns final y."""
    dot_r = 10
    y = start_y
    for bullet in bullets:
        draw.ellipse([dot_x - dot_r, y + 20 - dot_r, dot_x + dot_r, y + 20 + dot_r],
                     fill=accent_rgb)
        for line in _wrap_line(draw, bullet, font, text_x_max - text_x):
            _render_rich(draw, line, text_x, y, font, accent_rgb, text_color)
            _, lh = _measure(draw, "A", font)
            y += lh + 8
        y += row_gap - 18
    return y


def _render_bullets_dash(draw, bullets, font, accent_rgb, text_x, text_x_max, start_y,
                          row_gap, text_color=None):
    """Em-dash bullet list."""
    y = start_y
    dash_font = _load_font(font.size if hasattr(font, 'size') else 44)
    for bullet in bullets:
        draw.text((text_x, y), "—", font=dash_font, fill=accent_rgb)
        dw, _ = _measure(draw, "— ", dash_font)
        for line in _wrap_line(draw, bullet, font, text_x_max - text_x - dw):
            _render_rich(draw, line, text_x + dw, y, font, accent_rgb, text_color)
            _, lh = _measure(draw, "A", font)
            y += lh + 8
        y += row_gap - 18
    return y


def _render_bullets_numbered(draw, bullets, font, accent_rgb, text_x, text_x_max, start_y,
                               row_gap, text_color=None):
    """01 02 03 numbered bullet list."""
    y = start_y
    num_font = _load_font(int((font.size if hasattr(font, 'size') else 44) * 0.75))
    for i, bullet in enumerate(bullets):
        num_str = f"{i+1:02d}"
        nw, nh = _measure(draw, num_str, num_font)
        draw.text((text_x, y + 4), num_str, font=num_font, fill=accent_rgb)
        for line in _wrap_line(draw, bullet, font, text_x_max - text_x - nw - 24):
            _render_rich(draw, line, text_x + nw + 24, y, font, accent_rgb, text_color)
            _, lh = _measure(draw, "A", font)
            y += lh + 8
        y += row_gap - 18
    return y


# ---------------------------------------------------------------------------
# CHAPTER INTRO — 4 styles
# ---------------------------------------------------------------------------

def _chapter_intro_number_left(draw, img, number, title, subtitle, accent_rgb):
    """
    Style 0 — NUMBER LEFT
    Accent-colored background. Giant white chapter number left 38%.
    White rounded card right 62% with dark title + gray subtitle.
    Bottom gradient fade.
    """
    # Background already accent_rgb from Image.new
    left_right = 730

    # Number
    num_font = _load_font(280)
    nw, nh = _measure(draw, number, num_font)
    draw.text(((left_right - nw) // 2, (H - nh) // 2 - 20), number, font=num_font, fill=_WHITE)

    # Card
    cx0, cy0, cx1, cy1 = 760, 80, W - 60, H - 80
    draw.rounded_rectangle([cx0, cy0, cx1, cy1], radius=48, fill=_WHITE)
    ccx = (cx0 + cx1) // 2
    ccy = (cy0 + cy1) // 2
    cw  = cx1 - cx0 - 80

    t_font = _load_font(72)
    tw, th = _measure(draw, title, t_font)
    if tw > cw:
        words = title.split(); mid = len(words) // 2
        l1, l2 = " ".join(words[:mid]), " ".join(words[mid:])
        lw1, lh1 = _measure(draw, l1, t_font)
        lw2, lh2 = _measure(draw, l2, t_font)
        tot = lh1 + 12 + lh2
        ty  = ccy - tot // 2 - 40
        draw.text((ccx - lw1 // 2, ty), l1, font=t_font, fill=_DARK)
        draw.text((ccx - lw2 // 2, ty + lh1 + 12), l2, font=t_font, fill=_DARK)
        t_bot = ty + tot
    else:
        ty = ccy - th // 2 - 40
        draw.text((ccx - tw // 2, ty), title, font=t_font, fill=_DARK)
        t_bot = ty + th

    if subtitle:
        s_font = _load_font(40)
        sw, sh = _measure(draw, subtitle, s_font)
        if sw > cw:
            words = subtitle.split(); mid = len(words) // 2
            s1, s2 = " ".join(words[:mid]), " ".join(words[mid:])
            sw1, _ = _measure(draw, s1, s_font)
            sw2, sh2 = _measure(draw, s2, s_font)
            sy = t_bot + 36
            draw.text((ccx - sw1 // 2, sy), s1, font=s_font, fill=_GRAY)
            draw.text((ccx - sw2 // 2, sy + sh2 + 8), s2, font=s_font, fill=_GRAY)
        else:
            draw.text((ccx - sw // 2, t_bot + 36), subtitle, font=s_font, fill=_GRAY)

    _gradient_bar(img, H - 100, H, accent_rgb, _near_black(accent_rgb))


def _chapter_intro_centered_dark(draw, img, number, title, subtitle, accent_rgb):
    """
    Style 1 — CENTERED DARK
    Near-black background. Large accent-colored number centered at top third.
    White title and gray subtitle centered below it. Thin accent bottom border.
    """
    dark_bg = (14, 14, 14)
    img.paste(Image.new("RGB", (W, H), dark_bg))
    draw = ImageDraw.Draw(img)

    # Number — centered, accent color
    num_font = _load_font(240)
    nw, nh = _measure(draw, number, num_font)
    nx = (W - nw) // 2
    ny = 100
    draw.text((nx, ny), number, font=num_font, fill=accent_rgb)

    # Thin horizontal accent line below number
    line_y = ny + nh + 30
    draw.rectangle([W // 2 - 80, line_y, W // 2 + 80, line_y + 4], fill=accent_rgb)

    # Title
    t_font = _load_font(80)
    tw, th = _measure(draw, title, t_font)
    ty = line_y + 50
    if tw > W - 200:
        words = title.split(); mid = len(words) // 2
        l1, l2 = " ".join(words[:mid]), " ".join(words[mid:])
        lw1, lh1 = _measure(draw, l1, t_font)
        lw2, lh2 = _measure(draw, l2, t_font)
        draw.text(((W - lw1) // 2, ty), l1, font=t_font, fill=_WHITE)
        draw.text(((W - lw2) // 2, ty + lh1 + 10), l2, font=t_font, fill=_WHITE)
        t_bot = ty + lh1 + 10 + lh2
    else:
        draw.text(((W - tw) // 2, ty), title, font=t_font, fill=_WHITE)
        t_bot = ty + th

    if subtitle:
        s_font = _load_font(42)
        sw, sh = _measure(draw, subtitle, s_font)
        draw.text(((W - sw) // 2, t_bot + 30), subtitle, font=s_font, fill=_GRAY)

    # Bottom accent strip
    draw.rectangle([0, H - 8, W, H], fill=accent_rgb)


def _chapter_intro_full_accent(draw, img, number, title, subtitle, accent_rgb):
    """
    Style 2 — FULL ACCENT
    Accent bg fills the whole slide. No card.
    Number + title + subtitle stacked center-left in white.
    Large decorative circle outline on right for visual balance.
    """
    # Number — large, white, left-aligned
    num_font = _load_font(300)
    nw, nh = _measure(draw, number, num_font)
    nx = 120
    ny = (H - nh) // 2 - 80
    draw.text((nx, ny), number, font=num_font, fill=_WHITE)

    # Decorative large hollow circle on right
    cr = 360
    cx, cy = W - 300, H // 2
    draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr],
                 outline=(255, 255, 255, 0), width=0,
                 fill=_darken(accent_rgb, 0.82))

    # Title
    t_font = _load_font(76)
    tx = 140
    ty = ny + nh + 20
    for line in _wrap_line(draw, title, t_font, W // 2 - 160):
        tw, th = _measure(draw, line, t_font)
        draw.text((tx, ty), line, font=t_font, fill=_WHITE)
        ty += th + 10

    # Subtitle
    if subtitle:
        s_font = _load_font(40)
        for line in _wrap_line(draw, subtitle, s_font, W // 2 - 160):
            sw, sh = _measure(draw, line, s_font)
            # Slightly transparent — simulate by using a lighter white
            draw.text((tx, ty + 10), line, font=s_font, fill=(220, 220, 220))
            ty += sh + 8

    # Bottom gradient
    _gradient_bar(img, H - 80, H, accent_rgb, _near_black(accent_rgb))


def _chapter_intro_minimal_stripe(draw, img, number, title, subtitle, accent_rgb):
    """
    Style 3 — MINIMAL STRIPE
    White background. Bold 100px accent left stripe.
    Number in accent color (large), vertically centered in stripe.
    Title and subtitle right of stripe on white.
    Clean, high contrast.
    """
    img.paste(Image.new("RGB", (W, H), _WHITE))
    draw = ImageDraw.Draw(img)

    stripe_w = 100
    draw.rectangle([0, 0, stripe_w, H], fill=accent_rgb)

    # Number inside stripe — vertical centered, rotated feel via large font
    num_font = _load_font(72)
    nw, nh = _measure(draw, number, num_font)
    draw.text(((stripe_w - nw) // 2, (H - nh) // 2), number, font=num_font, fill=_WHITE)

    # Title right of stripe
    t_font = _load_font(88)
    tx = stripe_w + 80
    max_w = W - tx - 80
    ty = H // 2 - 100
    for line in _wrap_line(draw, title, t_font, max_w):
        tw, th = _measure(draw, line, t_font)
        draw.text((tx, ty), line, font=t_font, fill=_DARK)
        ty += th + 12

    # Accent underline below title
    draw.rectangle([tx, ty + 10, tx + 200, ty + 16], fill=accent_rgb)

    if subtitle:
        s_font = _load_font(40)
        for line in _wrap_line(draw, subtitle, s_font, max_w):
            sw, sh = _measure(draw, line, s_font)
            draw.text((tx, ty + 40), line, font=s_font, fill=_GRAY)
            ty += sh + 8


def generate_chapter_intro(number, title, subtitle, accent_color, out_path, style=None):
    if not _PILLOW_AVAILABLE:
        raise RuntimeError("Pillow not installed")

    accent_rgb = _hex_to_rgb(accent_color)
    if style is None:
        style = _pick_style(accent_color)

    img  = Image.new("RGB", (W, H), accent_rgb)
    draw = ImageDraw.Draw(img)

    if style == 0:
        _chapter_intro_number_left(draw, img, number, title, subtitle, accent_rgb)
    elif style == 1:
        _chapter_intro_centered_dark(draw, img, number, title, subtitle, accent_rgb)
    elif style == 2:
        _chapter_intro_full_accent(draw, img, number, title, subtitle, accent_rgb)
    else:
        _chapter_intro_minimal_stripe(draw, img, number, title, subtitle, accent_rgb)

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    img.save(out_path, "PNG")
    logger.info("Chapter intro  style=%d  path=%s", style, out_path)
    return out_path


# ---------------------------------------------------------------------------
# TEXT SLIDE STANDARD — 4 styles
# ---------------------------------------------------------------------------

def _text_std_clean_bars(draw, img, heading, bullets, accent_rgb):
    """Style 0 — CLEAN BARS: white bg, 8px accent bars top+bottom, circle dots."""
    draw.rectangle([0, 0, W, 8], fill=accent_rgb)
    draw.rectangle([0, H - 8, W, H], fill=accent_rgb)

    h_font = _load_font(64)
    hw, hh = _measure(draw, heading, h_font)
    draw.text(((W - hw) // 2, 90), heading, font=h_font, fill=_DARK)

    b_font = _load_font(44)
    _render_bullets_standard(draw, bullets, b_font, accent_rgb,
                              text_x=240, text_x_max=W - 80,
                              start_y=90 + hh + 70,
                              row_gap=88, dot_x=190)


def _text_std_dark_header(draw, img, heading, bullets, accent_rgb):
    """
    Style 1 — DARK HEADER
    Full-width dark header band (~180px) with white heading text.
    White body below, square accent bullets.
    """
    band_h = 180
    dark_band = _near_black(accent_rgb) if max(accent_rgb) > 60 else (28, 28, 28)
    draw.rectangle([0, 0, W, band_h], fill=dark_band)

    h_font = _load_font(68)
    hw, hh = _measure(draw, heading, h_font)
    draw.text(((W - hw) // 2, (band_h - hh) // 2), heading, font=h_font, fill=_WHITE)

    # Accent underline at bottom of band
    draw.rectangle([0, band_h - 6, W, band_h], fill=accent_rgb)

    # Bullets with square markers
    b_font   = _load_font(44)
    sq_size  = 14
    dot_x    = 190
    text_x   = 230
    y = band_h + 70

    for bullet in bullets:
        draw.rectangle([dot_x - sq_size // 2, y + 18 - sq_size // 2,
                        dot_x + sq_size // 2, y + 18 + sq_size // 2], fill=accent_rgb)
        for line in _wrap_line(draw, bullet, b_font, W - text_x - 80):
            _render_rich(draw, line, text_x, y, b_font, accent_rgb)
            _, lh = _measure(draw, "A", b_font)
            y += lh + 8
        y += 70


def _text_std_minimal_left(draw, img, heading, bullets, accent_rgb):
    """
    Style 2 — MINIMAL LEFT STRIPE
    White bg. Bold 80px accent left stripe. Content right-indented.
    Heading left-aligned with an accent underline. Em-dash bullets.
    """
    stripe_w = 80
    draw.rectangle([0, 0, stripe_w, H], fill=accent_rgb)

    h_font = _load_font(64)
    tx     = stripe_w + 80
    draw.text((tx, 90), heading, font=h_font, fill=_DARK)
    hw, hh = _measure(draw, heading, h_font)
    draw.rectangle([tx, 90 + hh + 12, tx + hw, 90 + hh + 18], fill=accent_rgb)

    b_font = _load_font(42)
    _render_bullets_dash(draw, bullets, b_font, accent_rgb,
                         text_x=tx, text_x_max=W - 80,
                         start_y=90 + hh + 60, row_gap=82)


def _text_std_card_on_gray(draw, img, heading, bullets, accent_rgb):
    """
    Style 3 — CARD ON GRAY
    Light gray bg. Centered white rounded card containing heading + numbered bullets.
    """
    img.paste(Image.new("RGB", (W, H), _BGRAY))
    draw = ImageDraw.Draw(img)

    # Card
    pad = 80
    draw.rounded_rectangle([pad, pad, W - pad, H - pad], radius=40, fill=_WHITE)

    h_font = _load_font(62)
    hw, hh = _measure(draw, heading, h_font)
    hx = (W - hw) // 2
    hy = pad + 60
    draw.text((hx, hy), heading, font=h_font, fill=_DARK)

    # Accent underline
    draw.rectangle([hx, hy + hh + 10, hx + hw, hy + hh + 16], fill=accent_rgb)

    b_font = _load_font(40)
    _render_bullets_numbered(draw, bullets, b_font, accent_rgb,
                              text_x=160, text_x_max=W - 160,
                              start_y=hy + hh + 60, row_gap=80)


def generate_text_slide_standard(heading, bullets, accent_color, out_path, style=None):
    if not _PILLOW_AVAILABLE:
        raise RuntimeError("Pillow not installed")

    accent_rgb = _hex_to_rgb(accent_color)
    if style is None:
        style = _pick_style(accent_color)

    img  = Image.new("RGB", (W, H), _WHITE)
    draw = ImageDraw.Draw(img)

    if style == 0:
        _text_std_clean_bars(draw, img, heading, bullets, accent_rgb)
    elif style == 1:
        _text_std_dark_header(draw, img, heading, bullets, accent_rgb)
    elif style == 2:
        _text_std_minimal_left(draw, img, heading, bullets, accent_rgb)
    else:
        _text_std_card_on_gray(draw, img, heading, bullets, accent_rgb)

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    img.save(out_path, "PNG")
    logger.info("Text slide (standard)  style=%d  path=%s", style, out_path)
    return out_path


# ---------------------------------------------------------------------------
# TEXT SLIDE SPLIT — 4 styles
# ---------------------------------------------------------------------------

def _split_line_divider(draw, img, heading, left_panel, right_panel, accent_rgb):
    """Style 0 — LINE DIVIDER: white bg, accent bars, thin gray vertical divider."""
    draw.rectangle([0, 0, W, 8], fill=accent_rgb)
    draw.rectangle([0, H - 8, W, H], fill=accent_rgb)

    h_font = _load_font(56)
    hw, hh = _measure(draw, heading, h_font)
    draw.text(((W - hw) // 2, 60), heading, font=h_font, fill=_DARK)

    divider_x = W // 2
    draw.rectangle([divider_x - 1, 180, divider_x + 1, H - 40], fill=_LGRAY)

    comp_rgb = _darken(accent_rgb, 0.55)
    lbl_font = _load_font(44)
    b_font   = _load_font(36)
    dot_r    = 8

    for side_x, panel, lbl_color in [
        (80,             left_panel,  accent_rgb),
        (divider_x + 60, right_panel, comp_rgb),
    ]:
        draw.text((side_x, 185), panel.get("label", ""), font=lbl_font, fill=lbl_color)
        y = 265
        for bullet in panel.get("bullets", []):
            draw.ellipse([side_x - dot_r - 2, y + 16 - dot_r,
                          side_x - 2,          y + 16 + dot_r], fill=lbl_color)
            for line in _wrap_line(draw, bullet, b_font, divider_x - side_x - 60):
                _render_rich(draw, line, side_x + 18, y, b_font, accent_rgb)
                _, lh = _measure(draw, "A", b_font)
                y += lh + 6
            y += 62


def _split_colored_panels(draw, img, heading, left_panel, right_panel, accent_rgb):
    """
    Style 1 — COLORED PANELS
    No divider line. Left half has very light accent tint bg, right has complement tint.
    Labels are bold, colored. Circle bullets.
    """
    comp_rgb  = _darken(accent_rgb, 0.55)
    left_tint = _lighten(accent_rgb, 0.82)
    right_tint = _lighten(comp_rgb,  0.82)

    # Panel backgrounds
    draw.rectangle([0, 0, W // 2, H], fill=left_tint)
    draw.rectangle([W // 2, 0, W, H], fill=right_tint)

    # Heading centered on white pill at top
    h_font = _load_font(54)
    hw, hh = _measure(draw, heading, h_font)
    pill_pad = 40
    draw.rounded_rectangle([(W - hw) // 2 - pill_pad, 30,
                             (W + hw) // 2 + pill_pad, 30 + hh + 28],
                            radius=20, fill=_WHITE)
    draw.text(((W - hw) // 2, 44), heading, font=h_font, fill=_DARK)

    lbl_font = _load_font(48)
    b_font   = _load_font(38)
    dot_r    = 9

    for side_x, col_max, panel, lbl_color in [
        (60,         W // 2 - 60, left_panel,  accent_rgb),
        (W // 2 + 60, W - 60,     right_panel, comp_rgb),
    ]:
        col_w = col_max - side_x
        draw.text((side_x, 160), panel.get("label", ""), font=lbl_font, fill=lbl_color)
        y = 240
        for bullet in panel.get("bullets", []):
            draw.ellipse([side_x - dot_r - 2, y + 18 - dot_r,
                          side_x - 2,          y + 18 + dot_r], fill=lbl_color)
            for line in _wrap_line(draw, bullet, b_font, col_w - 30):
                _render_rich(draw, line, side_x + 22, y, b_font, accent_rgb)
                _, lh = _measure(draw, "A", b_font)
                y += lh + 6
            y += 65


def _split_top_labels(draw, img, heading, left_panel, right_panel, accent_rgb):
    """
    Style 2 — TOP LABELS WITH CHIPS
    White bg. Labels rendered as rounded pill chips at top of each column.
    Horizontal divider line below chips. Em-dash bullets below.
    """
    draw.rectangle([0, 0, W, 8], fill=accent_rgb)
    draw.rectangle([0, H - 8, W, H], fill=accent_rgb)

    comp_rgb = _darken(accent_rgb, 0.55)
    h_font = _load_font(56)
    hw, hh = _measure(draw, heading, h_font)
    draw.text(((W - hw) // 2, 55), heading, font=h_font, fill=_DARK)

    # Pill chips for labels
    chip_font = _load_font(40)
    chip_y    = 55 + hh + 30
    chip_pad  = 30

    col_mid = W // 2
    for chip_cx, panel, bg_color in [
        (col_mid // 2,       left_panel,  accent_rgb),
        (col_mid + col_mid // 2, right_panel, comp_rgb),
    ]:
        lbl = panel.get("label", "")
        lw, lh = _measure(draw, lbl, chip_font)
        cx0 = chip_cx - lw // 2 - chip_pad
        cy0 = chip_y
        cx1 = chip_cx + lw // 2 + chip_pad
        cy1 = chip_y + lh + chip_pad
        draw.rounded_rectangle([cx0, cy0, cx1, cy1], radius=cy1 - cy0, fill=bg_color)
        draw.text((chip_cx - lw // 2, chip_y + chip_pad // 2), lbl, font=chip_font, fill=_WHITE)

    chip_bot = chip_y + chip_font.size + chip_pad + 10
    draw.rectangle([60, chip_bot, W - 60, chip_bot + 2], fill=_LGRAY)

    b_font = _load_font(36)
    for side_x, col_max, panel in [
        (60,           col_mid - 30, left_panel),
        (col_mid + 30, W - 60,       right_panel),
    ]:
        col_w = col_max - side_x
        y = chip_bot + 30
        for bullet in panel.get("bullets", []):
            for line in _wrap_line(draw, bullet, b_font, col_w):
                _render_rich(draw, line, side_x + 30, y, b_font, accent_rgb)
                _, lh = _measure(draw, "A", b_font)
                y += lh + 6
            y += 60


def _split_cards(draw, img, heading, left_panel, right_panel, accent_rgb):
    """
    Style 3 — DUAL CARDS ON GRAY
    Gray bg. Two separate white rounded cards side by side.
    Numbered bullets inside each card.
    """
    img.paste(Image.new("RGB", (W, H), _BGRAY))
    draw = ImageDraw.Draw(img)

    comp_rgb = _darken(accent_rgb, 0.55)
    h_font   = _load_font(56)
    hw, hh   = _measure(draw, heading, h_font)
    draw.text(((W - hw) // 2, 40), heading, font=h_font, fill=_DARK)

    card_y0 = 40 + hh + 40
    card_pad = 40
    gap      = 30
    mid      = W // 2

    for cx0, cx1, panel, lbl_color in [
        (card_pad,   mid - gap // 2, left_panel,  accent_rgb),
        (mid + gap // 2, W - card_pad, right_panel, comp_rgb),
    ]:
        draw.rounded_rectangle([cx0, card_y0, cx1, H - card_pad], radius=32, fill=_WHITE)
        lbl_font = _load_font(44)
        lw, lh   = _measure(draw, panel.get("label", ""), lbl_font)
        lx       = (cx0 + cx1 - lw) // 2
        draw.text((lx, card_y0 + 40), panel.get("label", ""), font=lbl_font, fill=lbl_color)
        draw.rectangle([lx, card_y0 + 40 + lh + 8, lx + lw, card_y0 + 40 + lh + 14],
                       fill=lbl_color)

        b_font = _load_font(34)
        col_w  = cx1 - cx0 - 80
        _render_bullets_numbered(draw, panel.get("bullets", []), b_font, accent_rgb,
                                  text_x=cx0 + 40, text_x_max=cx1 - 40,
                                  start_y=card_y0 + 40 + lh + 40, row_gap=70)


def generate_text_slide_split(heading, left_panel, right_panel, accent_color, out_path, style=None):
    if not _PILLOW_AVAILABLE:
        raise RuntimeError("Pillow not installed")

    accent_rgb = _hex_to_rgb(accent_color)
    if style is None:
        style = _pick_style(accent_color)

    img  = Image.new("RGB", (W, H), _WHITE)
    draw = ImageDraw.Draw(img)

    if style == 0:
        _split_line_divider(draw, img, heading, left_panel, right_panel, accent_rgb)
    elif style == 1:
        _split_colored_panels(draw, img, heading, left_panel, right_panel, accent_rgb)
    elif style == 2:
        _split_top_labels(draw, img, heading, left_panel, right_panel, accent_rgb)
    else:
        _split_cards(draw, img, heading, left_panel, right_panel, accent_rgb)

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    img.save(out_path, "PNG")
    logger.info("Text slide (split)  style=%d  path=%s", style, out_path)
    return out_path


# ---------------------------------------------------------------------------
# Summary slide
# ---------------------------------------------------------------------------

def generate_summary_slide(bullets, accent_color, out_path):
    """Key Takeaways slide — uses the same style as the rest of the video."""
    return generate_text_slide_standard(
        heading="Key Takeaways",
        bullets=bullets,
        accent_color=accent_color,
        out_path=out_path,
    )


# ---------------------------------------------------------------------------
# Public dispatcher
# ---------------------------------------------------------------------------

def generate_slide(slide_spec: dict, out_path: str) -> str:
    """
    Dispatch to the correct generator. Style is auto-picked from accent_color.

    Args:
        slide_spec: dict from the planner's slide_frames list
        out_path:   full path where the PNG should be written
    Returns:
        out_path
    """
    if not _PILLOW_AVAILABLE:
        raise RuntimeError("Pillow not installed — pip install pillow")

    accent = slide_spec.get("accent_color", "#a5d8ff")
    style  = _pick_style(accent)

    slide_type = slide_spec.get("type", "text_slide")

    if slide_type == "chapter_intro":
        return generate_chapter_intro(
            number       = str(slide_spec.get("number", "1")),
            title        = slide_spec.get("title", ""),
            subtitle     = slide_spec.get("subtitle", ""),
            accent_color = accent,
            out_path     = out_path,
            style        = style,
        )

    if slide_type == "text_slide":
        layout = slide_spec.get("layout", "standard")
        if layout == "split":
            return generate_text_slide_split(
                heading      = slide_spec.get("heading", ""),
                left_panel   = slide_spec.get("left_panel", {}),
                right_panel  = slide_spec.get("right_panel", {}),
                accent_color = accent,
                out_path     = out_path,
                style        = style,
            )
        else:
            return generate_text_slide_standard(
                heading      = slide_spec.get("heading", ""),
                bullets      = slide_spec.get("bullets", []),
                accent_color = accent,
                out_path     = out_path,
                style        = style,
            )

    raise RuntimeError(f"Unknown slide type: {slide_spec.get('type')!r}")
