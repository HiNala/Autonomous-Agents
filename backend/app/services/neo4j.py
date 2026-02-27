"""
Neo4j service — async driver wrapper + all graph helper queries.

The Mapper Agent writes nodes/relationships; analysis routers read them.

Environment variables (set in .env):
  NEO4J_URI       e.g. bolt://neo4j:7687
  NEO4J_USER      defaults to "neo4j"
  NEO4J_PASSWORD  required for production
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

_driver = None  # Initialized lazily


def _get_driver():
    global _driver
    if _driver is not None:
        return _driver
    try:
        import neo4j
        from app.config import get_settings
        settings = get_settings()
        if not settings.neo4j_uri or not settings.neo4j_password:
            logger.warning("NEO4J_URI / NEO4J_PASSWORD not configured — graph features disabled")
            return None
        _driver = neo4j.AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
        logger.info("Neo4j driver initialized at %s", settings.neo4j_uri)
    except Exception as exc:
        logger.warning("Neo4j init failed: %s", exc)
        _driver = None
    return _driver


async def close():
    global _driver
    if _driver:
        await _driver.close()
        _driver = None


async def is_connected() -> bool:
    driver = _get_driver()
    if not driver:
        return False
    try:
        await driver.verify_connectivity()
        return True
    except Exception:
        return False


# ============================================================
# WRITE helpers (used by Mapper Agent)
# ============================================================

async def write_file_node(
    analysis_id: str,
    file_id: str,
    path: str,
    language: str,
    lines: int,
    category: str,
    finding_count: int = 0,
    severity: str | None = None,
) -> None:
    driver = _get_driver()
    if not driver:
        return
    async with driver.session(database="neo4j") as session:
        await session.run(
            """
            MERGE (f:File {id: $id, analysisId: $analysisId})
            SET f.path = $path,
                f.language = $language,
                f.lines = $lines,
                f.category = $category,
                f.findingCount = $findingCount,
                f.severity = $severity,
                f.label = $label
            """,
            id=file_id,
            analysisId=analysis_id,
            path=path,
            language=language,
            lines=lines,
            category=category,
            findingCount=finding_count,
            severity=severity,
            label=path.split("/")[-1],
        )


async def write_directory_node(
    analysis_id: str,
    dir_id: str,
    path: str,
) -> None:
    driver = _get_driver()
    if not driver:
        return
    async with driver.session(database="neo4j") as session:
        await session.run(
            """
            MERGE (d:Directory {id: $id, analysisId: $analysisId})
            SET d.path = $path, d.label = $label
            """,
            id=dir_id,
            analysisId=analysis_id,
            path=path,
            label=path.split("/")[-1] or "/",
        )


async def write_function_node(
    analysis_id: str,
    func_id: str,
    name: str,
    file_path: str,
    lines: int = 0,
    finding_count: int = 0,
    severity: str | None = None,
) -> None:
    driver = _get_driver()
    if not driver:
        return
    async with driver.session(database="neo4j") as session:
        await session.run(
            """
            MERGE (fn:Function {id: $id, analysisId: $analysisId})
            SET fn.label = $name, fn.filePath = $filePath,
                fn.lines = $lines, fn.findingCount = $findingCount,
                fn.severity = $severity
            """,
            id=func_id,
            analysisId=analysis_id,
            name=name,
            filePath=file_path,
            lines=lines,
            findingCount=finding_count,
            severity=severity,
        )


async def write_package_node(
    analysis_id: str,
    pkg_id: str,
    name: str,
    version: str,
    is_dev: bool = False,
    finding_count: int = 0,
    severity: str | None = None,
) -> None:
    driver = _get_driver()
    if not driver:
        return
    async with driver.session(database="neo4j") as session:
        await session.run(
            """
            MERGE (p:Package {id: $id, analysisId: $analysisId})
            SET p.label = $name, p.version = $version,
                p.isDev = $isDev,
                p.findingCount = $findingCount,
                p.severity = $severity
            """,
            id=pkg_id,
            analysisId=analysis_id,
            name=name,
            version=version,
            isDev=is_dev,
            findingCount=finding_count,
            severity=severity,
        )


async def write_edge(
    analysis_id: str,
    edge_id: str,
    source_id: str,
    target_id: str,
    rel_type: str,
    is_vulnerability_chain: bool = False,
    chain_id: str | None = None,
) -> None:
    """
    rel_type must be one of: CONTAINS, IMPORTS, DEPENDS_ON, CALLS, HANDLES
    """
    driver = _get_driver()
    if not driver:
        return
    rel_type_upper = rel_type.upper().replace(" ", "_")
    async with driver.session(database="neo4j") as session:
        await session.run(
            f"""
            MATCH (a {{id: $sourceId, analysisId: $analysisId}})
            MATCH (b {{id: $targetId, analysisId: $analysisId}})
            MERGE (a)-[r:{rel_type_upper} {{id: $edgeId}}]->(b)
            SET r.isVulnerabilityChain = $isVulnerabilityChain,
                r.chainId = $chainId,
                r.type = $type
            """,
            sourceId=source_id,
            targetId=target_id,
            analysisId=analysis_id,
            edgeId=edge_id,
            isVulnerabilityChain=is_vulnerability_chain,
            chainId=chain_id,
            type=rel_type.lower(),
        )


async def mark_finding_on_node(
    analysis_id: str,
    node_id: str,
    severity: str,
) -> None:
    """Increment findingCount and set severity on an existing node."""
    driver = _get_driver()
    if not driver:
        return
    async with driver.session(database="neo4j") as session:
        await session.run(
            """
            MATCH (n {id: $id, analysisId: $analysisId})
            SET n.findingCount = coalesce(n.findingCount, 0) + 1,
                n.severity = CASE
                  WHEN $severity = 'critical' THEN 'critical'
                  WHEN n.severity = 'critical' THEN 'critical'
                  WHEN $severity = 'warning' AND n.severity <> 'critical' THEN 'warning'
                  ELSE coalesce(n.severity, 'healthy')
                END
            """,
            id=node_id,
            analysisId=analysis_id,
            severity=severity,
        )


async def write_finding_node(
    analysis_id: str,
    finding_id: str,
    title: str,
    severity: str,
    finding_type: str,
    agent: str,
    description: str = "",
) -> None:
    """Write a Finding node to the graph (for blast radius and chain analysis)."""
    driver = _get_driver()
    if not driver:
        return
    async with driver.session(database="neo4j") as session:
        await session.run(
            """
            MERGE (f:Finding {id: $id, analysisId: $analysisId})
            SET f.title = $title, f.severity = $severity,
                f.type = $type, f.agent = $agent, f.description = $description
            """,
            id=finding_id,
            analysisId=analysis_id,
            title=title[:500],
            severity=severity,
            type=finding_type or "finding",
            agent=agent or "unknown",
            description=(description or "")[:2000],
        )


async def write_cve_node(
    analysis_id: str,
    cve_id: str,
    cvss_score: float | None = None,
    description: str = "",
    fixed_version: str = "",
) -> None:
    """Write a CVE node to the graph."""
    driver = _get_driver()
    if not driver:
        return
    async with driver.session(database="neo4j") as session:
        await session.run(
            """
            MERGE (c:CVE {id: $id, analysisId: $analysisId})
            SET c.cvssScore = $cvssScore, c.description = $description,
                c.fixedVersion = $fixedVersion
            """,
            id=cve_id,
            analysisId=analysis_id,
            cvssScore=cvss_score,
            description=(description or "")[:1000],
            fixedVersion=fixed_version or "",
        )


async def write_fix_node(
    analysis_id: str,
    fix_id: str,
    title: str,
    priority: int = 0,
    finding_id: str = "",
) -> None:
    """Write a Fix node and optional RESOLVES edge to Finding."""
    driver = _get_driver()
    if not driver:
        return
    async with driver.session(database="neo4j") as session:
        await session.run(
            """
            MERGE (x:Fix {id: $id, analysisId: $analysisId})
            SET x.title = $title, x.priority = $priority
            """,
            id=fix_id,
            analysisId=analysis_id,
            title=title[:500],
            priority=priority,
        )
        if finding_id:
            await session.run(
                """
                MATCH (fix:Fix {id: $fixId, analysisId: $analysisId})
                MATCH (f:Finding {id: $findingId, analysisId: $analysisId})
                MERGE (fix)-[:RESOLVES]->(f)
                """,
                fixId=fix_id,
                findingId=finding_id,
                analysisId=analysis_id,
            )


async def write_affects_edge(
    analysis_id: str,
    finding_id: str,
    node_id: str,
) -> None:
    """Create AFFECTS relationship from Finding to File/Package/Function."""
    driver = _get_driver()
    if not driver:
        return
    async with driver.session(database="neo4j") as session:
        await session.run(
            """
            MATCH (f:Finding {id: $findingId, analysisId: $analysisId})
            MATCH (n {id: $nodeId, analysisId: $analysisId})
            MERGE (f)-[:AFFECTS]->(n)
            """,
            findingId=finding_id,
            nodeId=node_id,
            analysisId=analysis_id,
        )


async def write_has_cve_edge(
    analysis_id: str,
    finding_id: str,
    cve_id: str,
) -> None:
    """Create HAS_CVE relationship from Finding to CVE."""
    driver = _get_driver()
    if not driver:
        return
    async with driver.session(database="neo4j") as session:
        await session.run(
            """
            MATCH (f:Finding {id: $findingId, analysisId: $analysisId})
            MATCH (c:CVE {id: $cveId, analysisId: $analysisId})
            MERGE (f)-[:HAS_CVE]->(c)
            """,
            findingId=finding_id,
            cveId=cve_id,
            analysisId=analysis_id,
        )


# ============================================================
# READ helpers (used by graph router)
# ============================================================

async def get_graph_nodes(analysis_id: str) -> list[dict[str, Any]]:
    """Return all nodes for an analysis as dicts compatible with GraphNode schema."""
    driver = _get_driver()
    if not driver:
        return []
    async with driver.session(database="neo4j") as session:
        result = await session.run(
            """
            MATCH (n {analysisId: $analysisId})
            RETURN n.id AS id,
                   toLower(labels(n)[0]) AS type,
                   n.label AS label,
                   n.path AS path,
                   n.category AS category,
                   n.language AS language,
                   n.lines AS lines,
                   n.severity AS severity,
                   coalesce(n.findingCount, 0) AS findingCount,
                   n AS metadata
            ORDER BY n.findingCount DESC
            """,
            analysisId=analysis_id,
        )
        rows = await result.data()
        nodes = []
        for r in rows:
            nodes.append({
                "id": r["id"],
                "type": r["type"] or "file",
                "label": r["label"] or r["id"],
                "path": r["path"],
                "category": r["category"],
                "language": r["language"],
                "lines": r["lines"],
                "severity": r["severity"],
                "findingCount": r["findingCount"],
                "metadata": {},
            })
        return nodes


async def get_graph_edges(analysis_id: str, view: str = "structure") -> list[dict[str, Any]]:
    """Return edges filtered by view mode."""
    driver = _get_driver()
    if not driver:
        return []

    if view == "structure":
        rel_filter = "r:CONTAINS"
    elif view == "dependencies":
        rel_filter = "r:IMPORTS|DEPENDS_ON|CALLS|HANDLES"
    else:
        rel_filter = "r"

    async with driver.session(database="neo4j") as session:
        result = await session.run(
            f"""
            MATCH (a {{analysisId: $analysisId}})-[{rel_filter}]->(b {{analysisId: $analysisId}})
            RETURN r.id AS id,
                   a.id AS source,
                   b.id AS target,
                   r.type AS type,
                   coalesce(r.isVulnerabilityChain, false) AS isVulnerabilityChain,
                   r.chainId AS chainId
            """,
            analysisId=analysis_id,
        )
        rows = await result.data()
        return [
            {
                "id": r["id"] or f"{r['source']}-{r['target']}",
                "source": r["source"],
                "target": r["target"],
                "type": r["type"] or "contains",
                "isVulnerabilityChain": bool(r["isVulnerabilityChain"]),
                "chainId": r["chainId"],
            }
            for r in rows
        ]


async def get_blast_radius(analysis_id: str, node_id: str, depth: int = 3) -> dict[str, int]:
    """BFS from a node to count affected files/functions/endpoints within `depth` hops.
    Uses variable-length path (no APOC required).
    """
    driver = _get_driver()
    if not driver:
        return {"files": 0, "functions": 0, "endpoints": 0}
    async with driver.session(database="neo4j") as session:
        # Pure Cypher BFS — no APOC required (Community Edition compatible)
        result = await session.run(
            """
            MATCH (start {id: $nodeId, analysisId: $analysisId})
            MATCH path = (start)-[*1..$depth]->(node)
            WHERE node.analysisId = $analysisId
            WITH collect(DISTINCT node) AS nodes
            RETURN
              size([n IN nodes WHERE 'File' IN labels(n)]) AS files,
              size([n IN nodes WHERE 'Function' IN labels(n)]) AS functions,
              size([n IN nodes WHERE 'Endpoint' IN labels(n)]) AS endpoints
            """,
            nodeId=node_id,
            analysisId=analysis_id,
            depth=depth,
        )
        row = await result.single()
        if row:
            return {"files": row["files"] or 0, "functions": row["functions"] or 0, "endpoints": row["endpoints"] or 0}
        return {"files": 0, "functions": 0, "endpoints": 0}


async def get_vulnerability_chains_from_graph(analysis_id: str) -> list[dict[str, Any]]:
    """Return all vulnerability chain paths stored as edges."""
    driver = _get_driver()
    if not driver:
        return []
    async with driver.session(database="neo4j") as session:
        result = await session.run(
            """
            MATCH p=(a {analysisId: $analysisId})-[r* {isVulnerabilityChain: true}]->(b {analysisId: $analysisId})
            WHERE r[0].chainId IS NOT NULL
            RETURN r[0].chainId AS chainId,
                   [n IN nodes(p) | n.id] AS nodeIds,
                   [rel IN r | rel.type] AS relTypes
            LIMIT 50
            """,
            analysisId=analysis_id,
        )
        return await result.data()


async def clear_analysis_graph(analysis_id: str) -> None:
    """Remove all nodes and edges for a given analysis (used before re-run)."""
    driver = _get_driver()
    if not driver:
        return
    async with driver.session(database="neo4j") as session:
        await session.run(
            "MATCH (n {analysisId: $analysisId}) DETACH DELETE n",
            analysisId=analysis_id,
        )


# ============================================================
# SCHEMA INITIALIZATION (run once at startup)
# ============================================================

# Community Edition uniqueness constraints (single property only — composite NODE KEY is Enterprise-only)
_CONSTRAINTS = [
    "CREATE CONSTRAINT repo_url_unique IF NOT EXISTS FOR (n:Repository) REQUIRE n.url IS UNIQUE",
]

# Composite lookup indexes — compatible with Neo4j 5 Community Edition
_INDEXES = [
    # Fast lookup by analysisId (every query scopes by this)
    "CREATE INDEX file_analysis IF NOT EXISTS FOR (n:File) ON (n.analysisId)",
    "CREATE INDEX dir_analysis IF NOT EXISTS FOR (n:Directory) ON (n.analysisId)",
    "CREATE INDEX func_analysis IF NOT EXISTS FOR (n:Function) ON (n.analysisId)",
    "CREATE INDEX pkg_analysis IF NOT EXISTS FOR (n:Package) ON (n.analysisId)",
    # Composite index for efficient MERGE (id + analysisId)
    "CREATE INDEX file_id_analysis IF NOT EXISTS FOR (n:File) ON (n.id, n.analysisId)",
    "CREATE INDEX dir_id_analysis IF NOT EXISTS FOR (n:Directory) ON (n.id, n.analysisId)",
    "CREATE INDEX func_id_analysis IF NOT EXISTS FOR (n:Function) ON (n.id, n.analysisId)",
    "CREATE INDEX pkg_id_analysis IF NOT EXISTS FOR (n:Package) ON (n.id, n.analysisId)",
    # Severity filtering
    "CREATE INDEX file_severity IF NOT EXISTS FOR (n:File) ON (n.severity)",
]


async def initialize_schema() -> bool:
    """Create constraints and indexes if they don't exist. Safe to call multiple times."""
    driver = _get_driver()
    if not driver:
        logger.warning("Neo4j not available — skipping schema initialization")
        return False
    try:
        async with driver.session(database="neo4j") as session:
            for stmt in _CONSTRAINTS + _INDEXES:
                try:
                    await session.run(stmt)
                except Exception as exc:
                    # Non-fatal: constraint/index may already exist under a different name
                    logger.debug("Schema stmt skipped (%s): %s", type(exc).__name__, stmt[:60])
        logger.info("Neo4j schema initialized (constraints + indexes applied)")
        return True
    except Exception as exc:
        logger.warning("Neo4j schema initialization failed: %s", exc)
        return False
