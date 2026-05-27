"""
Final synthesis — takes the evidence table and produces a cited markdown answer.

Uses streaming so the route handler can forward tokens to the client as they arrive.
Citation format: inline [1], [2], [3] matching the source index in the evidence table.

Streaming support:
  - ClaudeProvider  → native Anthropic async streaming
  - GeminiProvider  → OpenAI-compatible streaming (same SDK, custom base_url)
  - OpenAIProvider  → OpenAI streaming
"""

import asyncio
import structlog
from typing import AsyncGenerator, Optional

from services.research.search_provider import SearchResult
from services.research.source_processor import build_evidence_table
from services.llm_service import LLMService

logger = structlog.get_logger(__name__)

_SYSTEM_PROMPT = """You are a research synthesiser. Given a set of web sources, write a comprehensive, well-structured answer to the user's question.

Rules:
1. Use inline citations like [1], [2], [3] immediately after each factual claim.
2. Write in clear, direct prose — adapt tone to the question (technical for technical topics, accessible for general ones).
3. Use markdown: headers (##), bullet points, bold for key terms where appropriate.
4. Be thorough but concise — aim for 300–600 words.
5. If sources contradict each other, note the disagreement.
6. Do NOT invent facts not present in the evidence.
7. End with a brief "## Summary" of 2–3 sentences."""


async def stream(
    query: str,
    sources: list[SearchResult],
    llm_service: LLMService,
    extra_context: str = "",
) -> AsyncGenerator[str, None]:
    """
    Async generator that yields synthesis tokens one by one.
    Falls back to a single non-streaming call if streaming fails.
    """
    evidence = build_evidence_table(sources)
    context_block = f"Prior conversation:\n{extra_context}\n\n" if extra_context else ""
    user_msg = (
        f"{context_block}"
        f"## Question\n{query}\n\n"
        f"{evidence}\n\n"
        "Write your cited answer now:"
    )

    provider_class = llm_service.provider.__class__.__name__

    # Try streaming — Claude natively, OpenAI/Gemini via compatible API
    try:
        if provider_class == "ClaudeProvider":
            async for token in _stream_anthropic(llm_service, user_msg):
                yield token
        else:
            async for token in _stream_openai_compat(llm_service, user_msg):
                yield token
        return
    except Exception as e:
        logger.warning("synthesis_stream_failed_fallback", provider=provider_class, error=str(e))

    # Fallback: single async call
    try:
        raw, _ = await llm_service.make_system_user_request_async(
            _SYSTEM_PROMPT,
            user_msg,
            max_tokens=4096,
        )
        if raw:
            yield raw
    except Exception as e:
        logger.error("synthesis_fallback_failed", error=str(e))
        yield "Unable to synthesise an answer at this time. Please try again."


async def _stream_anthropic(llm_service: LLMService, user_msg: str) -> AsyncGenerator[str, None]:
    """Native async streaming via AsyncAnthropic — no thread or queue needed."""
    from services.llm_service import _get_async_anthropic_client
    client = _get_async_anthropic_client()
    model  = getattr(llm_service.provider, "model", "claude-haiku-4-5-20251001")

    async with client.messages.stream(
        model=model,
        max_tokens=4096,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    ) as s:
        async for text in s.text_stream:
            yield text


async def _stream_openai_compat(llm_service: LLMService, user_msg: str) -> AsyncGenerator[str, None]:
    """Streaming for OpenAI or Gemini (both use the same OpenAI SDK interface)."""
    from services.llm_service import (
        _get_async_openai_client, _get_async_gemini_client, GeminiProvider,
    )
    provider = llm_service.provider
    client = _get_async_gemini_client() if isinstance(provider, GeminiProvider) else _get_async_openai_client()
    model  = getattr(provider, "model", "gpt-4.1")

    response = await client.chat.completions.create(
        model=model,
        max_tokens=4096,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user",   "content": user_msg},
        ],
        stream=True,
    )
    async for chunk in response:
        text = chunk.choices[0].delta.content
        if text:
            yield text
