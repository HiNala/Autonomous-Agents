"""
Yutori client — deep web research and browsing automation via agents.

Docs: https://docs.yutori.com/
APIs: Research (POST /v1/research/tasks), Browsing (POST /v1/browsing/tasks)
Auth: X-API-Key header
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

YUTORI_BASE = "https://api.yutori.com"


class YutoriClient:
    def __init__(self):
        self.settings = get_settings()
        self._headers = {
            "X-API-Key": self.settings.yutori_api_key,
            "Content-Type": "application/json",
        }

    @property
    def available(self) -> bool:
        return bool(self.settings.yutori_api_key)

    async def research(
        self,
        analysis_id: str,
        query: str,
        step_name: str = "research",
        output_schema: dict | None = None,
        poll: bool = True,
        max_wait: int = 120,
    ) -> dict[str, Any]:
        """Launch a research task and optionally poll until complete."""
        endpoint = f"{YUTORI_BASE}/v1/research/tasks"
        payload: dict[str, Any] = {"query": query}
        if output_schema:
            payload["output_schema"] = output_schema

        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(endpoint, headers=self._headers, json=payload)
                resp.raise_for_status()
                data = resp.json()

            task_id = data.get("task_id", "")
            latency = round((time.perf_counter() - t0) * 1000)

            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="yutori",
                step_name=f"{step_name}_create",
                endpoint=endpoint,
                request_payload=payload,
                response_payload=data,
                latency_ms=latency,
            )

            if not poll or not task_id:
                return data

            result = await self._poll_task(
                analysis_id, "research", task_id, step_name, max_wait
            )
            return result

        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000)
            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="yutori",
                step_name=step_name,
                endpoint=endpoint,
                request_payload=payload,
                latency_ms=latency,
                status="error",
                error_message=str(exc)[:500],
            )
            logger.warning("Yutori research failed: %s", exc)
            raise

    async def browse(
        self,
        analysis_id: str,
        task: str,
        start_url: str,
        step_name: str = "browse",
        output_schema: dict | None = None,
        max_steps: int = 50,
        poll: bool = True,
        max_wait: int = 120,
    ) -> dict[str, Any]:
        """Launch a browsing task and optionally poll until complete."""
        endpoint = f"{YUTORI_BASE}/v1/browsing/tasks"
        payload: dict[str, Any] = {
            "task": task,
            "start_url": start_url,
            "max_steps": max_steps,
        }
        if output_schema:
            payload["output_schema"] = output_schema

        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(endpoint, headers=self._headers, json=payload)
                resp.raise_for_status()
                data = resp.json()

            task_id = data.get("task_id", "")
            latency = round((time.perf_counter() - t0) * 1000)

            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="yutori",
                step_name=f"{step_name}_create",
                endpoint=endpoint,
                request_payload=payload,
                response_payload=data,
                latency_ms=latency,
            )

            if not poll or not task_id:
                return data

            return await self._poll_task(
                analysis_id, "browsing", task_id, step_name, max_wait
            )

        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000)
            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="yutori",
                step_name=step_name,
                endpoint=endpoint,
                request_payload=payload,
                latency_ms=latency,
                status="error",
                error_message=str(exc)[:500],
            )
            logger.warning("Yutori browse failed: %s", exc)
            raise

    async def _poll_task(
        self,
        analysis_id: str,
        api: str,
        task_id: str,
        step_name: str,
        max_wait: int,
    ) -> dict[str, Any]:
        """Poll GET /v1/{api}/tasks/{task_id} until succeeded/failed."""
        endpoint = f"{YUTORI_BASE}/v1/{api}/tasks/{task_id}"
        deadline = time.time() + max_wait
        interval = 3
        while time.time() < deadline:
            await asyncio.sleep(interval)
            interval = min(interval * 1.5, 10)

            t0 = time.perf_counter()
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(endpoint, headers=self._headers)
                resp.raise_for_status()
                data = resp.json()
            latency = round((time.perf_counter() - t0) * 1000)

            status = data.get("status", "unknown")
            if status in ("succeeded", "failed"):
                await log_tool_call(
                    analysis_id=analysis_id,
                    tool_name="yutori",
                    step_name=f"{step_name}_result",
                    endpoint=endpoint,
                    response_payload=data,
                    latency_ms=latency,
                    status="success" if status == "succeeded" else "error",
                )
                return data

        await log_tool_call(
            analysis_id=analysis_id,
            tool_name="yutori",
            step_name=f"{step_name}_timeout",
            endpoint=endpoint,
            latency_ms=max_wait * 1000,
            status="error",
            error_message=f"Polling timed out after {max_wait}s",
        )
        return {"status": "timeout", "task_id": task_id}
