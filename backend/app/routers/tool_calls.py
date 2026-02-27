"""
Tool Calls router — view logged API calls for any analysis.

Every sponsor-tool call (Fastino, Tavily, Yutori, OpenAI, Senso, Git, Neo4j)
is persisted in the tool_calls table via the client wrappers.
This router exposes them so we can audit, debug, and build on the data.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from app.database import get_db
from app.models import ToolCall
from app.schemas import CamelModel

router = APIRouter()


class ToolCallOut(CamelModel):
    id: str
    analysis_id: str
    tool_name: str
    step_name: str
    endpoint: str
    request_payload: Optional[dict] = None
    response_payload: Optional[dict] = None
    latency_ms: Optional[int] = None
    status: str
    error_message: Optional[str] = None
    created_at: str


class ToolCallsListResponse(CamelModel):
    items: list[ToolCallOut]
    total: int
    limit: int
    offset: int


class ToolCallSummary(CamelModel):
    tool_name: str
    total_calls: int
    success_count: int
    error_count: int
    avg_latency_ms: Optional[float] = None


class ToolCallsSummaryResponse(CamelModel):
    analysis_id: str
    tools: list[ToolCallSummary]
    total_calls: int


@router.get("/analysis/{analysis_id}/tool-calls", response_model=ToolCallsListResponse)
async def get_tool_calls(
    analysis_id: str,
    tool_name: Optional[str] = Query(None, description="Filter by tool: fastino|tavily|yutori|openai|senso|git"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: success|error"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List all logged tool calls for an analysis, most recent first."""
    query = select(ToolCall).where(ToolCall.analysis_id == analysis_id)
    count_query = select(func.count()).select_from(ToolCall).where(ToolCall.analysis_id == analysis_id)

    if tool_name:
        query = query.where(ToolCall.tool_name == tool_name)
        count_query = count_query.where(ToolCall.tool_name == tool_name)
    if status_filter:
        query = query.where(ToolCall.status == status_filter)
        count_query = count_query.where(ToolCall.status == status_filter)

    total = (await db.execute(count_query)).scalar() or 0
    rows = (
        await db.execute(
            query.order_by(ToolCall.created_at.desc()).offset(offset).limit(limit)
        )
    ).scalars().all()

    items = [
        ToolCallOut(
            id=str(r.id),
            analysis_id=r.analysis_id,
            tool_name=r.tool_name,
            step_name=r.step_name,
            endpoint=r.endpoint,
            request_payload=r.request_payload,
            response_payload=r.response_payload,
            latency_ms=r.latency_ms,
            status=r.status,
            error_message=r.error_message,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in rows
    ]
    return ToolCallsListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/analysis/{analysis_id}/tool-calls/summary", response_model=ToolCallsSummaryResponse)
async def get_tool_calls_summary(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Aggregate stats per tool for a given analysis."""
    rows = (
        await db.execute(
            select(
                ToolCall.tool_name,
                func.count().label("total"),
                func.count().filter(ToolCall.status == "success").label("success"),
                func.count().filter(ToolCall.status == "error").label("errors"),
                func.avg(ToolCall.latency_ms).label("avg_latency"),
            )
            .where(ToolCall.analysis_id == analysis_id)
            .group_by(ToolCall.tool_name)
        )
    ).all()

    tools = [
        ToolCallSummary(
            tool_name=r.tool_name,
            total_calls=r.total,
            success_count=r.success,
            error_count=r.errors,
            avg_latency_ms=round(r.avg_latency, 1) if r.avg_latency else None,
        )
        for r in rows
    ]

    total = sum(t.total_calls for t in tools)
    return ToolCallsSummaryResponse(analysis_id=analysis_id, tools=tools, total_calls=total)
