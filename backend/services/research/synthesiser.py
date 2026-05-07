"""
Final synthesis — takes the evidence table and produces a cited markdown answer.

Uses streaming so the route handler can forward tokens to the client as they arrive.
Citation format: inline [1], [2], [3] matching the source index in the evidence table.
"""

import asyncio
import logging
from typing import AsyncGenerator

from services.research.search_provider import SearchResult
from services.research.source_processor import build_evidence_table
from services.llm_service import LLMService

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a research synthesiser for an AI educational app used by students.

Your task: write a comprehensive, well-structured answer using ONLY the provided evidence.

Rules:
1. Use inline citations like [1], [2], [3] immediately after each factual claim.
2. Write in clear, educational language suitable for students.
3. Use markdown: headers (##), bullet points, bold for key terms.
4. Be thorough but concise — aim for 300–600 words.
5. If sources contradict each other, mention the disagreement.
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

    # Try streaming via Anthropic SDK
    try:
        async for token in _stream_anthropic(llm_service, user_msg):
            yield token
        return
    except Exception as e:
        logger.warning("Streaming synthesis failed (%s) — falling back to single call", e)

    # Fallback: single blocking call
    try:
        raw, _ = await asyncio.to_thread(
            llm_service.make_system_user_request,
            _SYSTEM_PROMPT,
            user_msg,
            max_tokens=1200,
        )
        if raw:
            yield raw
    except Exception as e:
        logger.error("Synthesis fallback also failed: %s", e)
        yield "Unable to synthesise an answer at this time. Please try again."


async def _stream_anthropic(llm_service: LLMService, user_msg: str) -> AsyncGenerator[str, None]:
    """Stream tokens directly from the Anthropic client if available."""
    provider = llm_service.provider
    # Only attempt if the underlying provider is Anthropic
    if not hasattr(provider, "_client") or provider.__class__.__name__ != "ClaudeProvider":
        raise NotImplementedError("streaming only implemented for ClaudeProvider")

    import anthropic

    client: anthropic.Anthropic = provider._client
    model = getattr(provider, "model", "claude-haiku-4-5-20251001")

    def _run_stream():
        chunks = []
        with client.messages.stream(
            model=model,
            max_tokens=1200,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        ) as stream:
            for text in stream.text_stream:
                chunks.append(text)
        return chunks

    tokens = await asyncio.to_thread(_run_stream)
    for token in tokens:
        yield token
