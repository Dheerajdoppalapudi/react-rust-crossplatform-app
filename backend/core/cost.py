"""
Per-session LLM cost computation.

A session's lifecycle log (request_log) contains one `llm_call` entry per LLM
request, each carrying a `model` string and a `usage` dict. This module walks
that log and converts token counts into a USD figure using MODEL_PRICING from
core.config.

Usage:
    from core.cost import compute_session_cost
    cost_usd = compute_session_cost(lifecycle_log)

Token accounting:
  - prompt_tokens      → input rate   (for Anthropic this is the UNcached input;
                         cache tokens are reported separately below)
  - completion_tokens  → output rate
  - cache_creation_input_tokens → cache_write rate (Anthropic only; else 0)
  - cache_read_input_tokens     → cache_read  rate (Anthropic only; else 0)
"""

import structlog

from core.config import MODEL_PRICING

logger = structlog.get_logger(__name__)


def _rates_for(model: str) -> dict | None:
    """Return the pricing dict for a model, falling back to a prefix match.

    A prefix match handles dated/versioned model IDs (e.g. a future
    'claude-haiku-4-5-2026xxxx') without needing an exact table entry.
    """
    if not model:
        return None
    exact = MODEL_PRICING.get(model)
    if exact:
        return exact
    for known, rates in MODEL_PRICING.items():
        if model.startswith(known) or known.startswith(model):
            return rates
    return None


def cost_for_usage(model: str, usage: dict) -> float:
    """Compute the USD cost of a single LLM call from its model + usage dict."""
    rates = _rates_for(model)
    if not rates or not usage:
        return 0.0

    input_rate  = rates["input"]
    output_rate = rates["output"]
    # Default cache rates to the Anthropic convention if not explicitly set.
    cache_write_rate = rates.get("cache_write", input_rate * 1.25)
    cache_read_rate  = rates.get("cache_read",  input_rate * 0.1)

    micro = (
        usage.get("prompt_tokens", 0)               * input_rate
        + usage.get("completion_tokens", 0)          * output_rate
        + usage.get("cache_creation_input_tokens", 0) * cache_write_rate
        + usage.get("cache_read_input_tokens", 0)     * cache_read_rate
    )
    return micro / 1_000_000.0


def compute_session_cost(lifecycle_log: list) -> float:
    """
    Sum the USD cost of every `llm_call` entry in a session's lifecycle log.

    Unknown models (no pricing entry) contribute 0 and are logged once so the
    pricing table can be kept current. Returns a value rounded to 6 decimals.
    """
    if not lifecycle_log:
        return 0.0

    total = 0.0
    unknown: set[str] = set()
    for entry in lifecycle_log:
        if entry.get("event") not in ("llm_call", "llm_call_fast"):
            continue
        usage = entry.get("usage") or {}
        model = entry.get("model") or ""
        if _rates_for(model) is None:
            if model:
                unknown.add(model)
            continue
        total += cost_for_usage(model, usage)

    if unknown:
        logger.warning("cost_unknown_models", models=sorted(unknown))

    return round(total, 6)
