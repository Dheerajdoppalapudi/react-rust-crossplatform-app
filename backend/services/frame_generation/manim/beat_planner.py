"""
Beat planner — one Sonnet call that produces the full BeatScript for a topic.

This is the only Sonnet call in the beat pipeline. It does all creative and
mathematical thinking once, producing detailed shot-by-shot descriptions for
every beat. Subsequent code-gen calls are pure Manim API translation.
"""

import asyncio
import logging
from pathlib import Path

from services.llm_service import LLMService, OpenAIProvider
from services.frame_generation.planner import call_llm, _extract_json, _log
from .beat_types import BeatScript

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
_PROMPT_TEMPLATE: str = (_PROMPTS_DIR / "planning_beats.md").read_text(encoding="utf-8")

_planner_service = LLMService(provider=OpenAIProvider(model="gpt-4.1"))

# Static portion of the prompt (everything before the TOPIC substitution) is
# eligible for Anthropic prompt caching — saves ~90% on repeated topics.
_split_marker = "TOPIC:"
_idx = _PROMPT_TEMPLATE.rfind(_split_marker)
_STATIC_PREFIX = _PROMPT_TEMPLATE[:_idx] if _idx != -1 else ""


async def plan_beats(user_prompt: str, conversation_context: str = "") -> BeatScript:
    """
    Call the Sonnet planner and return a validated BeatScript.

    Raises ValueError if the LLM returns malformed JSON or beat_count is out of range.
    """
    prompt = (
        _PROMPT_TEMPLATE
        .replace("{{USER_PROMPT}}", user_prompt)
        .replace("{{CONVERSATION_CONTEXT}}", conversation_context or "")
    )

    _log({"event": "beat_planner_start", "prompt_chars": len(prompt)})

    raw = await asyncio.to_thread(
        call_llm,
        prompt,
        9000,
        "planning_beats.md",
        _STATIC_PREFIX,
        _planner_service,
    )

    plan_dict = _extract_json(raw)
    script = BeatScript(**plan_dict)

    if not (4 <= len(script.beats) <= 12):
        raise ValueError(
            f"beat_count out of range: {len(script.beats)} beats returned "
            f"(expected 4-12). Raw: {raw[:300]}"
        )

    _log({"event": "beat_planner_done", "beat_count": script.beat_count,
          "topic": script.topic})
    return script
