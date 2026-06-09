"""
Shared pytest fixtures for the Paralyte backend test suite.

Fixtures:
  db_pool   — session-scoped asyncpg pool + schema init (skips if no DATABASE_URL)
  clean_db  — truncates all tables after each test for isolation
  mock_llm  — LLMService whose provider returns a canned response
  mock_tavily — patches the tavily singleton to return canned SearchResults
"""

import asyncio
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio

sys.path.insert(0, str(Path(__file__).parent.parent))

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-at-least-32-chars-long!!")

_DB_AVAILABLE = bool(os.getenv("DATABASE_URL"))


@pytest_asyncio.fixture(scope="session")
async def db_pool():
    """
    Session-scoped pool — initialised once, shared across all DB tests.
    Skips the entire session if DATABASE_URL is not set.
    """
    if not _DB_AVAILABLE:
        pytest.skip("DATABASE_URL not set — skipping DB tests")

    from core.db_async import init_pool, close_pool, init_db
    await init_pool()
    await init_db()
    yield
    await close_pool()


@pytest_asyncio.fixture()
async def clean_db(db_pool):
    """
    Truncate all tables after each test so tests don't bleed into each other.
    The db_pool dependency ensures the pool is initialised before we run.
    """
    yield
    from core.db_async import _get_pool
    async with _get_pool().acquire() as conn:
        await conn.execute(
            "TRUNCATE users, refresh_tokens, conversations, "
            "sessions, conversation_notes CASCADE"
        )


@pytest.fixture()
def mock_llm():
    """
    Returns an LLMService whose provider always returns ("canned response", {}).
    Set provider.response inside a test to change the return value.
    """
    from services.llm_service import LLMService, LLMProvider

    class _StubProvider(LLMProvider):
        def __init__(self):
            self.response = '{"ok": true}'

        def complete(self, messages, **kwargs):
            return self.response, {
                "prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15
            }

    provider = _StubProvider()
    service = LLMService(provider=provider)
    service._stub_provider = provider
    return service


@pytest.fixture()
def mock_tavily():
    """
    Patches services.research.search_provider.tavily so Tavily is never called.
    Yields the canned result list — mutate it inside tests to control results.
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
