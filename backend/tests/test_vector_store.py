"""
Tests for services/research/vector_store.py.

Tests thread-safe init, full UUID collection names, and graceful degradation
when ChromaDB or OpenAI embeddings are unavailable.
"""

import threading
import uuid
from unittest.mock import MagicMock, patch

import pytest


def _reset_singletons():
    """Reset module-level singletons between tests."""
    import services.research.vector_store as vs
    vs._client = None
    vs._openai_client = None


@pytest.fixture(autouse=True)
def reset_singletons():
    _reset_singletons()
    yield
    _reset_singletons()


def test_collection_name_uses_full_uuid():
    from services.research.vector_store import _collection_name
    conv_id = uuid.uuid4().hex  # 32 chars
    name = _collection_name(conv_id)
    assert conv_id in name
    assert len(name) > 32  # prefix + full id


def test_collection_name_long_uuid_not_truncated():
    from services.research.vector_store import _collection_name
    long_id = str(uuid.uuid4())  # 36 chars with dashes
    name = _collection_name(long_id)
    assert long_id in name


def test_upsert_sources_returns_gracefully_without_chromadb():
    """If ChromaDB is not available, upsert should log a warning and not raise."""
    with patch("services.research.vector_store._get_client", return_value=None):
        from services.research.vector_store import upsert_sources
        # Should not raise
        upsert_sources("conv123", [{"url": "https://x.com", "title": "T", "snippet": "S"}])


def test_retrieve_sources_returns_empty_without_chromadb():
    with patch("services.research.vector_store._get_client", return_value=None):
        from services.research.vector_store import retrieve_sources
        result = retrieve_sources("conv123", "some query")
        assert result == []


def test_embed_returns_none_without_openai():
    with patch("services.research.vector_store._get_openai", return_value=None):
        from services.research.vector_store import _embed
        result = _embed(["hello world"])
        assert result is None


def test_get_client_thread_safe_init():
    """Two threads calling _get_client simultaneously must not double-initialize."""
    init_count = {"n": 0}

    real_import = __builtins__  # keep reference

    def _fake_persistent_client(path):
        init_count["n"] += 1
        return MagicMock()

    with patch("services.research.vector_store._client", None):
        import services.research.vector_store as vs
        vs._client = None

        with patch("chromadb.PersistentClient", side_effect=_fake_persistent_client):
            threads = [threading.Thread(target=vs._get_client) for _ in range(10)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        # PersistentClient should have been called at most once (double-checked lock)
        assert init_count["n"] <= 1
