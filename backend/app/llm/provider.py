from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ReasoningProvider(ABC):
    """Abstract base for LLM-style reasoning providers."""

    @abstractmethod
    async def reason(self, system_prompt: str, user_prompt: str) -> str:
        """Free-form text reasoning (no structured schema)."""

    @abstractmethod
    async def reason_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Dict[str, Any],
    ) -> Any:
        """Structured reasoning that returns JSON matching a JSON Schema."""


class YutoriProvider(ReasoningProvider):
    """Primary reasoning provider using Yutori n1 (OpenAI-compatible)."""

    BASE_URL = "https://api.yutori.com/v1/chat/completions"
    MODEL = "n1-latest"

    def __init__(self, api_key: str) -> None:
        if not api_key:
            raise ValueError("Yutori API key is required for YutoriProvider")
        self.api_key = api_key

    async def _post(
        self,
        messages: list[dict[str, str]],
        response_format: Optional[Dict[str, Any]] = None,
    ) -> httpx.Response:
        headers = {
            "X-API-KEY": self.api_key,
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {
            "model": self.MODEL,
            "messages": messages,
        }
        if response_format is not None:
            payload["response_format"] = response_format

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.BASE_URL, headers=headers, json=payload)
            resp.raise_for_status()
            return resp

    async def reason(self, system_prompt: str, user_prompt: str) -> str:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        resp = await self._post(messages)
        data = resp.json()
        return data["choices"][0]["message"]["content"]

    async def reason_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Dict[str, Any],
    ) -> Any:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        response_format = {
            "type": "json_schema",
            "json_schema": json_schema,
        }
        resp = await self._post(messages, response_format=response_format)
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            logger.warning("Yutori structured response was not valid JSON")
            return content


class OpenAIProvider(ReasoningProvider):
    """Backup reasoning provider using OpenAI Chat Completions."""

    BASE_URL = "https://api.openai.com/v1/chat/completions"

    def __init__(self, api_key: str, model: str = "gpt-4o-mini") -> None:
        if not api_key:
            raise ValueError("OpenAI API key is required for OpenAIProvider")
        self.api_key = api_key
        self.model = model

    async def _post(
        self,
        messages: list[dict[str, str]],
        response_format: Optional[Dict[str, Any]] = None,
    ) -> httpx.Response:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
        }
        if response_format is not None:
            payload["response_format"] = response_format

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.BASE_URL, headers=headers, json=payload)
            resp.raise_for_status()
            return resp

    async def reason(self, system_prompt: str, user_prompt: str) -> str:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        resp = await self._post(messages)
        data = resp.json()
        return data["choices"][0]["message"]["content"]

    async def reason_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Dict[str, Any],
    ) -> Any:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        response_format = {
            "type": "json_schema",
            "json_schema": json_schema,
        }
        resp = await self._post(messages, response_format=response_format)
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            logger.warning("OpenAI structured response was not valid JSON")
            return content


class HybridProvider(ReasoningProvider):
    """Provider that prefers Yutori and falls back to OpenAI when needed."""

    def __init__(
        self,
        yutori_api_key: str | None,
        openai_api_key: str | None,
    ) -> None:
        self._yutori: YutoriProvider | None = None
        self._openai: OpenAIProvider | None = None

        if yutori_api_key:
            self._yutori = YutoriProvider(api_key=yutori_api_key)
        if openai_api_key:
            self._openai = OpenAIProvider(api_key=openai_api_key)

        if not self._yutori and not self._openai:
            raise RuntimeError(
                "No reasoning provider configured: set YUTORI_API_KEY or OPENAI_API_KEY",
            )

    async def reason(self, system_prompt: str, user_prompt: str) -> str:
        # Prefer Yutori
        if self._yutori:
            try:
                return await self._yutori.reason(system_prompt, user_prompt)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Yutori reason() failed, falling back to OpenAI: %s", exc)

        if self._openai:
            return await self._openai.reason(system_prompt, user_prompt)

        raise RuntimeError("No available reasoning provider")

    async def reason_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        json_schema: Dict[str, Any],
    ) -> Any:
        # Prefer Yutori
        if self._yutori:
            try:
                return await self._yutori.reason_structured(system_prompt, user_prompt, json_schema)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Yutori reason_structured() failed, falling back to OpenAI: %s",
                    exc,
                )

        if self._openai:
            return await self._openai.reason_structured(system_prompt, user_prompt, json_schema)

        raise RuntimeError("No available reasoning provider")


_reasoning_provider: HybridProvider | None = None


def get_reasoning_provider() -> HybridProvider:
    """Return a singleton HybridProvider using current settings."""
    global _reasoning_provider
    if _reasoning_provider is None:
        _reasoning_provider = HybridProvider(
            yutori_api_key=settings.yutori_api_key or None,
            openai_api_key=settings.openai_api_key or None,
        )
    return _reasoning_provider

