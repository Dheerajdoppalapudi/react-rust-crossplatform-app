"""
Shared pytest fixtures for the Zenith backend test suite.

Fixtures:
  tmp_db         — isolated SQLite DB with schema initialized
  async_client   — AsyncTestClient wired to the FastAPI app
  mock_llm       — LLMService whose provider returns a canned response
  mock_tavily    — patches the tavily singleton to return canned SearchResults
"""

import asyncio
import os
import sys
import tempfile
from pathlib import Path
from typing import Generator
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio

# Make sure the backend package root is on sys.path when running from backend/
sys.path.insert(0, str(Path(__file__).parent.parent))

# Set a dummy JWT secret so config.py doesn't raise at import time
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-at-least-32-chars-long!!")


@pytest.fixture(scope="session")
def event_loop():
    """Use a single event loop for the whole test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture()
def tmp_db(tmp_path, monkeypatch):
    """
    Redirect DB_PATH to a temporary file and run init_db() on it.
    Each test gets its own empty database.
    """
    db_file = tmp_path / "test.sqlite"
    monkeypatch.setenv("DB_PATH", str(db_file))

    # Patch the module-level constant before importing database
    import core.config as cfg
    original = cfg.DB_PATH
    cfg.DB_PATH = db_file

    from core.database import init_db
    init_db()

    yield db_file

    cfg.DB_PATH = original


@pytest.fixture()
def mock_llm():
    """
    Returns an LLMService whose provider always returns ("canned response", {}).
    Swap provider.response to change the return value inside a test.
    """
    from services.llm_service import LLMService, LLMProvider

    class _StubProvider(LLMProvider):
        def __init__(self):
            self.response = '{"ok": true}'

        def complete(self, messages, **kwargs):
            return self.response, {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}

    provider = _StubProvider()
    service = LLMService(provider=provider)
    service._stub_provider = provider
    return service


@pytest.fixture()
def mock_tavily():
    """
    Patches services.research.search_provider.tavily so Tavily is never called.
    Returns a list of dicts you can mutate in tests to control search results.
    """
    from services.research.search_provider import SearchResult

    canned: list[SearchResult] = [
        SearchResult(
            title="Test Source",
            url="https://example.com/test",
            snippet="This is a test snippet.",
            content="Full test content goes here.",
            domain="example.com",
            score=0.9,
        )
    ]

    mock = MagicMock()
    mock.search = MagicMock(return_value=canned)
    mock.extract = MagicMock(return_value="")

    with patch("services.research.search_provider.tavily", mock):
        yield canned
