"""
Unit tests for _extract_json in services/frame_generation/planner.py.

Tests that the fence-first extraction works and the brace-scan fallback
handles edge cases without silently returning the wrong object.
"""

import pytest

from services.frame_generation.planner import _extract_json


def test_plain_json():
    text = '{"intent": "math", "frames": []}'
    result = _extract_json(text)
    assert result["intent"] == "math"


def test_json_in_markdown_fence():
    text = '```json\n{"intent": "process", "frames": [1, 2]}\n```'
    result = _extract_json(text)
    assert result["intent"] == "process"
    assert result["frames"] == [1, 2]


def test_fence_without_json_label():
    text = '```\n{"intent": "illustration"}\n```'
    result = _extract_json(text)
    assert result["intent"] == "illustration"


def test_narrative_before_json():
    text = 'Here is your plan:\n{"intent": "comparison", "frames": []}'
    result = _extract_json(text)
    assert result["intent"] == "comparison"


def test_trailing_commas_stripped():
    text = '{"intent": "math", "frames": [1, 2,],}'
    result = _extract_json(text)
    assert result["intent"] == "math"


def test_no_json_raises():
    with pytest.raises(ValueError, match="No JSON"):
        _extract_json("This response has no JSON at all.")


def test_nested_json_returns_outermost():
    text = '{"outer": true, "inner": {"key": "value"}}'
    result = _extract_json(text)
    assert result["outer"] is True
    assert result["inner"]["key"] == "value"


def test_fence_preferred_over_inline_brace():
    # There's a bare { earlier in the text, but the fence has the real object
    text = 'Note: {bad} stuff\n```json\n{"intent": "timeline"}\n```'
    result = _extract_json(text)
    assert result["intent"] == "timeline"
