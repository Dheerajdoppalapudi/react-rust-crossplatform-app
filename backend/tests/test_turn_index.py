"""
Tests for the atomic turn_index assignment in core.db_async.insert_session().

Verifies that concurrent follow-up insertions into the same conversation
produce unique, monotonically-increasing turn_index values.
Uses asyncio.gather() to exercise the same atomicity as real concurrent requests.
"""

import asyncio
import uuid

import pytest

from core.db_async import insert_session


def _conv():
    return uuid.uuid4().hex


def _sid():
    return uuid.uuid4().hex


async def test_first_session_gets_turn_index_1(clean_db):
    conv_id = _conv()
    idx = await insert_session(_sid(), "hello", conv_id, turn_index=1, user_id="user1")
    assert idx == 1


async def test_follow_up_increments_turn_index(clean_db):
    conv_id = _conv()

    idx1 = await insert_session(_sid(), "q1", conv_id, turn_index=1, user_id="user1")
    idx2 = await insert_session(_sid(), "q2", conv_id, user_id="user1")

    assert idx1 == 1
    assert idx2 == 2


async def test_concurrent_inserts_produce_unique_turn_indexes(clean_db):
    conv_id = _conv()

    # Seed turn 1 first so the conversation exists
    await insert_session(_sid(), "seed", conv_id, turn_index=1, user_id="userX")

    # Fire 5 concurrent follow-ups — the MAX()+1 subquery must serialise correctly
    results = await asyncio.gather(*[
        insert_session(_sid(), "concurrent q", conv_id, user_id="userX")
        for _ in range(5)
    ])

    assert len(set(results)) == len(results), f"Duplicate turn_indexes: {results}"
    assert all(r > 1 for r in results)
