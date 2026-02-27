"""
Senso Intelligence router.

In production this proxies to Senso's REST API.
When SENSO_API_KEY is not set it returns graceful stub responses
so the app stays usable during development.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import httpx

from app.database import get_db
from app.models import Analysis
from app.schemas import CamelModel
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()

SENSO_BASE = "https://api.senso.ai/v1"


class SensoSearchRequest(CamelModel):
    query: str
    max_results: int = 5
    namespace: Optional[str] = None


class SensoSourceOut(CamelModel):
    content_id: str
    title: str
    score: float
    chunk_text: str


class SensoSearchResponse(CamelModel):
    answer: str
    sources: list[SensoSourceOut]
    processing_time_ms: int
    total_results: int


class SensoGenerateRequest(CamelModel):
    prompt: str
    context_query: Optional[str] = None
    save_result: bool = False


class SensoGenerateSourceOut(CamelModel):
    content_id: str
    title: str
    score: float


class SensoGenerateResponse(CamelModel):
    generated_text: str
    sources: list[SensoGenerateSourceOut]
    processing_time_ms: int
    saved_content_id: Optional[str] = None


async def _get_analysis(analysis_id: str, db: AsyncSession) -> Analysis:
    result = await db.execute(select(Analysis).where(Analysis.analysis_id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "ANALYSIS_NOT_FOUND", "message": f"Analysis {analysis_id} not found"}},
        )
    return analysis


def _stub_search(query: str) -> SensoSearchResponse:
    """Return a graceful stub when Senso API key is absent."""
    return SensoSearchResponse(
        answer=f"Senso API not configured. Query received: '{query}'. "
               "Add SENSO_API_KEY to your .env file to enable cross-repository intelligence.",
        sources=[],
        processing_time_ms=0,
        total_results=0,
    )


def _stub_generate(prompt: str) -> SensoGenerateResponse:
    return SensoGenerateResponse(
        generated_text=(
            "Senso API not configured. Add SENSO_API_KEY to your .env to enable "
            "AI-generated remediation documentation."
        ),
        sources=[],
        processing_time_ms=0,
    )


@router.post("/analysis/{analysis_id}/senso/search", response_model=SensoSearchResponse)
async def senso_search(
    analysis_id: str,
    body: SensoSearchRequest,
    db: AsyncSession = Depends(get_db),
):
    await _get_analysis(analysis_id, db)
    settings = get_settings()

    if not settings.senso_api_key:
        return _stub_search(body.query)

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{SENSO_BASE}/search",
                headers={"Authorization": f"Bearer {settings.senso_api_key}", "Content-Type": "application/json"},
                json={
                    "query": body.query,
                    "maxResults": body.max_results,
                    **({"namespace": body.namespace} if body.namespace else {}),
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return SensoSearchResponse(
                answer=data.get("answer", ""),
                sources=[
                    SensoSourceOut(
                        content_id=s["contentId"],
                        title=s["title"],
                        score=s["score"],
                        chunk_text=s.get("chunkText", ""),
                    )
                    for s in data.get("sources", [])
                ],
                processing_time_ms=data.get("processingTimeMs", 0),
                total_results=data.get("totalResults", 0),
            )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (401, 403):
            raise HTTPException(status_code=503, detail={"error": {"code": "SENSO_UNAVAILABLE", "message": "Invalid Senso API key"}})
        raise HTTPException(status_code=502, detail={"error": {"code": "SENSO_UNAVAILABLE", "message": str(exc)}})
    except Exception as exc:
        logger.error("Senso search error: %s", exc)
        return _stub_search(body.query)


@router.post("/analysis/{analysis_id}/senso/generate", response_model=SensoGenerateResponse)
async def senso_generate(
    analysis_id: str,
    body: SensoGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    await _get_analysis(analysis_id, db)
    settings = get_settings()

    if not settings.senso_api_key:
        return _stub_generate(body.prompt)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{SENSO_BASE}/generate",
                headers={"Authorization": f"Bearer {settings.senso_api_key}", "Content-Type": "application/json"},
                json={
                    "prompt": body.prompt,
                    **({"contextQuery": body.context_query} if body.context_query else {}),
                    "saveResult": body.save_result,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return SensoGenerateResponse(
                generated_text=data.get("generatedText", ""),
                sources=data.get("sources", []),
                processing_time_ms=data.get("processingTimeMs", 0),
                saved_content_id=data.get("savedContentId"),
            )
    except Exception as exc:
        logger.error("Senso generate error: %s", exc)
        return _stub_generate(body.prompt)
