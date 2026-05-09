"""
Deep research orchestrator — the main SSE generator for the research phase.

Flow:
  1. Decompose query → sub-questions + search queries          (Haiku)
  2. Run parallel Tavily searches (up to DEEP_SEARCH_QUERIES)
  3. Fetch extra URL content via Tavily extract (user-pasted URLs + uploads)
  4. Rank + deduplicate sources
  5. Optional round 2 if significant gaps detected
  6. Stream synthesis tokens
  7. Yield synthesis_done with synthesised text + source list
"""

import asyncio
import logging
import time
from pathlib import Path
from typing import AsyncGenerator
from urllib.parse import urlparse

from core.config import (
    DEEP_SEARCH_ROUNDS,
    DEEP_SEARCH_QUERIES,
    DEEP_SEARCH_SOURCES,
    DEEP_SOURCES_IN_ANSWER,
    DEEP_TIMEOUT_SECONDS,
)
from services.llm_service import LLMService
from services.research import query_planner, synthesiser
from services.research.file_extractor import extract_text
from services.research.search_provider import SearchResult, tavily
from services.research.source_processor import rank_and_deduplicate, truncate_content

logger = logging.getLogger(__name__)


def _source_summary(s: SearchResult) -> dict:
    """Compact dict for the frontend (no full content)."""
    return {
        "title":          s.title,
        "url":            s.url,
        "snippet":        s.snippet[:300],
        "domain":         s.domain,
        "published_date": s.published_date,
    }


def _source_full(s: SearchResult) -> dict:
    """Full dict for DB storage — includes content for follow-up reuse."""
    return {
        "title":          s.title,
        "url":            s.url,
        "snippet":        s.snippet,
        "content":        s.content,
        "domain":         s.domain,
        "score":          s.score,
        "published_date": s.published_date,
    }


async def run_deep_research(
    query: str,
    conversation_context: str,
    file_paths: list[str],
    extra_urls: list[str],
    llm_service: LLMService,
) -> AsyncGenerator[dict, None]:
    """
    Main research pipeline. Yields SSE-compatible dicts.
    Terminal events: synthesis_done (success) or error (failure).
    """
    t0 = time.time()

    try:
        async for event in _research_loop(
            query, conversation_context, file_paths, extra_urls, llm_service, t0
        ):
            yield event
    except asyncio.TimeoutError:
        logger.error("deep_research timeout  query=%r", query[:80])
        yield {"type": "error", "message": "Research timed out. Please try a simpler query."}
    except Exception as e:
        logger.error("deep_research failed  query=%r  error=%s", query[:80], e, exc_info=True)
        yield {"type": "error", "message": "Research failed. Please try again."}


async def run_followup_research(
    query: str,
    prior_sources: list[dict],
    conversation_context: str,
    llm_service: LLMService,
) -> AsyncGenerator[dict, None]:
    """
    Lightweight research for follow-up questions.

    Runs 1 targeted Tavily search and merges results with prior sources.
    Much faster than full research (~4s vs ~15s) while still getting fresh
    information if the follow-up asks about something new.
    """
    t0 = time.time()

    try:
        async for event in _followup_loop(query, prior_sources, conversation_context, llm_service, t0):
            yield event
    except Exception as e:
        logger.error("followup_research failed  query=%r  error=%s", query[:80], e, exc_info=True)
        yield {"type": "error", "message": "Research failed. Please try again."}


async def _followup_loop(
    query: str,
    prior_sources: list[dict],
    conversation_context: str,
    llm_service: LLMService,
    t0: float,
) -> AsyncGenerator[dict, None]:
    # ── Stage: targeted search ────────────────────────────────────────────────
    yield {"type": "stage", "stage": "searching", "label": "Searching for new information…", "queries": [query]}
    t_search = time.time()

    new_results = await tavily.search(query, max_results=5)

    prior_urls = {s["url"] for s in prior_sources}
    new_only   = [r for r in new_results if r.url not in prior_urls]

    for r in new_only:
        yield {"type": "source", "source": _source_summary(r)}

    yield {"type": "stage_done", "stage": "searching", "duration_s": round(time.time() - t_search, 2)}

    # ── Stage: reading — merge prior + new, deduplicate ───────────────────────
    # Reconstruct SearchResult objects from stored prior source dicts
    prior_sr: list[SearchResult] = []
    for s in prior_sources:
        prior_sr.append(SearchResult(
            title=s.get("title", ""),
            url=s.get("url", ""),
            snippet=s.get("snippet", ""),
            content=s.get("content", "") or s.get("snippet", ""),
            domain=s.get("domain", ""),
            score=s.get("score", 0.5),
            published_date=s.get("published_date"),
        ))

    merged = prior_sr + new_only
    merged = merged[:DEEP_SOURCES_IN_ANSWER]

    n_merged = len(merged)
    yield {"type": "stage", "stage": "reading", "label": f"Reading {n_merged} sources…"}
    t_read = time.time()

    for s in merged:
        s.content = truncate_content(s.content or s.snippet)

    yield {"type": "stage_done", "stage": "reading", "duration_s": round(time.time() - t_read, 2)}

    # ── Stage: synthesising ───────────────────────────────────────────────────
    yield {"type": "stage", "stage": "synthesising", "label": "Synthesising answer…"}
    t_synth = time.time()

    full_text = ""
    async for token in synthesiser.stream(query, merged, llm_service, conversation_context):
        yield {"type": "token", "text": token}
        full_text += token

    yield {"type": "stage_done", "stage": "synthesising", "duration_s": round(time.time() - t_synth, 2)}
    yield {
        "type":             "synthesis_done",
        "synthesized_text": full_text,
        "sources":          [_source_summary(s) for s in merged],
        "sources_full":     [_source_full(s) for s in merged],
    }

    logger.info(
        "followup_research_complete  query=%r  prior=%d  new=%d  elapsed_s=%.1f",
        query[:80], len(prior_sr), len(new_only), time.time() - t0,
    )


