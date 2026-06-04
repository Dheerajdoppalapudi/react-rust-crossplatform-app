"""
Tavily search + extract abstraction.

All web access in the research pipeline flows through this module.
Swap out TavilyProvider for a different class to change providers.
"""

import asyncio
import structlog
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse

from core.config import TAVILY_API_KEY

logger = structlog.get_logger(__name__)


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
                logger.warning("tavily_init_failed", error=str(e))

    def _available(self) -> bool:
        return self._client is not None

    async def search(
        self,
        query: str,
        max_results: int = 5,
        timeout: float = 20.0,
        include_domains: list[str] | None = None,
    ) -> list[SearchResult]:
        if not self._available():
            logger.warning("tavily_not_configured")
            return []

        search_kwargs: dict = {
            "query": query,
            "max_results": max_results,
            "search_depth": "basic",
            "include_raw_content": True,
        }
        if include_domains:
            search_kwargs["include_domains"] = include_domains

        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(self._client.search, **search_kwargs),
                timeout=timeout,
            )
            results = []
            for r in response.get("results", []):
                domain = urlparse(r.get("url", "")).netloc.lstrip("www.")
                snippet = r.get("content") or ""
                raw     = r.get("raw_content") or ""
                # Use full page text when it's richer than the snippet; fall back to snippet.
                content = raw if len(raw) > len(snippet) else snippet
                results.append(SearchResult(
                    title=r.get("title", ""),
                    url=r.get("url", ""),
                    snippet=snippet,   # short AI-extracted excerpt — UI display + citations
                    content=content,   # full page text when available — LLM injection
                    domain=domain,
                    score=r.get("score", 0.0),
                    published_date=r.get("published_date"),
                ))
            logger.info("tavily_search_done", query=query[:80], results=len(results),
                        urls=[r.url for r in results])
            return results
        except asyncio.TimeoutError:
            logger.warning("tavily_search_timeout", timeout_s=timeout, query=query[:80])
            return []
        except Exception as e:
            logger.error("tavily_search_failed", query=query[:80], error=str(e))
            return []

    async def extract(self, url: str, timeout: float = 20.0) -> str:
        """Fetch and extract the main content of a URL via Tavily /extract."""
        if not self._available():
            return ""
        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(self._client.extract, urls=[url]),
                timeout=timeout,
            )
            results = response.get("results", [])
            if results:
                return results[0].get("raw_content", "")
            return ""
        except asyncio.TimeoutError:
            logger.warning("tavily_extract_timeout", timeout_s=timeout, url=url)
            return ""
        except Exception as e:
            logger.error("tavily_extract_failed", url=url, error=str(e))
            return ""


# Module-level singleton
tavily = TavilyProvider()
