"""
Deep research orchestrator — the main SSE generator for the research phase.

Flow:
  1. Decompose query → sub-questions + search queries          (Haiku)
  2. Run parallel Tavily searches (up to DEEP_SEARCH_QUERIES)
  3. Fetch extra URL content via Tavily extract (user-pasted URLs + uploads)
  4. Rank + deduplicate sources
  5. Optional round 2 if significant gaps detected
  6. Stream synthesis tokens                                   (Haiku → Sonnet later)
  7. Yield synthesis_done with synthesised text + source list
"""

import asyncio
import logging
import time
from dataclasses import asdict
from typing import AsyncGenerator, Optional

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


async def _research_loop(
    query: str,
    conversation_context: str,
    file_paths: list[str],
    extra_urls: list[str],
    llm_service: LLMService,
    t0: float,
) -> AsyncGenerator[dict, None]:
    # ── Stage 1: Decompose ────────────────────────────────────────────────────
    yield {"type": "stage", "stage": "decomposing", "label": "Understanding your question…"}
    t1 = time.time()

    plan = await asyncio.wait_for(
        query_planner.decompose(query, conversation_context, llm_service),
        timeout=DEEP_TIMEOUT_SECONDS * 0.2,
    )
    logger.info("research_plan  queries=%d  sub_questions=%d",
                len(plan.search_queries), len(plan.sub_questions))

    yield {"type": "stage_done", "stage": "decomposing", "duration_s": round(time.time() - t1, 2)}

    # ── Stages 2–4: Search rounds ─────────────────────────────────────────────
    all_results: list[SearchResult] = []
    queries_used: list[str] = plan.search_queries[:DEEP_SEARCH_QUERIES]

    for round_n in range(DEEP_SEARCH_ROUNDS):
        if not queries_used:
            break

        n_queries = len(queries_used)
        yield {
            "type": "stage",
            "stage": "searching",
            "label": f"Searching {n_queries} {'query' if n_queries == 1 else 'queries'}…",
            "round": round_n + 1,
        }
        t2 = time.time()

        search_tasks = [tavily.search(q, max_results=5) for q in queries_used]
        batches = await asyncio.gather(*search_tasks)

        round_results: list[SearchResult] = []
        for batch in batches:
            round_results.extend(batch)

        # Deduplicate within this round before emitting
        seen = {r.url for r in all_results}
        new_results = [r for r in round_results if r.url not in seen]
        all_results.extend(new_results)

        for r in new_results:
            yield {
                "type": "source",
                "source": {
                    "title":  r.title,
                    "url":    r.url,
                    "snippet": r.snippet[:300],
                    "domain": r.domain,
                    "score":  r.score,
                },
            }

        yield {
            "type": "stage_done",
            "stage": "searching",
            "duration_s": round(time.time() - t2, 2),
            "sources_found": len(new_results),
        }

        # Check for knowledge gaps — if results are thin and we have rounds left,
        # generate follow-up queries on the weakest sub-questions
        if round_n < DEEP_SEARCH_ROUNDS - 1 and len(all_results) < 5:
            queries_used = [f"{q} explained" for q in plan.sub_questions[:2]]
        else:
            break  # Sufficient results or last round

    # ── Stage 3: Read sources ─────────────────────────────────────────────────
    ranked = rank_and_deduplicate(all_results, DEEP_SEARCH_SOURCES)

    # Fetch extra URL content in parallel (user-pasted URLs)
    url_sources: list[SearchResult] = []
    if extra_urls:
        yield {"type": "stage", "stage": "reading", "label": f"Reading {len(extra_urls)} provided URL(s)…"}
        url_contents = await asyncio.gather(*[tavily.extract(u) for u in extra_urls])
        for url, content in zip(extra_urls, url_contents):
            if content:
                from urllib.parse import urlparse
                domain = urlparse(url).netloc.lstrip("www.")
                url_sources.append(SearchResult(
                    title=f"User-provided: {domain}",
                    url=url, snippet=content[:300],
                    content=content, domain=domain, score=1.0,
                ))

    # Extract uploaded file text as sources
    file_sources: list[SearchResult] = []
    for fp in file_paths:
        text = extract_text(fp)
        if text:
            from pathlib import Path
            name = Path(fp).name
            file_sources.append(SearchResult(
                title=f"Uploaded: {name}",
                url=f"local://{name}", snippet=text[:300],
                content=text, domain="uploaded_file", score=1.0,
            ))

    # Combine: user-provided sources first (highest priority), then web results
    all_final = file_sources + url_sources + ranked
    final_sources = all_final[:DEEP_SOURCES_IN_ANSWER]

    n_reading = len(final_sources)
    yield {"type": "stage", "stage": "reading", "label": f"Reading {n_reading} sources…"}

    # Truncate content to token budget per source
    for s in final_sources:
        s.content = truncate_content(s.content or s.snippet)

    yield {"type": "stage_done", "stage": "reading", "duration_s": 0.0}

    # ── Stage 4: Synthesise ───────────────────────────────────────────────────
    yield {"type": "stage", "stage": "synthesising", "label": "Synthesising answer…"}

    full_text = ""
    async for token in synthesiser.stream(query, final_sources, llm_service, conversation_context):
        yield {"type": "token", "text": token}
        full_text += token

    yield {
        "type": "synthesis_done",
        "synthesized_text": full_text,
        "sources": [
            {
                "title":          s.title,
                "url":            s.url,
                "snippet":        s.snippet[:300],
                "domain":         s.domain,
                "published_date": s.published_date,
            }
            for s in final_sources
        ],
    }

    logger.info(
        "deep_research_complete  query=%r  sources=%d  chars=%d  elapsed_s=%.1f",
        query[:80], len(final_sources), len(full_text), time.time() - t0,
    )
