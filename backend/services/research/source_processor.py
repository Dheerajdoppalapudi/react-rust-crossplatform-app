"""
Source ranking, deduplication, and token budget enforcement.
"""

import structlog
from urllib.parse import urlparse

from core.config import DEEP_MAX_TOKENS_SOURCE
from services.research.search_provider import SearchResult

logger = structlog.get_logger(__name__)

# Domains that receive a quality score boost
_HIGH_AUTHORITY_DOMAINS = frozenset({
    "nature.com", "science.org", "pubmed.ncbi.nlm.nih.gov", "scholar.google.com",
    "arxiv.org", "jstor.org", "bbc.com", "reuters.com", "apnews.com",
    "wikipedia.org", "britannica.com", "nasa.gov", "nih.gov", "who.int",
    "edu",   # any .edu TLD
    "gov",   # any .gov TLD
})

# Financial/stock data sources — structured data (tables, price history, filings).
# These get a higher boost than general authority sites because for economics
# queries they carry actual numbers, not just prose about numbers.
FINANCIAL_PRIORITY_DOMAINS = frozenset({
    "screener.in",          # best Indian stock fundamentals + quarterly tables
    "trendlyne.com",        # quarterly results, financials, estimates
    "finance.yahoo.com",    # price history, key stats
    "moneycontrol.com",     # financials, news, shareholding
    "nseindia.com",         # official NSE filings
    "bseindia.com",         # official BSE filings
    "tickertape.in",        # fundamentals, ratios
    "ticker.finology.in",   # ratios, historical financials
    "indmoney.com",         # price history, returns
    "investing.com",        # global price history
    "tradingview.com",      # price charts, technicals
    "wisesheets.io",        # financial data exports
})


def _domain_boost(domain: str, intent_domain: str = "") -> float:
    """Return a score boost 0.0–0.25 based on domain authority and query domain."""
    if not domain:
        return 0.0
    # Financial sources get a strong boost for economics queries
    if intent_domain == "economics":
        for fin in FINANCIAL_PRIORITY_DOMAINS:
            if domain.endswith(fin):
                return 0.25
    tld = domain.rsplit(".", 1)[-1] if "." in domain else ""
    if tld in ("edu", "gov"):
        return 0.2
    for auth in _HIGH_AUTHORITY_DOMAINS:
        if domain.endswith(auth):
            return 0.15
    return 0.0


def rank_and_deduplicate(
    results: list[SearchResult],
    max_sources: int,
    intent_domain: str = "",
) -> list[SearchResult]:
    """
    Score each result, remove duplicate URLs, and return the top max_sources.

    Scoring: tavily_score (0–1) + domain_boost (0–0.25)
    Pass intent_domain to apply category-specific boosts (e.g. "economics"
    lifts financial data sources to the top).
    """
    seen_urls: set[str] = set()
    unique: list[SearchResult] = []
    for r in results:
        if r.url in seen_urls:
            continue
        seen_urls.add(r.url)
        unique.append(r)

    scored = sorted(
        unique,
        key=lambda r: r.score + _domain_boost(r.domain, intent_domain),
        reverse=True,
    )
    top = scored[:max_sources]
    logger.info(
        "sources_ranked",
        total_input=len(results),
        after_dedup=len(unique),
        dupes_dropped=len(results) - len(unique),
        returned=len(top),
        top_sources=[{"domain": r.domain, "score": round(r.score, 3), "url": r.url} for r in top],
    )
    return top


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


def source_summary(s: SearchResult) -> dict:
    """Compact dict sent to the frontend (no full content)."""
    return {
        "title":          s.title,
        "url":            s.url,
        "snippet":        s.snippet[:300],
        "domain":         s.domain,
        "published_date": s.published_date,
    }


def source_full(s: SearchResult, full_content: bool = False) -> dict:
    """Full dict persisted to DB and fed to LLM/ChromaDB.

    full_content=True: sends the full page text (s.content) to the LLM — use for
    top-ranked sources where complete data matters (financial tables, full articles).
    full_content=False: sends the short snippet — sufficient for lower-ranked sources.
    """
    return {
        "title":          s.title,
        "url":            s.url,
        "snippet":        s.snippet,
        "content":        s.content if full_content else s.snippet,
        "domain":         s.domain,
        "score":          s.score,
        "published_date": s.published_date,
    }


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
