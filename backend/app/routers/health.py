from __future__ import annotations

import asyncio
import logging
from collections.abc import Coroutine
from typing import Any

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.schemas import HealthResponse
from app.services import neo4j as neo4j_service

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


@router.get("/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
        overall = "ok"
    except Exception:
        db_status = "disconnected"
        overall = "degraded"
    return HealthResponse(
        status=overall,
        service="vibecheck-api",
        version="0.1.0",
        database=db_status,
    )


@router.get("/health/integrations")
async def integration_health(db: AsyncSession = Depends(get_db)):
    """Test all sponsor API keys and external service connections."""

    async def _check(name: str, coro: Coroutine[Any, Any, dict[str, Any]]) -> dict[str, Any]:
        try:
            result = await asyncio.wait_for(coro, timeout=8.0)
            return {"name": name, "status": "ok", **result}
        except asyncio.TimeoutError:
            return {"name": name, "status": "timeout", "message": "Request timed out (8s)"}
        except Exception as e:
            return {"name": name, "status": "error", "message": str(e)[:200]}

    async def check_db():
        await db.execute(text("SELECT 1"))
        return {"message": "PostgreSQL responding"}

    async def check_neo4j():
        connected = await neo4j_service.is_connected()
        if connected:
            return {"message": "Neo4j connected"}
        raise ConnectionError("Neo4j unreachable or not configured")

    async def check_openai():
        key = settings.openai_api_key
        if not key:
            raise ValueError("OPENAI_API_KEY not set")
        async with httpx.AsyncClient(timeout=6.0) as c:
            r = await c.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {key}"},
            )
            r.raise_for_status()
            return {"message": f"OpenAI OK — {len(r.json().get('data', []))} models"}

    async def check_tavily():
        key = settings.tavily_api_key
        if not key:
            raise ValueError("TAVILY_API_KEY not set")
        async with httpx.AsyncClient(timeout=6.0) as c:
            r = await c.post(
                "https://api.tavily.com/search",
                json={"api_key": key, "query": "test", "max_results": 1},
            )
            r.raise_for_status()
            return {"message": "Tavily OK — search operational"}

    async def check_yutori():
        key = settings.yutori_api_key
        if not key:
            raise ValueError("YUTORI_API_KEY not set")
        async with httpx.AsyncClient(timeout=6.0) as c:
            r = await c.get(
                "https://api.yutori.com/health",
                headers={"X-API-KEY": key},
            )
            r.raise_for_status()
            return {"message": "Yutori OK — API healthy"}

    async def check_fastino():
        from app.clients.fastino import FastinoClient
        client = FastinoClient()
        if not client.available:
            raise ValueError("Fastino unavailable (no API key and local GLiNER2 not loaded)")
        if settings.fastino_api_key:
            async with httpx.AsyncClient(timeout=6.0) as c:
                r = await c.post(
                    "https://api.pioneer.ai/gliner-2",
                    headers={"X-API-Key": settings.fastino_api_key, "Content-Type": "application/json"},
                    json={"task": "classify_text", "text": "hello", "schema": {"categories": ["test"]}},
                )
                if r.status_code in (401, 403):
                    raise ValueError(f"Fastino auth failed — HTTP {r.status_code}")
                if r.status_code == 404:
                    return {"message": f"Fastino key configured — endpoint returned {r.status_code} (verify /gliner-2 path)"}
                r.raise_for_status()
            return {"message": "Fastino OK — API responding"}
        result = await client.classify_text("health", "hello", ["test"], step_name="health_check")
        return {"message": f"Fastino OK — local GLiNER2 ({(result.get('_latency_ms') or 0)}ms)"}

    async def check_github():
        token = settings.github_token
        if not token:
            raise ValueError("GITHUB_TOKEN not set")
        async with httpx.AsyncClient(timeout=6.0) as c:
            r = await c.get(
                "https://api.github.com/rate_limit",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
            )
            r.raise_for_status()
            remaining = r.json().get("rate", {}).get("remaining", "?")
            return {"message": f"GitHub OK — {remaining} requests remaining"}

    async def run_github_check() -> dict[str, Any]:
        if not settings.github_token:
            return {"name": "GitHub", "status": "skipped", "message": "GITHUB_TOKEN not set (optional)"}
        return await _check("GitHub", check_github())

    async def run_fastino_check() -> dict[str, Any]:
        """Fastino is primary for classification — treat missing key as soft skip."""
        if not settings.fastino_api_key:
            return {"name": "Fastino (primary)", "status": "skipped", "message": "FASTINO_API_KEY not set — will use OpenAI fallback"}
        return await _check("Fastino (primary)", check_fastino())

    async def run_yutori_check() -> dict[str, Any]:
        """Yutori is primary for research — treat missing key as soft skip."""
        if not settings.yutori_api_key:
            return {"name": "Yutori (primary)", "status": "skipped", "message": "YUTORI_API_KEY not set — will use OpenAI fallback"}
        return await _check("Yutori (primary)", check_yutori())

    results = await asyncio.gather(
        _check("PostgreSQL", check_db()),
        _check("Neo4j", check_neo4j()),
        run_fastino_check(),
        run_yutori_check(),
        _check("OpenAI (fallback)", check_openai()),
        _check("Tavily", check_tavily()),
        run_github_check(),
    )

    all_ok = all(r["status"] in ("ok", "skipped") for r in results)
    return {
        "overall": "healthy" if all_ok else "degraded",
        "integrations": results,
    }
