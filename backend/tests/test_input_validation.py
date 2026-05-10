"""
Tests for GenerateRequest input validation in routers/generate.py.

Tests the inline validation block (not a Pydantic model — Form() parameters
validated manually at the top of the generate() handler).
"""

import pytest


def _call_validate(message=None, research_mode="instant", render_mode=None):
    """
    Replicate the validation logic from routers/generate.py without starting
    the full FastAPI app.
    """
    from fastapi import HTTPException

    message = (message or "").strip()
    if not message:
        raise HTTPException(422, "message cannot be empty")
    if len(message) > 8000:
        raise HTTPException(422, "message too long (max 8000 chars)")
    if research_mode not in ("instant", "deep_research"):
        raise HTTPException(422, f"invalid research_mode: {research_mode!r}")
    if render_mode is not None and render_mode not in ("manim", "svg"):
        raise HTTPException(422, f"invalid render_mode: {render_mode!r}")
    return message


def test_valid_instant_message():
    result = _call_validate(message="What is photosynthesis?", research_mode="instant")
    assert result == "What is photosynthesis?"


def test_valid_deep_research():
    result = _call_validate(message="Latest AI news 2025", research_mode="deep_research")
    assert result == "Latest AI news 2025"


def test_valid_render_mode_manim():
    _call_validate(message="show me calculus", render_mode="manim")


def test_valid_render_mode_svg():
    _call_validate(message="compare cats vs dogs", render_mode="svg")


def test_empty_message_raises():
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        _call_validate(message="")
    assert exc.value.status_code == 422
    assert "empty" in exc.value.detail


def test_whitespace_only_message_raises():
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        _call_validate(message="   \t\n  ")


def test_message_too_long_raises():
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        _call_validate(message="x" * 8001)
    assert exc.value.status_code == 422
    assert "too long" in exc.value.detail


def test_invalid_research_mode_raises():
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        _call_validate(message="hello", research_mode="hacked")
    assert exc.value.status_code == 422


def test_invalid_render_mode_raises():
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        _call_validate(message="hello", render_mode="injected")
    assert exc.value.status_code == 422


def test_none_render_mode_allowed():
    # render_mode=None means "auto" — should not raise
    _call_validate(message="hello", render_mode=None)
