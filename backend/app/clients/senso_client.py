"""
Senso Context OS client — knowledge persistence, search, and generation.

Docs: https://docs.senso.ai/
Base: https://sdk.senso.ai/api/v1
Auth: X-API-Key header

Optional: only runs if SENSO_API_KEY is set.
"""
from __future__ import annotations

import asyncio
import time
import logging
from typing import Any

import httpx

from app.config import get_settings
from app.clients.tool_logger import log_tool_call

logger = logging.getLogger(__name__)

SENSO_BASE = "https://sdk.senso.ai/api/v1"


class SensoClient:
    def __init__(self):
        self.settings = get_settings()
        self._headers = {
            "X-API-Key": self.settings.senso_api_key,
            "Content-Type": "application/json",
        }

    @property
    def available(self) -> bool:
        return bool(self.settings.senso_api_key)

    async def ingest_content(
        self,
        analysis_id: str,
        title: str,
        summary: str,
        text: str,
        step_name: str = "ingest",
        wait_for_processing: bool = True,
    ) -> dict[str, Any]:
        endpoint = f"{SENSO_BASE}/content/raw"
        payload = {"title": title, "summary": summary, "text": text}

        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(endpoint, headers=self._headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
            latency = round((time.perf_counter() - t0) * 1000)

            content_id = data.get("id", "")

            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="senso",
                step_name=step_name,
                endpoint=endpoint,
                request_payload={"title": title, "summary": summary, "text_len": len(text)},
                response_payload=data,
                latency_ms=latency,
            )

            if wait_for_processing and content_id:
                await self._poll_processing(analysis_id, content_id, step_name)

            return data

        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000)
            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="senso",
                step_name=step_name,
                endpoint=endpoint,
                request_payload={"title": title},
                latency_ms=latency,
                status="error",
                error_message=str(exc)[:500],
            )
            logger.warning("Senso ingest failed: %s", exc)
            raise

    async def search(
        self,
        analysis_id: str,
        query: str,
        step_name: str = "search",
        max_results: int = 5,
    ) -> dict[str, Any]:
        endpoint = f"{SENSO_BASE}/search"
        payload = {"query": query, "max_results": max_results}

        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(endpoint, headers=self._headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
            latency = round((time.perf_counter() - t0) * 1000)

            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="senso",
                step_name=step_name,
                endpoint=endpoint,
                request_payload=payload,
                response_payload=data,
                latency_ms=latency,
            )
            return data

        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000)
            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="senso",
                step_name=step_name,
                endpoint=endpoint,
                request_payload=payload,
                latency_ms=latency,
                status="error",
                error_message=str(exc)[:500],
            )
            logger.warning("Senso search failed: %s", exc)
            raise

    async def generate(
        self,
        analysis_id: str,
        instructions: str,
        step_name: str = "generate",
        content_type: str = "analysis_report",
        save: bool = False,
    ) -> dict[str, Any]:
        endpoint = f"{SENSO_BASE}/generate"
        payload = {
            "instructions": instructions,
            "content_type": content_type,
            "save": save,
        }

        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(endpoint, headers=self._headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
            latency = round((time.perf_counter() - t0) * 1000)

            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="senso",
                step_name=step_name,
                endpoint=endpoint,
                request_payload=payload,
                response_payload=data,
                latency_ms=latency,
            )
            return data

        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000)
            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="senso",
                step_name=step_name,
                endpoint=endpoint,
                request_payload=payload,
                latency_ms=latency,
                status="error",
                error_message=str(exc)[:500],
            )
            logger.warning("Senso generate failed: %s", exc)
            raise

    async def _poll_processing(
        self, analysis_id: str, content_id: str, step_name: str, max_wait: int = 30
    ):
        endpoint = f"{SENSO_BASE}/content/{content_id}"
        for _ in range(max_wait):
            await asyncio.sleep(1)
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(endpoint, headers=self._headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("processing_status") == "completed":
                            return
                        if data.get("processing_status") == "failed":
                            logger.warning("Senso content %s processing failed", content_id)
                            return
            except Exception:
                pass
