"""
LLM Service — centralized, provider-swappable LLM client.

Architecture:
  - LLMProvider (base)  — defines the interface every provider must implement
  - OpenAIProvider      — calls OpenAI Chat Completions API
  - ClaudeProvider      — Anthropic Claude (default)
  - LLMService          — thin wrapper used across the app; delegates to a provider

To switch providers, change the `provider=` argument when constructing
`default_llm_service` at the bottom of this file.

Public API (unchanged — all callers continue to work):
  llm_service.make_completion_request(messages)
  llm_service.make_single_prompt_request(prompt, cache_prefix="")
  llm_service.make_system_user_request(system_prompt, user_prompt)

Prompt caching (Anthropic only):
  Pass cache_prefix=<static_template_text> to make_single_prompt_request().
  When set, the message is split into two content blocks — the static prefix
  is marked cache_control=ephemeral so Anthropic reuses it at 10% cost.
  Requires PROMPT_CACHE_ENABLED=true (default) in config.py.
"""

import json
import logging
import re
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# How many times to retry on rate-limit / overload before giving up
_MAX_RETRIES = 3

# Regex to pull the suggested wait time out of OpenAI's error message:
# "Please try again in 4.934s."
_WAIT_RE = re.compile(r'try again in ([\d.]+)s', re.IGNORECASE)


# ---------------------------------------------------------------------------
# Base interface
# ---------------------------------------------------------------------------

class LLMProvider(ABC):
    """Every provider must implement a single method: complete(messages) → (text, usage)."""

    @abstractmethod
    def complete(self, messages: List[Dict[str, str]], **kwargs) -> tuple[Optional[str], dict]:
        """
        Send a list of {"role": ..., "content": ...} messages and return
        (reply_text, usage_dict) where usage_dict has keys:
            prompt_tokens, completion_tokens, total_tokens
        Returns (None, {}) on failure.
        """
        ...  # pragma: no cover


# ---------------------------------------------------------------------------
# OpenAI provider
# ---------------------------------------------------------------------------

class OpenAIProvider(LLMProvider):
    """
    Calls OpenAI Chat Completions API.

    Model defaults to gpt-4.1 — change via the `model` argument or
    the OPENAI_MODEL env variable.

    Reads OPENAI_API_KEY from the environment (set in .env via python-dotenv).
    """

    def __init__(self, model: str = None):
        from core.config import OPENAI_MODEL
        self.model = model or OPENAI_MODEL

    def complete(self, messages: List[Dict[str, str]], **kwargs) -> tuple[Optional[str], dict]:
        from openai import OpenAI, RateLimitError
        client = OpenAI()  # reads OPENAI_API_KEY from env automatically

        # These are Claude-only concepts — discard them silently for OpenAI
        kwargs.pop("cache_prefix", None)
        kwargs.pop("tool_schema", None)
        json_mode: bool = kwargs.pop("json_mode", False)

        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        for attempt in range(_MAX_RETRIES):
            try:
                response = client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    **kwargs,
                )
                usage = response.usage
                usage_dict = {
                    "prompt_tokens":     usage.prompt_tokens,
                    "completion_tokens": usage.completion_tokens,
                    "total_tokens":      usage.total_tokens,
                } if usage else {}
                return response.choices[0].message.content, usage_dict

            except RateLimitError as e:
                if attempt == _MAX_RETRIES - 1:
                    logger.error("OpenAIProvider rate limit — all %d retries exhausted: %s", _MAX_RETRIES, e)
                    return None, {}
                match = _WAIT_RE.search(str(e))
                wait = (float(match.group(1)) + 0.5) if match else (5.0 * (attempt + 1))
                logger.warning(
                    "OpenAIProvider rate limit — waiting %.1fs then retry %d/%d",
                    wait, attempt + 1, _MAX_RETRIES - 1,
                )
                time.sleep(wait)

            except Exception as e:
                logger.error("OpenAIProvider request failed: %s", e)
                return None, {}

        return None, {}


# ---------------------------------------------------------------------------
# Claude provider
# ---------------------------------------------------------------------------

