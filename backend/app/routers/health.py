from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import httpx
import asyncio
import logging

from app.database import get_db
from app.config import get_settings
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
    except Exception:
        db_status = "disconnected"
    return HealthResponse(
        status="ok",
        service="vibecheck-api",
        version="0.1.0",
        database=db_status,
    )


@router.get("/health/integrations")
async def integration_health(db: AsyncSession = Depends(get_db)):
    """Test all sponsor API keys and external service connections."""

    async def _check(name: str, coro) -> dict:
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

    async def check_senso():
        key = settings.senso_api_key
        if not key:
            raise ValueError("SENSO_API_KEY not set")
        async with httpx.AsyncClient(timeout=6.0) as c:
            r = await c.get(
                "https://sdk.senso.ai/api/v1/content",
                headers={"X-Api-Key": key, "Content-Type": "application/json"},
                params={"limit": 1},
            )
            r.raise_for_status()
            return {"message": f"Senso OK — HTTP {r.status_code}"}

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
        key = settings.fastino_api_key
        if not key:
            raise ValueError("FASTINO_API_KEY not set")
        async with httpx.AsyncClient(timeout=6.0) as c:
            r = await c.post(
                "https://api.fastino.ai/gliner-2",
                headers={"Authorization": f"Bearer {key}"},
                json={"task": "classify_text", "text": "hello", "schema": {"categories": ["test"]}},
            )
            r.raise_for_status()
            return {"message": "Fastino OK — GLiNER-2 responding"}

    async def check_github():
        token = settings.github_token
        if not token:
            raise ValueError("GITHUB_TOKEN not set")
        async with httpx.AsyncClient(timeout=6.0) as c:
            r = await c.get(
                "https://api.github.com/rate_limit",
                headers={"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"},
            )
            r.raise_for_status()
            remaining = r.json().get("rate", {}).get("remaining", "?")
            return {"message": f"GitHub OK — {remaining} requests remaining"}

    results = await asyncio.gather(
        _check("PostgreSQL", check_db()),
        _check("Neo4j", check_neo4j()),
        _check("Senso", check_senso()),
        _check("Yutori", check_yutori()),
        _check("OpenAI", check_openai()),
        _check("Tavily", check_tavily()),
        _check("Fastino", check_fastino()),
        _check("GitHub", check_github()),
    )

    all_ok = all(r["status"] == "ok" for r in results)
    return {
        "overall": "healthy" if all_ok else "degraded",
        "integrations": results,
    }
