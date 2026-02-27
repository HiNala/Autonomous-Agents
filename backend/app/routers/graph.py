from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, Any

from app.database import get_db
from app.models import Analysis
from app.schemas import CamelModel
from app.services import neo4j as neo4j_service

router = APIRouter()


class GraphNodeOut(CamelModel):
    id: str
    type: str
    label: str
    path: Optional[str] = None
    category: Optional[str] = None
    language: Optional[str] = None
    lines: Optional[int] = None
    severity: Optional[str] = None
    finding_count: int = 0
    metadata: dict = {}


class GraphEdgeOut(CamelModel):
    id: str
    source: str
    target: str
    type: str
    is_vulnerability_chain: bool = False
    chain_id: Optional[str] = None


class GraphResponse(CamelModel):
    nodes: list[GraphNodeOut]
    edges: list[GraphEdgeOut]
    layout: dict[str, str] = {}


async def _get_analysis(analysis_id: str, db: AsyncSession) -> Analysis:
    result = await db.execute(select(Analysis).where(Analysis.analysis_id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "ANALYSIS_NOT_FOUND", "message": f"Analysis {analysis_id} not found"}},
        )
    return analysis


@router.get("/analysis/{analysis_id}/graph", response_model=GraphResponse)
async def get_graph(
    analysis_id: str,
    view: str = Query("structure", description="View mode: structure|dependencies|vulnerabilities"),
    depth: int = Query(3, ge=1, le=6),
    db: AsyncSession = Depends(get_db),
):
    analysis = await _get_analysis(analysis_id, db)

    # 1. Try Neo4j first (live graph)
    neo4j_connected = await neo4j_service.is_connected()

    if neo4j_connected:
        raw_nodes = await neo4j_service.get_graph_nodes(analysis_id)
        raw_edges = await neo4j_service.get_graph_edges(analysis_id, view=view)
    else:
        # Fall back to JSON stored on the analysis record
        raw_nodes: list[dict[str, Any]] = analysis.graph_nodes or []
        raw_edges_all: list[dict[str, Any]] = analysis.graph_edges or []

        # Filter edges by view
        if view == "structure":
            raw_edges = [e for e in raw_edges_all if e.get("type") == "contains"]
        elif view == "dependencies":
            raw_edges = [e for e in raw_edges_all if e.get("type") in ("imports", "depends_on", "calls", "handles")]
        else:
            raw_edges = raw_edges_all

    # Remap camelCase from neo4j to snake_case for Pydantic
    def remap_node(r: dict) -> dict:
        return {
            "id": r.get("id", ""),
            "type": r.get("type", "file"),
            "label": r.get("label", r.get("id", "")),
            "path": r.get("path"),
            "category": r.get("category"),
            "language": r.get("language"),
            "lines": r.get("lines"),
            "severity": r.get("severity"),
            "finding_count": r.get("findingCount", r.get("finding_count", 0)),
            "metadata": r.get("metadata", {}),
        }

    def remap_edge(r: dict) -> dict:
        return {
            "id": r.get("id", f"{r.get('source')}-{r.get('target')}"),
            "source": r.get("source", ""),
            "target": r.get("target", ""),
            "type": r.get("type", "contains"),
            "is_vulnerability_chain": r.get("isVulnerabilityChain", r.get("is_vulnerability_chain", False)),
            "chain_id": r.get("chainId", r.get("chain_id")),
        }

    nodes = [GraphNodeOut.model_validate(remap_node(n)) for n in raw_nodes]
    edges = [GraphEdgeOut.model_validate(remap_edge(e)) for e in raw_edges]

    layout_hint = {
        "structure": "dagre",
        "dependencies": "cose-bilkent",
        "vulnerabilities": "cose-bilkent",
    }.get(view, "dagre")

    return GraphResponse(
        nodes=nodes,
        edges=edges,
        layout={"algorithm": layout_hint, "direction": "TB" if view == "structure" else ""},
    )
