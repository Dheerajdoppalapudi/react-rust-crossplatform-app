"""
Final synthesis — takes the evidence table and produces a cited markdown answer.

Uses streaming so the route handler can forward tokens to the client as they arrive.
Citation format: inline [1], [2], [3] matching the source index in the evidence table.
"""

import asyncio
import logging
from typing import AsyncGenerator, Optional

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
            max_tokens=4096,
        )
        if raw:
            yield raw
    except Exception as e:
        logger.error("Synthesis fallback also failed: %s", e)
        yield "Unable to synthesise an answer at this time. Please try again."


async def _stream_anthropic(llm_service: LLMService, user_msg: str) -> AsyncGenerator[str, None]:
    """
    Real token-by-token streaming via asyncio.Queue bridge.
    The sync Anthropic stream runs in a thread and puts tokens onto a queue;
    the async generator drains the queue so tokens reach the caller as they arrive.
    """
    provider = llm_service.provider
    if not hasattr(provider, "_client") or provider.__class__.__name__ != "ClaudeProvider":
        raise NotImplementedError("streaming only implemented for ClaudeProvider")

    import anthropic

    client: anthropic.Anthropic = provider._client
    model = getattr(provider, "model", "claude-haiku-4-5-20251001")
    loop  = asyncio.get_event_loop()
    queue: asyncio.Queue[Optional[str]] = asyncio.Queue()

    def _run_stream():
        try:
            with client.messages.stream(
                model=model,
                max_tokens=4096,
                system=_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_msg}],
            ) as s:
                for text in s.text_stream:
                    loop.call_soon_threadsafe(queue.put_nowait, text)
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, exc)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel

    asyncio.create_task(asyncio.to_thread(_run_stream))
    while True:
        item = await queue.get()
        if item is None:
            break
        if isinstance(item, Exception):
            raise item
        yield item
