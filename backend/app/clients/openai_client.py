"""
OpenAI client — primary reasoning engine and structured outputs.

Handles file classification, code quality analysis, deep pattern
detection, fix generation, and chain analysis via GPT-4o.
"""
from __future__ import annotations

import json
import time
import logging
from typing import Any

import httpx

from app.config import get_settings
from app.clients.tool_logger import log_tool_call

logger = logging.getLogger(__name__)

OPENAI_BASE = "https://api.openai.com/v1"


class OpenAIClient:
    def __init__(self):
        self.settings = get_settings()

    @property
    def available(self) -> bool:
        return bool(self.settings.openai_api_key)

    async def chat(
        self,
        analysis_id: str,
        system_prompt: str,
        user_prompt: str,
        step_name: str = "chat",
        model: str = "gpt-4o",
        json_schema: dict | None = None,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        endpoint = f"{OPENAI_BASE}/chat/completions"
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        body: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if json_schema:
            body["response_format"] = {
                "type": "json_schema",
                "json_schema": json_schema,
            }

        headers = {
            "Authorization": f"Bearer {self.settings.openai_api_key}",
            "Content-Type": "application/json",
        }

        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(endpoint, headers=headers, json=body)
                resp.raise_for_status()
                data = resp.json()
            latency = round((time.perf_counter() - t0) * 1000)

            log_req = {"model": model, "step": step_name, "system_len": len(system_prompt), "user_len": len(user_prompt)}
            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="openai",
                step_name=step_name,
                endpoint=endpoint,
                request_payload=log_req,
                response_payload={
                    "model": data.get("model"),
                    "usage": data.get("usage"),
                    "content_preview": (data.get("choices", [{}])[0]
                                        .get("message", {}).get("content", ""))[:2000],
                },
                latency_ms=latency,
            )

            content = data["choices"][0]["message"]["content"]
            if json_schema:
                return json.loads(content)
            return {"text": content, "_latency_ms": latency}

        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000)
            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="openai",
                step_name=step_name,
                endpoint=endpoint,
                request_payload={"model": model, "step": step_name},
                latency_ms=latency,
                status="error",
                error_message=str(exc)[:500],
            )
            logger.warning("OpenAI %s failed: %s", step_name, exc)
            raise
