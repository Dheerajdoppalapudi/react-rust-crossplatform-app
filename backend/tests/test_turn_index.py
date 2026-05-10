"""
Tests for the atomic turn_index assignment in core/database.py insert_session().

Verifies that concurrent follow-up insertions into the same conversation
produce unique, monotonically-increasing turn_index values.
"""

import threading
import uuid

import pytest

from core.database import init_db, insert_session, get_db


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    """Each test gets a fresh in-memory-style SQLite DB."""
    import core.config as cfg
    cfg.DB_PATH = tmp_path / "test.sqlite"
    init_db()
    yield
    cfg.DB_PATH = None  # let next fixture set it


def _make_conv():
    return uuid.uuid4().hex


def _make_session():
    return uuid.uuid4().hex


def test_first_session_gets_turn_index_1(tmp_path):
    conv_id = _make_conv()
    user_id = "user1"
    sid = _make_session()
    idx = insert_session(sid, "hello", conv_id, turn_index=1, user_id=user_id, parent_session_id=None)
    assert idx == 1


def test_follow_up_increments_turn_index(tmp_path):
    conv_id = _make_conv()
    user_id = "user1"

    sid1 = _make_session()
    idx1 = insert_session(sid1, "q1", conv_id, turn_index=1, user_id=user_id, parent_session_id=None)

    sid2 = _make_session()
    idx2 = insert_session(sid2, "q2", conv_id, user_id=user_id, parent_session_id=None)

    assert idx1 == 1
    assert idx2 == 2


def test_concurrent_inserts_produce_unique_turn_indexes(tmp_path):
    conv_id = _make_conv()
    user_id = "userX"
    results: list[int] = []
    errors: list[Exception] = []

    # First session must be inserted before concurrent follow-ups so conv exists
    sid0 = _make_session()
    insert_session(sid0, "seed", conv_id, turn_index=1, user_id=user_id, parent_session_id=None)

    def _insert():
        try:
            sid = _make_session()
            idx = insert_session(sid, "concurrent q", conv_id, user_id=user_id, parent_session_id=None)
            results.append(idx)
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=_insert) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors, f"Errors during concurrent insert: {errors}"
    # All turn_indexes must be unique
    assert len(set(results)) == len(results), f"Duplicate turn_indexes: {results}"
    # All must be > 1 (seed was 1)
    assert all(r > 1 for r in results)
