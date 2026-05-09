"""
Query decomposition — breaks a user query into sub-questions and search strings.
Always uses Haiku regardless of the user's chosen model — this is a cheap
600-token JSON task; no need to spend Sonnet tokens on it.
"""

import asyncio
import logging
from dataclasses import dataclass, field

from services.frame_generation.planner import _extract_json
from services.llm_service import LLMService, ClaudeProvider

logger = logging.getLogger(__name__)

# Dedicated cheap service for planning — always Haiku, never the user's model.
_haiku_service = LLMService(provider=ClaudeProvider(model="claude-haiku-4-5-20251001"))

_SYSTEM_PROMPT = """You are a research planning assistant. Given a user question, produce a JSON research plan.

Return ONLY valid JSON with this exact shape:
{
  "query_type": "factual|comparison|research|news|how_to",
  "sub_questions": ["...", "...", "..."],
  "search_queries": ["...", "...", "...", "...", "..."],
  "needs_recency": true|false,
  "expected_source_types": ["academic", "news", "official", "educational"]
}

Rules:
- sub_questions: 3–5 focused questions that together answer the main query
- search_queries: 3–5 optimised web search strings (short, keyword-focused, varied)
- needs_recency: true only for news, current events, or rapidly changing topics
- Return ONLY the JSON object, no explanation"""


@dataclass
class ResearchPlan:
    query_type:            str
    sub_questions:         list[str] = field(default_factory=list)
    search_queries:        list[str] = field(default_factory=list)
    needs_recency:         bool = False
    expected_source_types: list[str] = field(default_factory=list)


async def decompose(
    query: str,
    conversation_context: str,
    llm_service: LLMService = None,  # kept for API compatibility; planning always uses Haiku
) -> ResearchPlan:
    """
    Decompose the query into a research plan via Haiku LLM call.
    Falls back to a simple single-query plan on any failure.
    """
    context_block = f"Prior conversation context:\n{conversation_context}\n\n" if conversation_context else ""
    user_msg = f"{context_block}Question to research: {query}"

    try:
        raw, _ = await asyncio.to_thread(
            _haiku_service.make_system_user_request,
            _SYSTEM_PROMPT,
            user_msg,
            max_tokens=600,
        )
        if raw:
            data = _extract_json(raw)
            return ResearchPlan(
                query_type=data.get("query_type", "research"),
                sub_questions=data.get("sub_questions", [query])[:5],
                search_queries=data.get("search_queries", [query])[:5],
                needs_recency=bool(data.get("needs_recency", False)),
                expected_source_types=data.get("expected_source_types", []),
            )
    except Exception as e:
        logger.warning("query_planner.decompose failed: %s", e)

    # Fallback — treat the original query as a single search
    return ResearchPlan(
        query_type="research",
        sub_questions=[query],
        search_queries=[query],
    )
