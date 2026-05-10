"""
Research helpers — source summary formatters used by the search pipeline.

The orchestration logic (run_deep_research, run_followup_research) has been
merged into routers/generate.py as _search_phase(). This module retains only
the shared data-formatting helpers used by multiple callsites.
"""

from services.research.search_provider import SearchResult


def source_summary(s: SearchResult) -> dict:
    """Compact dict sent to the frontend (no full content)."""
    return {
        "title":          s.title,
        "url":            s.url,
        "snippet":        s.snippet[:300],
        "domain":         s.domain,
        "published_date": s.published_date,
    }


def source_full(s: SearchResult) -> dict:
    """Full dict persisted to DB — includes content for follow-up reuse."""
    return {
        "title":          s.title,
        "url":            s.url,
        "snippet":        s.snippet,
        "content":        s.content,
        "domain":         s.domain,
        "score":          s.score,
        "published_date": s.published_date,
    }
