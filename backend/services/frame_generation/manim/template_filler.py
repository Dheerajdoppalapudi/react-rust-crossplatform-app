"""
Fills structural beat templates with content from BeatPlan.content dict.
Returns Python code string ready to render — no LLM call needed.
"""

import structlog
from pathlib import Path

from .beat_types import BeatPlan
from .voiceover_setup import VOICEOVER_IMPORTS, SPEECH_SERVICE_INIT

logger = structlog.get_logger(__name__)

_TEMPLATES_DIR = Path(__file__).parent / "templates"

_COLOR_MAP = {
    "BLUE": "BLUE",
    "GREEN": "GREEN",
    "TEAL": "TEAL",
    "ORANGE": "ORANGE",
    "PURPLE": "PURPLE",
    "GOLD": "GOLD",
    "RED": "RED",
}


def _load_template(name: str) -> str:
    path = _TEMPLATES_DIR / name
    return path.read_text(encoding="utf-8")


def _escape(s: str) -> str:
    """Escape backslashes and double-quotes for safe Python string literals."""
    return s.replace("\\", "\\\\").replace('"', '\\"')


def _escape_text(s: str) -> str:
    """
    Escape for a single-line Python double-quoted string literal.
    Like _escape, but also collapses newlines/returns to spaces so multi-sentence
    narration stays on one line inside text="...".
    """
    return _escape(s or "").replace("\n", " ").replace("\r", " ").strip()


def _apply_common(tpl: str, beat: BeatPlan) -> str:
    """Substitute the voiceover boilerplate + narration shared by all templates."""
    return (
        tpl
        .replace("{VOICEOVER_IMPORTS}", VOICEOVER_IMPORTS)
        .replace("{SPEECH_SERVICE_INIT}", SPEECH_SERVICE_INIT)
        .replace("{NARRATION}", _escape_text(beat.narration))
    )


def _keyword_list_literal(keywords: list[str]) -> str:
    """Convert list of strings to Python string literals suitable for inline list."""
    if not keywords:
        return ""
    return ", ".join(f'"{_escape(k)}"' for k in keywords)


def _fill_concept_reveal(beat: BeatPlan) -> str:
    c = beat.content
    heading = _escape(str(c.get("heading", ""))[:45])
    bullets = c.get("bullets", ["", "", ""])
    while len(bullets) < 3:
        bullets.append("")
    accent_raw = str(c.get("accent_color", "BLUE")).upper()
    accent = _COLOR_MAP.get(accent_raw, "BLUE")

    tpl = _apply_common(_load_template("concept_reveal.py.tpl"), beat)
    return (
        tpl
        .replace("{ACCENT_COLOR}", accent)
        .replace("{HEADING}", heading)
        .replace("{BULLET_0}", _escape(str(bullets[0])[:45]))
        .replace("{BULLET_1}", _escape(str(bullets[1])[:45]))
        .replace("{BULLET_2}", _escape(str(bullets[2])[:45]))
        .replace("{KEYWORD_LIST}", _keyword_list_literal(beat.keywords))
    )


def _fill_comparison_split(beat: BeatPlan) -> str:
    c = beat.content
    left_title = _escape(str(c.get("left_title", "Left"))[:45])
    right_title = _escape(str(c.get("right_title", "Right"))[:45])
    left_pts = c.get("left_points", [])[:3]
    right_pts = c.get("right_points", [])[:3]
    conclusion = _escape(str(c.get("conclusion", ""))[:45])

    def pts_literal(pts: list) -> str:
        return ", ".join(f'"{_escape(str(p)[:45])}"' for p in pts)

    tpl = _apply_common(_load_template("comparison_split.py.tpl"), beat)
    return (
        tpl
        .replace("{LEFT_TITLE}", left_title)
        .replace("{RIGHT_TITLE}", right_title)
        .replace("{LEFT_POINTS}", pts_literal(left_pts))
        .replace("{RIGHT_POINTS}", pts_literal(right_pts))
        .replace("{CONCLUSION}", conclusion)
        .replace("{KEYWORD_LIST}", _keyword_list_literal(beat.keywords))
    )


def fill_template(beat: BeatPlan) -> str | None:
    """Return filled Python code for a structural beat, or None on failure."""
    try:
        if beat.template_type == "concept_reveal":
            return _fill_concept_reveal(beat)
        if beat.template_type == "comparison_split":
            return _fill_comparison_split(beat)
        logger.warning("template_filler_unknown_type", type=beat.template_type, beat_index=beat.index)
        return None
    except Exception as exc:
        logger.error("template_filler_fill_failed", beat_index=beat.index, error=str(exc), exc_info=True)
        return None
