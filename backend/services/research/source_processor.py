"""
Source ranking, deduplication, and token budget enforcement.
"""

import logging
from urllib.parse import urlparse

from core.config import DEEP_MAX_TOKENS_SOURCE
from services.research.search_provider import SearchResult

logger = logging.getLogger(__name__)

# Domains that receive a quality score boost
_HIGH_AUTHORITY_DOMAINS = frozenset({
    "nature.com", "science.org", "pubmed.ncbi.nlm.nih.gov", "scholar.google.com",
    "arxiv.org", "jstor.org", "bbc.com", "reuters.com", "apnews.com",
    "wikipedia.org", "britannica.com", "nasa.gov", "nih.gov", "who.int",
    "edu",   # any .edu TLD
    "gov",   # any .gov TLD
})


def _domain_boost(domain: str) -> float:
    """Return a score boost 0.0–0.2 based on domain authority."""
    if not domain:
        return 0.0
    tld = domain.rsplit(".", 1)[-1] if "." in domain else ""
    if tld in ("edu", "gov"):
        return 0.2
    for auth in _HIGH_AUTHORITY_DOMAINS:
        if domain.endswith(auth):
            return 0.15
    return 0.0


def rank_and_deduplicate(results: list[SearchResult], max_sources: int) -> list[SearchResult]:
    """
    Score each result, remove duplicate URLs, and return the top max_sources.

    Scoring: tavily_score (0–1) + domain_boost (0–0.2)
    """
    seen_urls: set[str] = set()
    unique: list[SearchResult] = []
    for r in results:
        if r.url in seen_urls:
            continue
        seen_urls.add(r.url)
        unique.append(r)

    # Re-score with domain authority bonus
    scored = sorted(
        unique,
        key=lambda r: r.score + _domain_boost(r.domain),
        reverse=True,
    )
    return scored[:max_sources]


def truncate_content(text: str, max_tokens: int = DEEP_MAX_TOKENS_SOURCE) -> str:
    """
    Approximate token budget enforcement: 1 token ≈ 4 chars.
    Truncates at a sentence boundary where possible.
    """
    max_chars = max_tokens * 4
    if len(text) <= max_chars:
        return text

    truncated = text[:max_chars]
    # Try to end at the last sentence boundary
    last_period = max(truncated.rfind(". "), truncated.rfind(".\n"))
    if last_period > max_chars * 0.7:
        return truncated[:last_period + 1]
    return truncated


def build_evidence_table(sources: list[SearchResult]) -> str:
    """
    Format sources into a compact evidence table for the synthesis prompt.
    Each entry includes: [N] title | domain | key excerpt
    """
    lines: list[str] = ["## Evidence\n"]
    for i, s in enumerate(sources, 1):
        excerpt = truncate_content(s.content or s.snippet, max_tokens=300)
        lines.append(f"[{i}] **{s.title}** ({s.domain})")
        lines.append(f"URL: {s.url}")
        lines.append(f"Excerpt: {excerpt}")
        lines.append("")
    return "\n".join(lines)
