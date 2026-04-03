"""
LLM Service — centralized, provider-swappable LLM client.

Architecture:
  - LLMProvider (base)  — defines the interface every provider must implement
  - OpenAIProvider      — calls OpenAI Chat Completions API (current default)
  - ClaudeProvider      — Anthropic Claude (drop-in swap, uncomment to use)
  - LLMService          — thin wrapper used across the app; delegates to a provider

To switch providers, change the `provider=` argument when constructing
`default_llm_service` at the bottom of this file.

Public API (unchanged — all callers continue to work):
  llm_service.make_completion_request(messages)
  llm_service.make_single_prompt_request(prompt)
  llm_service.make_system_user_request(system_prompt, user_prompt)
"""

import logging
import re
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# How many times to retry a 429 before giving up
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
# OpenAI provider (active)
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
# Claude provider (swap-in ready)
# ---------------------------------------------------------------------------

class ClaudeProvider(LLMProvider):
    """
    Calls Anthropic Claude API.

    To activate: pip install anthropic  +  set ANTHROPIC_API_KEY in .env
    Then change default_llm_service below to use ClaudeProvider().
    """

    def __init__(self, model: str = None):
        from core.config import CLAUDE_MODEL
        self.model = model or CLAUDE_MODEL

    def complete(self, messages: List[Dict[str, str]], **kwargs) -> tuple[Optional[str], dict]:
        try:
            import anthropic
            client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

            # Anthropic separates system prompt from the messages list
            system = next(
                (m["content"] for m in messages if m["role"] == "system"), None
            )
            user_messages = [m for m in messages if m["role"] != "system"]

            create_kwargs = {
                "model": self.model,
                "max_tokens": kwargs.get("max_tokens", 4096),
                "messages": user_messages,
            }
            if system:
                create_kwargs["system"] = system

            response = client.messages.create(**create_kwargs)
            usage = response.usage
            usage_dict = {
                "prompt_tokens":     usage.input_tokens,
                "completion_tokens": usage.output_tokens,
                "total_tokens":      usage.input_tokens + usage.output_tokens,
            } if usage else {}
            return response.content[0].text, usage_dict
        except Exception as e:
            logger.error("ClaudeProvider request failed: %s", e)
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

    def make_single_prompt_request(self, prompt: str, **kwargs) -> tuple[Optional[Any], dict]:
        """Send a single user prompt string, return (reply_text, usage_dict)."""
        messages = [{"role": "user", "content": prompt}]
        return self.provider.complete(messages, **kwargs)

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
