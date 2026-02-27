from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Analysis
from app.schemas import (
    FindingsSummary,
    CamelModel,
    Severity,
)
from typing import Optional, Any

router = APIRouter()


class FindingLocationOut(CamelModel):
    files: list[str] = []
    primary_file: str = ""
    start_line: int = 0
    end_line: int = 0


class BlastRadiusOut(CamelModel):
    files_affected: int = 0
    functions_affected: int = 0
    endpoints_affected: int = 0


class CVEInfoOut(CamelModel):
    id: str
    cvss_score: float = 0.0
    exploit_available: bool = False
    fixed_version: str = ""


class FindingOut(CamelModel):
    id: str
    type: str
    severity: str
    agent: str
    title: str
    description: str
    plain_description: str = ""
    location: FindingLocationOut = FindingLocationOut()
    blast_radius: BlastRadiusOut = BlastRadiusOut()
    cve: Optional[CVEInfoOut] = None
    chain_ids: list[str] = []
    fix_id: Optional[str] = None
    senso_content_id: Optional[str] = None
    confidence: float = 0.0


class FindingsListResponse(CamelModel):
    items: list[FindingOut]
    total: int
    limit: int
    offset: int


class ChainStepOut(CamelModel):
    type: str
    node: str
    file: Optional[str] = None
    cve: Optional[str] = None
    description: str


class VulnerabilityChainOut(CamelModel):
    id: str
    severity: str
    description: str
    steps: list[ChainStepOut] = []
    blast_radius: dict[str, int] = {}
    keystone_fix: str = ""
    finding_ids: list[str] = []


class ChainsListResponse(CamelModel):
    chains: list[VulnerabilityChainOut]
    total: int


async def _get_analysis(analysis_id: str, db: AsyncSession) -> Analysis:
    result = await db.execute(select(Analysis).where(Analysis.analysis_id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail={"error": {"code": "ANALYSIS_NOT_FOUND", "message": f"Analysis {analysis_id} not found"}})
    return analysis


@router.get("/analysis/{analysis_id}/findings", response_model=FindingsListResponse)
async def get_findings(
    analysis_id: str,
    severity: Optional[str] = Query(None, description="Filter by severity: critical|warning|info"),
    agent: Optional[str] = Query(None, description="Filter by agent name"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    analysis = await _get_analysis(analysis_id, db)
    raw: list[dict[str, Any]] = analysis.findings or []

    # Apply filters
    if severity:
        raw = [f for f in raw if f.get("severity") == severity]
    if agent:
        raw = [f for f in raw if f.get("agent") == agent]

    total = len(raw)
    page = raw[offset: offset + limit]

    items = [FindingOut.model_validate(f) for f in page]
    return FindingsListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/analysis/{analysis_id}/chains", response_model=ChainsListResponse)
async def get_chains(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
):
    analysis = await _get_analysis(analysis_id, db)
    raw: list[dict[str, Any]] = analysis.chains or []
    chains = [VulnerabilityChainOut.model_validate(c) for c in raw]
    return ChainsListResponse(chains=chains, total=len(chains))