async def _research_loop(
    query: str,
    conversation_context: str,
    file_paths: list[str],
    extra_urls: list[str],
    llm_service: LLMService,
    t0: float,
) -> AsyncGenerator[dict, None]:
    # ── Stage 1: Decompose ────────────────────────────────────────────────────
    yield {"type": "stage", "stage": "thinking", "label": "Thinking about your question…"}
    t1 = time.time()

    plan = await asyncio.wait_for(
        query_planner.decompose(query, conversation_context, llm_service),
        timeout=DEEP_TIMEOUT_SECONDS * 0.2,
    )
    logger.info("research_plan  queries=%d  sub_questions=%d",
                len(plan.search_queries), len(plan.sub_questions))

    yield {"type": "stage_done", "stage": "thinking", "duration_s": round(time.time() - t1, 2)}

    # ── Stages 2–4: Search rounds ─────────────────────────────────────────────
    all_results: list[SearchResult] = []
    queries_used: list[str] = plan.search_queries[:DEEP_SEARCH_QUERIES]

    for round_n in range(DEEP_SEARCH_ROUNDS):
        if not queries_used:
            break

        n_queries = len(queries_used)
        yield {
            "type":    "stage",
            "stage":   "searching",
            "label":   f"Searching {n_queries} {'query' if n_queries == 1 else 'queries'}…",
            "round":   round_n + 1,
            "queries": queries_used,
        }
        t2 = time.time()

        batches = await asyncio.gather(*[tavily.search(q, max_results=5) for q in queries_used])

        round_results: list[SearchResult] = []
        for batch in batches:
            round_results.extend(batch)

        seen = {r.url for r in all_results}
        new_results = [r for r in round_results if r.url not in seen]
        all_results.extend(new_results)

        for r in new_results:
            yield {"type": "source", "source": _source_summary(r)}

        yield {
            "type":          "stage_done",
            "stage":         "searching",
            "duration_s":    round(time.time() - t2, 2),
            "sources_found": len(new_results),
        }

        if round_n < DEEP_SEARCH_ROUNDS - 1 and len(all_results) < 5:
            queries_used = [f"{q} explained" for q in plan.sub_questions[:2]]
        else:
            break

    # ── Stage 3: Read sources ─────────────────────────────────────────────────
    ranked = rank_and_deduplicate(all_results, DEEP_SEARCH_SOURCES)

    # Fetch extra URL content + uploaded file text concurrently
    url_sources:  list[SearchResult] = []
    file_sources: list[SearchResult] = []

    if extra_urls:
        url_contents = await asyncio.gather(*[tavily.extract(u) for u in extra_urls])
        for url, content in zip(extra_urls, url_contents):
            if content:
                domain = urlparse(url).netloc.lstrip("www.")
                url_sources.append(SearchResult(
                    title=f"User-provided: {domain}",
                    url=url, snippet=content[:300],
                    content=content, domain=domain, score=1.0,
                ))

    for fp in file_paths:
        text = extract_text(fp)
        if text:
            name = Path(fp).name
            file_sources.append(SearchResult(
                title=f"Uploaded: {name}",
                url=f"local://{name}", snippet=text[:300],
                content=text, domain="uploaded_file", score=1.0,
            ))

    # Combine: uploaded files + user URLs first (highest priority), then web results
    all_final   = file_sources + url_sources + ranked
    final_sources = all_final[:DEEP_SOURCES_IN_ANSWER]

    n_reading = len(final_sources)
    yield {"type": "stage", "stage": "reading", "label": f"Reading {n_reading} sources…"}
    t_read = time.time()

    for s in final_sources:
        s.content = truncate_content(s.content or s.snippet)

    yield {"type": "stage_done", "stage": "reading", "duration_s": round(time.time() - t_read, 2)}

    # ── Stage 4: Synthesise ───────────────────────────────────────────────────
    yield {"type": "stage", "stage": "synthesising", "label": "Synthesising answer…"}
    t_synth = time.time()

    full_text = ""
    async for token in synthesiser.stream(query, final_sources, llm_service, conversation_context):
        yield {"type": "token", "text": token}
        full_text += token

    yield {"type": "stage_done", "stage": "synthesising", "duration_s": round(time.time() - t_synth, 2)}
    yield {
        "type":             "synthesis_done",
        "synthesized_text": full_text,
        "sources":          [_source_summary(s) for s in final_sources],
        "sources_full":     [_source_full(s) for s in final_sources],
    }

    logger.info(
        "deep_research_complete  query=%r  sources=%d  chars=%d  elapsed_s=%.1f",
        query[:80], len(final_sources), len(full_text), time.time() - t0,
    )
