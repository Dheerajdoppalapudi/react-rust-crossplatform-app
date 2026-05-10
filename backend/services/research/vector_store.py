"""
ChromaDB vector store for per-conversation source embeddings.

Embeds Tavily search results using OpenAI text-embedding-3-small and stores them
in a per-conversation ChromaDB collection. Used so follow-up queries can retrieve
semantically relevant prior sources without re-searching Tavily.

Degrades gracefully: if ChromaDB or the OpenAI embedding API is unavailable,
all functions return empty results and log a warning — the pipeline continues
without vector retrieval.
"""

import hashlib
import logging
import threading
from typing import Optional

from core.config import CHROMADB_PATH, EMBEDDING_MODEL

logger = logging.getLogger(__name__)

_client        = None
_openai_client = None
_client_lock   = threading.Lock()
_openai_lock   = threading.Lock()


# ── Lazy initialisation ───────────────────────────────────────────────────────

def _get_client():
    global _client
    if _client is not None:
        return _client
    with _client_lock:
        if _client is not None:
            return _client
        try:
            import chromadb
            CHROMADB_PATH.mkdir(parents=True, exist_ok=True)
            _client = chromadb.PersistentClient(path=str(CHROMADB_PATH))
        except Exception as exc:
            logger.warning("ChromaDB unavailable: %s", exc)
    return _client


def _get_openai():
    global _openai_client
    if _openai_client is not None:
        return _openai_client
    with _openai_lock:
        if _openai_client is not None:
            return _openai_client
        try:
            from openai import OpenAI
            _openai_client = OpenAI()
        except Exception as exc:
            logger.warning("OpenAI client unavailable for embeddings: %s", exc)
    return _openai_client


def _embed(texts: list[str]) -> Optional[list[list[float]]]:
    """Return embeddings for a list of texts, or None on failure."""
    oai = _get_openai()
    if not oai or not texts:
        return None
    try:
        resp = oai.embeddings.create(
            model=EMBEDDING_MODEL,
            input=texts,
        )
        return [item.embedding for item in resp.data]
    except Exception as exc:
        logger.warning("Embedding call failed: %s", exc)
        return None


def _collection_name(conversation_id: str) -> str:
    return f"conv_{conversation_id}"


def _source_id(url: str) -> str:
    """Stable document ID from URL — avoids duplicate upserts."""
    return hashlib.sha256(url.encode()).hexdigest()[:16]


# ── Public API ────────────────────────────────────────────────────────────────

def upsert_sources(conversation_id: str, sources: list[dict]) -> None:
    """
    Embed and upsert source dicts into the conversation's ChromaDB collection.

    source dicts must have at least: url, title, snippet/content.
    Already-present URLs are updated (upsert semantics).
    """
    if not sources:
        return
    client = _get_client()
    if not client:
        return

    texts = [
        f"{s.get('title', '')} {s.get('content', '') or s.get('snippet', '')}"
        for s in sources
    ]
    embeddings = _embed(texts)
    if not embeddings:
        return

    try:
        col = client.get_or_create_collection(_collection_name(conversation_id))
        ids        = [_source_id(s["url"]) for s in sources]
        metadatas  = [
            {
                "url":     s.get("url", ""),
                "title":   s.get("title", ""),
                "snippet": (s.get("snippet", "") or "")[:500],
                "domain":  s.get("domain", ""),
                "score":   float(s.get("score", 0.5)),
            }
            for s in sources
        ]
        col.upsert(ids=ids, embeddings=embeddings, metadatas=metadatas)
        logger.info("vector_store_upsert  conv=%s  n=%d", conversation_id[:8], len(sources))
    except Exception as exc:
        logger.warning("ChromaDB upsert failed: %s", exc)


def retrieve_sources(conversation_id: str, query: str, top_k: int = 8) -> list[dict]:
    """
    Retrieve the top-K semantically relevant sources for a query from the
    conversation's ChromaDB collection.

    Returns a list of source dicts (url, title, snippet, domain, score),
    or empty list if ChromaDB is unavailable or the collection doesn't exist yet.
    """
    client = _get_client()
    if not client:
        return []

    embeddings = _embed([query])
    if not embeddings:
        return []

    try:
        col = client.get_collection(_collection_name(conversation_id))
        results = col.query(
            query_embeddings=embeddings,
            n_results=min(top_k, col.count()),
            include=["metadatas", "distances"],
        )
        sources = []
        for meta in (results.get("metadatas") or [[]])[0]:
            sources.append({
                "url":     meta.get("url", ""),
                "title":   meta.get("title", ""),
                "snippet": meta.get("snippet", ""),
                "domain":  meta.get("domain", ""),
                "score":   float(meta.get("score", 0.5)),
            })
        logger.info("vector_store_retrieve  conv=%s  query=%r  found=%d",
                    conversation_id[:8], query[:60], len(sources))
        return sources
    except Exception as exc:
        logger.debug("ChromaDB retrieve skipped: %s", exc)
        return []
