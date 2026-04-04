"""
Standard API response helpers.

Every non-file, non-streaming endpoint returns one of these two shapes:

  Success: { "status": "success", "data": <payload> }
  Error:   { "status": "error",   "error": "<message>" }

Use success() in route handlers to wrap payloads.
Error responses are produced automatically by the exception handlers in main.py.
"""

from typing import Any


def success(data: Any) -> dict:
    """Wrap a payload in the standard success envelope."""
    return {"status": "success", "data": data}
