"""
Tests for path traversal prevention in core/utils.py safe_resolve().
"""

import os
import tempfile
from pathlib import Path

import pytest
from fastapi import HTTPException

import core.config as cfg
from core.utils import safe_resolve


@pytest.fixture(autouse=True)
def patch_outputs_dir(tmp_path, monkeypatch):
    """Point OUTPUTS_DIR at a temp directory so tests don't touch real files."""
    monkeypatch.setattr(cfg, "OUTPUTS_DIR", tmp_path)
    # Also patch the module-level default in utils (it captures the value at import time)
    import core.utils as utils_mod
    monkeypatch.setattr(utils_mod, "safe_resolve",
                        lambda p, base=tmp_path, label="resource": safe_resolve(p, base=base, label=label))
    return tmp_path


def test_valid_path_inside_base(tmp_path):
    target = tmp_path / "session123" / "output.json"
    target.parent.mkdir(parents=True)
    target.touch()
    resolved = safe_resolve(str(target), base=str(tmp_path))
    assert resolved == target.resolve()


def test_traversal_attempt_blocked(tmp_path):
    evil = str(tmp_path) + "/../../etc/passwd"
    with pytest.raises(HTTPException) as exc_info:
        safe_resolve(evil, base=str(tmp_path))
    assert exc_info.value.status_code == 403


def test_none_path_raises_404(tmp_path):
    with pytest.raises(HTTPException) as exc_info:
        safe_resolve(None, base=str(tmp_path))
    assert exc_info.value.status_code == 404


def test_empty_string_raises_404(tmp_path):
    with pytest.raises(HTTPException) as exc_info:
        safe_resolve("", base=str(tmp_path))
    assert exc_info.value.status_code == 404


def test_symlink_traversal_blocked(tmp_path):
    outside = tmp_path.parent / "secret.txt"
    outside.write_text("secret")
    link = tmp_path / "link.txt"
    link.symlink_to(outside)
    with pytest.raises(HTTPException) as exc_info:
        safe_resolve(str(link), base=str(tmp_path))
    assert exc_info.value.status_code == 403


def test_exact_base_dir_allowed(tmp_path):
    resolved = safe_resolve(str(tmp_path), base=str(tmp_path))
    assert resolved == tmp_path.resolve()
