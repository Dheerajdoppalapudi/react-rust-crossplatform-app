import json
import re
import requests
from typing import Dict, List, Optional, Any


class LLMService:
    """
    Service class for handling LLM interactions with the custom server.
    Provides a centralized way to make LLM calls across the application.
    """

    def __init__(
        self,
        server_ip: str = "100.74.2.7",
        server_port: str = "8000",
        model: str = "aws-bedrock.claude4-sonnet",
        user_credentials: Dict[str, str] = None,
    ):
        """
        Initialize the LLM service with server configuration.

        Args:
            server_ip:          IP address of the LLM server
            server_port:        Port of the LLM server
            model:              Model name to use for requests
            user_credentials:   User credentials for authentication
        """
        self.server_ip = server_ip
        self.server_port = server_port
        self.model = model
        self.user_credentials = user_credentials or {"id": "e692280", "key": "jm2nqZG4"}
        self.base_url = f"http://{self.server_ip}:{self.server_port}"

    # -------------------------------------------------------------------------
    # Core request methods
    # -------------------------------------------------------------------------

    def make_completion_request(
        self,
        messages: List[Dict[str, str]],
        **kwargs,
    ) -> Optional[Any]:
        """
        Send a chat-style completion request using a list of messages.

        Args:
            messages:   List of {"role": ..., "content": ...} dicts.
            **kwargs:   Extra params forwarded to the server (temperature, max_tokens, etc.)

        Returns:
            The text content of the model's reply, or None on failure.
        """
        payload = {
            "model": self.model,
            "messages": messages,
            "user_credentials": self.user_credentials,
            **kwargs,
        }
        try:
            response = requests.post(
                f"{self.base_url}/v1/chat/completions",
                json=payload,
                timeout=120,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"[LLMService] make_completion_request failed: {e}")
            return None

    def make_single_prompt_request(self, prompt: str, **kwargs) -> Optional[Any]:
        """
        Send a single string prompt (no system message, no history).

        Internally wraps the prompt as a user message and calls
        make_completion_request.

        Args:
            prompt:   The full prompt string to send.
            **kwargs: Extra params forwarded to the server.

        Returns:
            The text content of the model's reply, or None on failure.
        """
        messages = [{"role": "user", "content": prompt}]
        return self.make_completion_request(messages, **kwargs)

    def make_system_user_request(
        self,
        system_prompt: str,
        user_prompt: str,
        **kwargs,
    ) -> Optional[Any]:
        """
        Send a request with a separate system prompt and user prompt.

        This is the cleanest way to provide instructions (system) and
        the actual task (user) as separate message roles.

        Args:
            system_prompt:  Instruction / persona for the model.
            user_prompt:    The actual content or question.
            **kwargs:       Extra params forwarded to the server.

        Returns:
            The text content of the model's reply, or None on failure.
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return self.make_completion_request(messages, **kwargs)


# Default instance — import and use this directly across the application
# so every module shares the same server configuration.
default_llm_service = LLMService()