class ClaudeProvider(LLMProvider):
    """
    Calls Anthropic Claude API.

    Requires: pip install anthropic  +  ANTHROPIC_API_KEY in .env

    Features:
      - Exponential-backoff retry on RateLimitError (429) and overload (529)
      - Prompt caching: pass cache_prefix=<static_text> to split the user
        message into a cached block + dynamic block (10× cheaper on cache hits)
    """

    def __init__(self, model: str = None):
        from core.config import CLAUDE_MODEL
        self.model = model or CLAUDE_MODEL

    def complete(self, messages: List[Dict[str, str]], **kwargs) -> tuple[Optional[str], dict]:
        import anthropic
        from core.config import PROMPT_CACHE_ENABLED

        cache_prefix: str = kwargs.pop("cache_prefix", "")
        tool_schema: Optional[dict] = kwargs.pop("tool_schema", None)
        kwargs.pop("json_mode", None)  # Claude uses tool_schema instead

        client = anthropic.Anthropic()

        # Separate system prompt from user/assistant messages
        system = next(
            (m["content"] for m in messages if m["role"] == "system"), None
        )
        user_messages = [m for m in messages if m["role"] != "system"]

        # Build the messages list, optionally splitting the first user message
        # into a cached static block + dynamic block.
        processed_messages = []
        for idx, msg in enumerate(user_messages):
            if (
                idx == 0
                and cache_prefix
                and PROMPT_CACHE_ENABLED
                and msg["role"] == "user"
                and isinstance(msg.get("content"), str)
                and msg["content"].startswith(cache_prefix)
            ):
                dynamic = msg["content"][len(cache_prefix):]
                content: Any = [
                    {
                        "type": "text",
                        "text": cache_prefix,
                        "cache_control": {"type": "ephemeral"},
                    }
                ]
                if dynamic:
                    content.append({"type": "text", "text": dynamic})
                processed_messages.append({"role": "user", "content": content})
            else:
                processed_messages.append(msg)

        create_kwargs: dict = {
            "model":      self.model,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "messages":   processed_messages,
        }
        if system:
            create_kwargs["system"] = system
        if tool_schema:
            create_kwargs["tools"]       = [tool_schema]
            create_kwargs["tool_choice"] = {"type": "tool", "name": tool_schema["name"]}

        for attempt in range(_MAX_RETRIES):
            try:
                response = client.messages.create(**create_kwargs)
                usage = response.usage
                usage_dict = {
                    "prompt_tokens":              usage.input_tokens,
                    "completion_tokens":           usage.output_tokens,
                    "total_tokens":               usage.input_tokens + usage.output_tokens,
                    "cache_creation_input_tokens": getattr(usage, "cache_creation_input_tokens", 0),
                    "cache_read_input_tokens":     getattr(usage, "cache_read_input_tokens", 0),
                } if usage else {}

                # When tool_use is forced, Claude returns the structured data
                # inside a tool_use content block instead of a text block.
                # Extract the input dict and re-serialise to JSON string so
                # the caller always receives a string (guaranteed valid JSON).
                if tool_schema:
                    for block in response.content:
                        if block.type == "tool_use":
                            return json.dumps(block.input), usage_dict
                    # Fallback: no tool_use block found (should not happen with tool_choice forced)
                    logger.warning("ClaudeProvider: tool_schema set but no tool_use block in response")
                    return response.content[0].text, usage_dict

                return response.content[0].text, usage_dict

            except anthropic.RateLimitError as e:
                if attempt == _MAX_RETRIES - 1:
                    logger.error(
                        "ClaudeProvider rate limit — all %d retries exhausted: %s",
                        _MAX_RETRIES, e,
                    )
                    return None, {}
                # Respect the retry-after header when present
                try:
                    wait = float(
                        e.response.headers.get("retry-after", 5.0 * (attempt + 1))
                    )
                except Exception:
                    wait = 5.0 * (attempt + 1)
                logger.warning(
                    "ClaudeProvider rate limit — waiting %.1fs then retry %d/%d",
                    wait, attempt + 1, _MAX_RETRIES - 1,
                )
                time.sleep(wait)

            except anthropic.APIStatusError as e:
                if e.status_code == 529:  # Anthropic overloaded
                    if attempt == _MAX_RETRIES - 1:
                        logger.error(
                            "ClaudeProvider overloaded — all %d retries exhausted",
                            _MAX_RETRIES,
                        )
                        return None, {}
                    wait = 10.0 * (attempt + 1)
                    logger.warning(
                        "ClaudeProvider overloaded (529) — waiting %.1fs then retry %d/%d",
                        wait, attempt + 1, _MAX_RETRIES - 1,
                    )
                    time.sleep(wait)
                else:
                    logger.error(
                        "ClaudeProvider API error  status=%d  error=%s", e.status_code, e
                    )
                    return None, {}

            except Exception as e:
                logger.error("ClaudeProvider request failed: %s", e)
                return None, {}

        return None, {}


# ---------------------------------------------------------------------------
# LLMService — thin wrapper used across the app
# ---------------------------------------------------------------------------

class LLMService:
    """
    Thin facade over an LLMProvider.

    Exposes the same three methods used everywhere in the codebase.
    Swap providers by passing a different LLMProvider to __init__.
    """

    def __init__(self, provider: LLMProvider = None):
        self.provider = provider or OpenAIProvider()

    def make_completion_request(
        self,
        messages: List[Dict[str, str]],
        **kwargs,
    ) -> tuple[Optional[Any], dict]:
        """Send a chat-style message list, return (reply_text, usage_dict)."""
        return self.provider.complete(messages, **kwargs)

    def make_single_prompt_request(
        self,
        prompt: str,
        cache_prefix: str = "",
        tool_schema: Optional[dict] = None,
        json_mode: bool = False,
        **kwargs,
    ) -> tuple[Optional[Any], dict]:
        """
        Send a single user prompt string, return (reply_text, usage_dict).

        cache_prefix: if provided (Claude only), the message is split into a
        cached static block (the prefix) and a dynamic block (the remainder).
        This dramatically reduces cost when the same large template is sent
        multiple times (e.g., once per frame in a multi-frame video).

        tool_schema: if provided (Claude only), forces tool_use with the given
        schema — guarantees the response is valid JSON matching the schema.

        json_mode: if True (OpenAI only), adds response_format=json_object so
        the response is guaranteed to be valid JSON.
        """
        messages = [{"role": "user", "content": prompt}]
        return self.provider.complete(
            messages,
            cache_prefix=cache_prefix,
            tool_schema=tool_schema,
            json_mode=json_mode,
            **kwargs,
        )

    def make_system_user_request(
        self,
        system_prompt: str,
        user_prompt: str,
        **kwargs,
    ) -> tuple[Optional[Any], dict]:
        """Send a system + user message pair, return (reply_text, usage_dict)."""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return self.provider.complete(messages, **kwargs)


# ---------------------------------------------------------------------------
# Default instance — import and use this directly across the application
#
# To switch providers:
#   default_llm_service = LLMService(provider=ClaudeProvider())
#   default_llm_service = LLMService(provider=OpenAIProvider(model="gpt-4.1"))
# ---------------------------------------------------------------------------

default_llm_service = LLMService(provider=ClaudeProvider())
