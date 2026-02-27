from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, Any

from app.database import get_db
from app.models import Analysis
from app.schemas import CamelModel

router = APIRouter()


class AffectedCodeOut(CamelModel):
    file: str
    lines: str
    context: str


class FixDocumentationOut(CamelModel):
    whats_wrong: str = ""
    affected_code: list[AffectedCodeOut] = []
    steps: list[str] = []
    before_code: Optional[str] = None
    after_code: Optional[str] = None
    migration_guide_url: Optional[str] = None


class FixOut(CamelModel):
    id: str
    priority: int
    title: str
    severity: str
    type: str
    estimated_effort: str = ""
    chains_resolved: int = 0
    findings_resolved: list[str] = []
    documentation: FixDocumentationOut = FixDocumentationOut()
    senso_content_id: Optional[str] = None
    senso_historical_context: Optional[str] = None


class FixSummaryOut(CamelModel):
    total_fixes: int = 0
    critical_fixes: int = 0
    estimated_total_effort: str = "Unknown"
    keystone_fixes: int = 0
    chains_eliminated_by_keystones: int = 0


class FixesListResponse(CamelModel):
    fixes: list[FixOut]
    summary: FixSummaryOut


async def _get_analysis(analysis_id: str, db: AsyncSession) -> Analysis:
    result = await db.execute(select(Analysis).where(Analysis.analysis_id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "ANALYSIS_NOT_FOUND", "message": f"Analysis {analysis_id} not found"}},
        )
    return analysis


@router.get("/analysis/{analysis_id}/fixes", response_model=FixesListResponse)
async def get_fixes(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
):
    analysis = await _get_analysis(analysis_id, db)
    raw: list[dict[str, Any]] = analysis.fixes or []

    fixes = [FixOut.model_validate(f) for f in raw]

    # Compute summary from stored fixes
    critical_count = sum(1 for f in fixes if f.severity == "critical")
    keystone_count = sum(1 for f in fixes if f.chains_resolved > 1)
    chains_by_keystones = sum(f.chains_resolved for f in fixes if f.chains_resolved > 1)

    summary = FixSummaryOut(
        total_fixes=len(fixes),
        critical_fixes=critical_count,
        estimated_total_effort="2–4 days" if len(fixes) > 5 else "< 1 day",
        keystone_fixes=keystone_count,
        chains_eliminated_by_keystones=chains_by_keystones,
    )

    return FixesListResponse(fixes=fixes, summary=summary)
