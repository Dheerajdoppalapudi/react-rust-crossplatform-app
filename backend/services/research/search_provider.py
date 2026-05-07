"""
Tavily search + extract abstraction.

All web access in the research pipeline flows through this module.
Swap out TavilyProvider for a different class to change providers.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse

from core.config import TAVILY_API_KEY

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    title:          str
    url:            str
    snippet:        str
    content:        str          # full extracted content (may be empty for snippet-only results)
    domain:         str
    score:          float
    published_date: Optional[str] = None


class TavilyProvider:
    """
    Wraps tavily-python for search and URL extraction.
    Falls back gracefully when the API key is missing.
    """

    def __init__(self):
        self._client = None
        if TAVILY_API_KEY:
            try:
                from tavily import TavilyClient
                self._client = TavilyClient(api_key=TAVILY_API_KEY)
            except Exception as e:
                logger.warning("Tavily client init failed: %s", e)

    def _available(self) -> bool:
        return self._client is not None

    async def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        if not self._available():
            logger.warning("Tavily not configured — returning empty search results")
            return []

        try:
            response = await asyncio.to_thread(
                self._client.search,
                query=query,
                max_results=max_results,
                include_raw_content=False,
                search_depth="advanced",
            )
            results = []
            for r in response.get("results", []):
                domain = urlparse(r.get("url", "")).netloc.lstrip("www.")
                results.append(SearchResult(
                    title=r.get("title", ""),
                    url=r.get("url", ""),
                    snippet=r.get("content", ""),
                    content=r.get("raw_content", "") or r.get("content", ""),
                    domain=domain,
                    score=r.get("score", 0.0),
                    published_date=r.get("published_date"),
                ))
            return results
        except Exception as e:
            logger.error("Tavily search failed for query %r: %s", query[:80], e)
            return []

    async def extract(self, url: str) -> str:
        """Fetch and extract the main content of a URL via Tavily /extract."""
        if not self._available():
            return ""
        try:
            response = await asyncio.to_thread(
                self._client.extract,
                urls=[url],
            )
            results = response.get("results", [])
            if results:
                return results[0].get("raw_content", "")
            return ""
        except Exception as e:
            logger.error("Tavily extract failed for %s: %s", url, e)
            return ""


# Module-level singleton
tavily = TavilyProvider()
