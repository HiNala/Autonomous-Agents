"""
Fastino GLiNER-2 client — primary inferencing for entity extraction,
text classification, and structured JSON extraction.

Docs: https://fastino.ai/api-reference/gliner-2
Endpoint: POST https://api.fastino.ai/gliner-2
Auth: Authorization: Bearer {FASTINO_API_KEY}
"""
from __future__ import annotations

import time
import logging
from typing import Any

import httpx

from app.config import get_settings
from app.clients.tool_logger import log_tool_call

logger = logging.getLogger(__name__)

FASTINO_BASE = "https://api.fastino.ai"


class FastinoClient:
    def __init__(self):
        self.settings = get_settings()
        self._headers = {
            "Authorization": f"Bearer {self.settings.fastino_api_key}",
            "Content-Type": "application/json",
        }

    @property
    def available(self) -> bool:
        return bool(self.settings.fastino_api_key)

    async def classify_text(
        self,
        analysis_id: str,
        text: str,
        categories: list[str],
        step_name: str = "classify_text",
        threshold: float = 0.5,
    ) -> dict[str, Any]:
        payload = {
            "task": "classify_text",
            "text": text[:8000],
            "schema": {"categories": categories},
            "threshold": threshold,
        }
        return await self._call(analysis_id, step_name, payload)

    async def extract_entities(
        self,
        analysis_id: str,
        text: str,
        labels: list[str],
        step_name: str = "extract_entities",
        threshold: float = 0.5,
    ) -> dict[str, Any]:
        payload = {
            "task": "extract_entities",
            "text": text[:8000],
            "schema": labels,
            "threshold": threshold,
        }
        return await self._call(analysis_id, step_name, payload)

    async def extract_json(
        self,
        analysis_id: str,
        text: str,
        schema: dict,
        step_name: str = "extract_json",
    ) -> dict[str, Any]:
        payload = {
            "task": "extract_json",
            "text": text[:8000],
            "schema": schema,
        }
        return await self._call(analysis_id, step_name, payload)

    async def _call(self, analysis_id: str, step_name: str, payload: dict) -> dict[str, Any]:
        endpoint = f"{FASTINO_BASE}/gliner-2"
        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(endpoint, headers=self._headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
            latency = round((time.perf_counter() - t0) * 1000)

            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="fastino",
                step_name=step_name,
                endpoint=endpoint,
                request_payload=payload,
                response_payload=data,
                latency_ms=latency,
            )
            result = data.get("result", data)
            result["_latency_ms"] = latency
            return result

        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000)
            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="fastino",
                step_name=step_name,
                endpoint=endpoint,
                request_payload=payload,
                latency_ms=latency,
                status="error",
                error_message=str(exc)[:500],
            )
            logger.warning("Fastino %s failed: %s", step_name, exc)
            raise
