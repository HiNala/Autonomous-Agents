import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.orchestrator import run_orchestrator
from app.database import get_db
from app.models import Analysis, AnalysisStatus
from app.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    AnalysisResult,
    AnalysisStatusEnum,
    FindingsSummary,
    Timestamps,
    ErrorResponse,
)

router = APIRouter()


def generate_analysis_id() -> str:
    return f"anl_{uuid.uuid4().hex[:6]}"


@router.post("/analyze", response_model=AnalyzeResponse, status_code=202)
async def start_analysis(request: AnalyzeRequest, db: AsyncSession = Depends(get_db)):
    parts = request.repo_url.rstrip("/").split("/")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail={"code": "INVALID_URL", "message": "Not a valid GitHub URL"})

    repo_name = f"{parts[-2]}/{parts[-1].replace('.git', '')}"
    analysis_id = generate_analysis_id()

    analysis = Analysis(
        analysis_id=analysis_id,
        repo_url=request.repo_url,
        repo_name=repo_name,
        branch=request.branch or "main",
        status=AnalysisStatus.QUEUED,
    )
    db.add(analysis)
    await db.commit()

    # Kick off background analysis via orchestrator
    asyncio.create_task(run_orchestrator(analysis_id))

    return AnalyzeResponse(
        analysis_id=analysis_id,
        status="queued",
        repo_name=repo_name,
        estimated_duration=45,
        websocket_url=f"/ws/analysis/{analysis_id}",
    )


@router.get("/analysis/{analysis_id}", response_model=AnalysisResult)
async def get_analysis(analysis_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Analysis).where(Analysis.analysis_id == analysis_id))
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(
            status_code=404,
            detail={"code": "ANALYSIS_NOT_FOUND", "message": f"Analysis {analysis_id} not found"},
        )

    return AnalysisResult(
        analysis_id=analysis.analysis_id,
        status=AnalysisStatusEnum(analysis.status.value),
        repo_url=analysis.repo_url,
        repo_name=analysis.repo_name,
        branch=analysis.branch,
        detected_stack=analysis.detected_stack,
        stats=analysis.stats,
        health_score=analysis.health_score,
        findings=FindingsSummary(**(analysis.findings_summary or {})),
        timestamps=Timestamps(
            started_at=analysis.created_at,
            completed_at=analysis.completed_at,
            duration=analysis.duration_seconds,
        ),
    )
