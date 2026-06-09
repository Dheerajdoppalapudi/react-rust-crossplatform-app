"""
Tests for services/research/vector_store.py (pgvector backend).

Covers stable source IDs and graceful degradation when the OpenAI embedding API
is unavailable — in that case upsert is a no-op and retrieve returns [] without
ever touching the database.
"""

from unittest.mock import patch

import pytest


def _reset_singletons():
    """Reset module-level singletons between tests."""
    import services.research.vector_store as vs
    vs._openai_client = None


@pytest.fixture(autouse=True)
def reset_singletons():
    _reset_singletons()
    yield
    _reset_singletons()


def test_source_id_is_stable_and_short():
    from services.research.vector_store import _source_id
    a = _source_id("https://example.com/page")
    b = _source_id("https://example.com/page")
    c = _source_id("https://example.com/other")
    assert a == b              # deterministic
    assert a != c              # distinct URLs → distinct ids
    assert len(a) == 16        # truncated sha256


def test_embed_returns_none_without_openai():
    with patch("services.research.vector_store._get_openai", return_value=None):
        from services.research.vector_store import _embed
        assert _embed(["hello world"]) is None


@pytest.mark.asyncio
async def test_upsert_sources_noop_without_embeddings():
    """If embeddings are unavailable, upsert must not raise and must not hit the DB."""
    with patch("services.research.vector_store._get_openai", return_value=None):
        from services.research.vector_store import upsert_sources
        # Should return cleanly; if it tried the DB without a pool it would raise.
        await upsert_sources(
            "conv123", [{"url": "https://x.com", "title": "T", "snippet": "S"}]
        )


@pytest.mark.asyncio
async def test_upsert_sources_empty_list_is_noop():
    from services.research.vector_store import upsert_sources
    await upsert_sources("conv123", [])  # must not raise


@pytest.mark.asyncio
async def test_retrieve_sources_empty_without_embeddings():
    with patch("services.research.vector_store._get_openai", return_value=None):
        from services.research.vector_store import retrieve_sources
        assert await retrieve_sources("conv123", "some query") == []
