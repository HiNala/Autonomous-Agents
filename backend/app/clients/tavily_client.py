"""
Tavily client — CVE search and advisory content extraction.

Docs: https://docs.tavily.com/sdk/python/reference
"""
from __future__ import annotations

import time
import logging
from typing import Any

import httpx

from app.config import get_settings
from app.clients.tool_logger import log_tool_call

logger = logging.getLogger(__name__)

TAVILY_BASE = "https://api.tavily.com"


class TavilyClient:
    def __init__(self):
        self.settings = get_settings()

    @property
    def available(self) -> bool:
        return bool(self.settings.tavily_api_key)

    async def search(
        self,
        analysis_id: str,
        query: str,
        step_name: str = "search",
        search_depth: str = "advanced",
        max_results: int = 5,
        include_domains: list[str] | None = None,
        include_answer: bool = True,
    ) -> dict[str, Any]:
        endpoint = f"{TAVILY_BASE}/search"
        payload: dict[str, Any] = {
            "api_key": self.settings.tavily_api_key,
            "query": query,
            "search_depth": search_depth,
            "max_results": max_results,
            "include_answer": include_answer,
        }
        if include_domains:
            payload["include_domains"] = include_domains

        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(endpoint, json=payload)
                resp.raise_for_status()
                data = resp.json()
            latency = round((time.perf_counter() - t0) * 1000)

            log_payload = {k: v for k, v in payload.items() if k != "api_key"}
            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="tavily",
                step_name=step_name,
                endpoint=endpoint,
                request_payload=log_payload,
                response_payload=data,
                latency_ms=latency,
            )
            return data

        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000)
            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="tavily",
                step_name=step_name,
                endpoint=endpoint,
                request_payload={"query": query},
                latency_ms=latency,
                status="error",
                error_message=str(exc)[:500],
            )
            logger.warning("Tavily %s failed: %s", step_name, exc)
            raise

    async def extract(
        self,
        analysis_id: str,
        urls: list[str],
        step_name: str = "extract",
    ) -> dict[str, Any]:
        endpoint = f"{TAVILY_BASE}/extract"
        payload = {"api_key": self.settings.tavily_api_key, "urls": urls}

        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(endpoint, json=payload)
                resp.raise_for_status()
                data = resp.json()
            latency = round((time.perf_counter() - t0) * 1000)

            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="tavily",
                step_name=step_name,
                endpoint=endpoint,
                request_payload={"urls": urls},
                response_payload=data,
                latency_ms=latency,
            )
            return data

        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000)
            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="tavily",
                step_name=step_name,
                endpoint=endpoint,
                request_payload={"urls": urls},
                latency_ms=latency,
                status="error",
                error_message=str(exc)[:500],
            )
            logger.warning("Tavily extract failed: %s", exc)
            raise
