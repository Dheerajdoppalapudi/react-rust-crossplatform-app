"""
pgvector-backed vector store for per-conversation source embeddings.

Embeds Tavily search results using OpenAI text-embedding-3-small and stores them
in the shared `source_embeddings` table (PostgreSQL + the pgvector extension).
Used so follow-up queries can retrieve semantically relevant prior sources without
re-searching Tavily.

Why pgvector instead of the previous local ChromaDB:
  - ChromaDB's on-disk store lives on one box and cannot be shared across multiple
    web instances or the video worker fleet. A single Postgres table can.
  - Reuses the existing RDS Postgres + asyncpg pool — one fewer system to operate.
  - Cleanup on conversation delete is a trivial `DELETE WHERE conversation_id = ...`.

Degrades gracefully: if the OpenAI embedding API or the DB/extension is unavailable,
all functions no-op / return empty and log a warning — the pipeline continues
without vector retrieval.

These functions are ``async`` (asyncpg is native async). Call them directly with
``await`` — do NOT wrap them in ``asyncio.to_thread``. Only the OpenAI embedding
call is synchronous, and it is offloaded internally via ``asyncio.to_thread``.
"""

import asyncio
import hashlib
import structlog
import threading
from typing import Optional

from core.config import EMBEDDING_MODEL
from core.db_async import get_async_db, get_async_db_read

logger = structlog.get_logger(__name__)

_openai_client = None
_openai_lock   = threading.Lock()


# ── OpenAI embedding client (lazy, thread-safe) ────────────────────────────────

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
            logger.warning("openai_embeddings_unavailable", error=str(exc))
    return _openai_client


def _embed(texts: list[str]) -> Optional[list[list[float]]]:
    """
    Return embeddings for a list of texts, or None on failure.

    Synchronous — the OpenAI SDK call blocks, so callers must invoke this via
    ``asyncio.to_thread(_embed, ...)`` from async code.
    """
    oai = _get_openai()
    if not oai or not texts:
        return None
    try:
        resp = oai.embeddings.create(model=EMBEDDING_MODEL, input=texts)
        return [item.embedding for item in resp.data]
    except Exception as exc:
        logger.warning("embedding_failed", error=str(exc))
        return None


def _source_id(url: str) -> str:
    """Stable per-URL ID — gives upsert semantics for a repeated URL in a conversation."""
    return hashlib.sha256(url.encode()).hexdigest()[:16]


# ── Public API ────────────────────────────────────────────────────────────────

async def upsert_sources(conversation_id: str, sources: list[dict]) -> None:
    """
    Embed and upsert source dicts into the shared source_embeddings table.

    source dicts must have at least: url, title, snippet/content.
    Re-seen (conversation_id, url) pairs are updated (upsert semantics).
    """
    if not sources:
        return

    # Truncate to ~500 chars for embedding — semantic similarity needs only a
    # representative excerpt, not the full extracted content (which can be 7000+
    # chars after Tavily extract and would exceed the model's token limit).
    texts = [
        f"{s.get('title', '')} {(s.get('snippet', '') or '')[:500]}"
        for s in sources
    ]
    embeddings = await asyncio.to_thread(_embed, texts)
    if not embeddings:
        return

    rows = [
        (
            conversation_id,
            _source_id(s["url"]),
            s.get("url", ""),
            s.get("title", ""),
            (s.get("snippet", "") or "")[:500],
            s.get("domain", ""),
            float(s.get("score", 0.5)),
            emb,  # encoded to pgvector by the registered asyncpg codec
        )
        for s, emb in zip(sources, embeddings)
    ]

    try:
        async with get_async_db() as conn:
            await conn.executemany(
                """
                INSERT INTO source_embeddings
                    (conversation_id, source_id, url, title, snippet, domain, score, embedding)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (conversation_id, source_id) DO UPDATE SET
                    url       = EXCLUDED.url,
                    title     = EXCLUDED.title,
                    snippet   = EXCLUDED.snippet,
                    domain    = EXCLUDED.domain,
                    score     = EXCLUDED.score,
                    embedding = EXCLUDED.embedding
                """,
                rows,
            )
        logger.info("vector_store_upsert", conv=conversation_id[:8], n=len(sources))
    except Exception as exc:
        logger.warning("pgvector_upsert_failed", error=str(exc))


async def retrieve_sources(
    conversation_id: str,
    query: str,
    top_k: int = 8,
    distance_threshold: float = 0.5,
) -> list[dict]:
    """
    Retrieve semantically relevant sources for a query from this conversation's
    embeddings, ordered by cosine distance (pgvector `<=>` operator).

    Only returns results with cosine distance < distance_threshold (0 = identical,
    1 = orthogonal). Results beyond the threshold are discarded so irrelevant
    sources from prior turns never pollute a different-topic follow-up.

    Returns an empty list if embeddings are unavailable or nothing is stored yet.
    """
    embeddings = await asyncio.to_thread(_embed, [query])
    if not embeddings:
        return []
    q_emb = embeddings[0]

    try:
        async with get_async_db_read() as conn:
            rows = await conn.fetch(
                """
                SELECT url, title, snippet, domain, score,
                       embedding <=> $2 AS distance
                FROM source_embeddings
                WHERE conversation_id = $1
                ORDER BY embedding <=> $2
                LIMIT $3
                """,
                conversation_id, q_emb, top_k,
            )

        sources = [
            {
                "url":     r["url"],
                "title":   r["title"],
                "snippet": r["snippet"],
                "domain":  r["domain"],
                "score":   float(r["score"]),
            }
            for r in rows
            if r["distance"] is not None and r["distance"] <= distance_threshold
        ]

        logger.info("vector_store_retrieve",
                    conv=conversation_id[:8], query=query[:60],
                    found=len(sources), threshold=distance_threshold)
        return sources
    except Exception as exc:
        logger.debug("pgvector_retrieve_skipped", error=str(exc))
        return []


async def delete_conversation_embeddings(conversation_id: str) -> None:
    """Hard-delete all embeddings for a conversation (called on conversation delete)."""
    try:
        async with get_async_db() as conn:
            await conn.execute(
                "DELETE FROM source_embeddings WHERE conversation_id = $1",
                conversation_id,
            )
    except Exception as exc:
        logger.warning("pgvector_delete_failed", conv=conversation_id[:8], error=str(exc))
