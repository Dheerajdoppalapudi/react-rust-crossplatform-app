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

import os
import re
import time
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any

# How many times to retry a 429 before giving up
_MAX_RETRIES = 3

# Regex to pull the suggested wait time out of OpenAI's error message:
# "Please try again in 4.934s."
_WAIT_RE = re.compile(r'try again in ([\d.]+)s', re.IGNORECASE)


# ---------------------------------------------------------------------------
# Base interface
# ---------------------------------------------------------------------------

class LLMProvider(ABC):
    """Every provider must implement a single method: complete(messages) → str."""

    @abstractmethod
    def complete(self, messages: List[Dict[str, str]], **kwargs) -> Optional[str]:
        """
        Send a list of {"role": ..., "content": ...} messages and return
        the assistant's reply text, or None on failure.
        """


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
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4.1")

    def complete(self, messages: List[Dict[str, str]], **kwargs) -> Optional[str]:
        from openai import OpenAI, RateLimitError
        client = OpenAI()  # reads OPENAI_API_KEY from env automatically

        for attempt in range(_MAX_RETRIES):
            try:
                response = client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    **kwargs,
                )
                return response.choices[0].message.content

            except RateLimitError as e:
                if attempt == _MAX_RETRIES - 1:
                    print(f"[OpenAIProvider] Rate limit — all {_MAX_RETRIES} retries exhausted: {e}")
                    return None
                # OpenAI tells us exactly how long to wait in the error message.
                # Parse it; fall back to an increasing fixed delay if not found.
                match = _WAIT_RE.search(str(e))
                wait = (float(match.group(1)) + 0.5) if match else (5.0 * (attempt + 1))
                print(f"[OpenAIProvider] Rate limit — waiting {wait:.1f}s then retry {attempt + 1}/{_MAX_RETRIES - 1}")
                time.sleep(wait)

            except Exception as e:
                print(f"[OpenAIProvider] Request failed: {e}")
                return None

        return None


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
        self.model = model or os.getenv("CLAUDE_MODEL", "claude-opus-4-6")

    def complete(self, messages: List[Dict[str, str]], **kwargs) -> Optional[str]:
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
            return response.content[0].text
        except Exception as e:
            print(f"[ClaudeProvider] Request failed: {e}")
            return None


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
    ) -> Optional[Any]:
        """Send a chat-style message list, return the reply text or None."""
        return self.provider.complete(messages, **kwargs)

    def make_single_prompt_request(self, prompt: str, **kwargs) -> Optional[Any]:
        """Send a single user prompt string, return the reply text or None."""
        messages = [{"role": "user", "content": prompt}]
        return self.provider.complete(messages, **kwargs)

    def make_system_user_request(
        self,
        system_prompt: str,
        user_prompt: str,
        **kwargs,
    ) -> Optional[Any]:
        """Send a system + user message pair, return the reply text or None."""
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
#   default_llm_service = LLMService(provider=OpenAIProvider(model="gpt-4o"))
# ---------------------------------------------------------------------------

default_llm_service = LLMService(provider=OpenAIProvider())
