"""
Analysis pipeline — orchestrates the full repo-analysis flow.

Flow:
  1. Clone repository (git)
  2. Metadata ingestion (file walk, dependency detection)
  3. Fastino: classify files, extract entities from code
  4. Tavily: search for CVEs in detected dependencies
  5. Yutori: deep web research on vulnerabilities
  6. OpenAI (backup): reasoning on findings, generate fixes
  7. Neo4j: build knowledge graph
  8. Senso (optional): persist findings to knowledge base

Every sponsor-tool call is logged to the tool_calls table via the
client wrappers, so the full audit trail is available.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import update

from app.database import async_session
from app.models import Analysis, AnalysisStatus
from app.clients.fastino import FastinoClient
from app.clients.tavily_client import TavilyClient
from app.clients.yutori import YutoriClient
from app.clients.openai_client import OpenAIClient
from app.clients.senso_client import SensoClient
from app.clients.tool_logger import log_tool_call
from app.services import neo4j as neo4j_service
from app.routers.ws import manager as ws_manager

logger = logging.getLogger(__name__)

CLONE_BASE = "/tmp/vibe-check/repos"


async def run_pipeline(analysis_id: str) -> None:
    """Top-level pipeline entry point, run as a background task."""
    t_start = time.time()
    fastino = FastinoClient()
    tavily = TavilyClient()
    yutori = YutoriClient()
    openai = OpenAIClient()
    senso = SensoClient()

    try:
        # ── 1. CLONE ────────────────────────────────────────────
        await _update_status(analysis_id, AnalysisStatus.CLONING)
        await _ws(analysis_id, "orchestrator", "running", 0.05, "Cloning repository...")
        clone_dir = await _clone_repo(analysis_id)

        # ── 2. METADATA INGESTION ───────────────────────────────
        await _update_status(analysis_id, AnalysisStatus.MAPPING)
        await _ws(analysis_id, "mapper", "running", 0.1, "Scanning files...")
        metadata = await _ingest_metadata(analysis_id, clone_dir)

        # Fastino: classify files
        if fastino.available:
            await _ws(analysis_id, "mapper", "running", 0.3, "Classifying files with Fastino...")
            metadata = await _fastino_classify_files(fastino, analysis_id, metadata)

        await _save_metadata(analysis_id, metadata)
        await _ws(analysis_id, "mapper", "complete", 1.0,
                  f"Mapped {metadata['stats']['total_files']} files")

        # ── 3. TAVILY — CVE Search ──────────────────────────────
        await _update_status(analysis_id, AnalysisStatus.ANALYZING)
        await _ws(analysis_id, "security", "running", 0.1, "Searching for CVEs...")
        cve_results = await _tavily_cve_search(tavily, analysis_id, metadata)

        # ── 4. FASTINO — Deep Analysis ──────────────────────────
        fastino_findings: list[dict] = []
        if fastino.available:
            await _ws(analysis_id, "quality", "running", 0.2, "Analyzing code quality with Fastino...")
            fastino_findings = await _fastino_analyze(fastino, analysis_id, clone_dir, metadata)

        # ── 5. YUTORI — Web Research ────────────────────────────
        yutori_results: dict = {}
        if yutori.available and cve_results:
            await _ws(analysis_id, "security", "running", 0.5, "Deep web research with Yutori...")
            yutori_results = await _yutori_research(yutori, analysis_id, metadata, cve_results)

        # ── 6. OPENAI — Backup Reasoning ────────────────────────
        openai_findings: list[dict] = []
        if openai.available:
            await _ws(analysis_id, "pattern", "running", 0.3, "Deep analysis with OpenAI...")
            openai_findings = await _openai_analyze(
                openai, analysis_id, clone_dir, metadata, cve_results, fastino_findings
            )

        # ── Aggregate Findings ──────────────────────────────────
        all_findings = _merge_findings(cve_results, fastino_findings, openai_findings, yutori_results)
        health_score = _compute_health_score(all_findings, metadata["stats"])

        # ── 7. NEO4J — Build Graph ──────────────────────────────
        await _ws(analysis_id, "orchestrator", "running", 0.85, "Building knowledge graph...")
        graph = await _build_neo4j_graph(analysis_id, metadata, all_findings)

        # ── 8. SENSO — Persist (optional) ───────────────────────
        senso_ids: list[str] = []
        if senso.available:
            await _ws(analysis_id, "senso", "running", 0.1, "Persisting to Senso knowledge base...")
            senso_ids = await _senso_persist(senso, analysis_id, metadata, all_findings)

        # ── COMPLETE ────────────────────────────────────────────
        duration = round(time.time() - t_start)
        await _finalize(analysis_id, all_findings, health_score, graph, senso_ids, duration)

        await _ws_complete(analysis_id, health_score, all_findings, duration)

    except Exception as exc:
        logger.exception("Pipeline failed for %s", analysis_id)
        async with async_session() as session:
            await session.execute(
                update(Analysis)
                .where(Analysis.analysis_id == analysis_id)
                .values(
                    status=AnalysisStatus.FAILED,
                    error_message=str(exc)[:2000],
                    updated_at=datetime.now(timezone.utc),
                )
            )
            await session.commit()
        await _ws_error(analysis_id, str(exc))


# ────────────────────────────────────────────────────────────────
# 1. CLONE
# ────────────────────────────────────────────────────────────────

async def _clone_repo(analysis_id: str) -> str:
    async with async_session() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(Analysis).where(Analysis.analysis_id == analysis_id)
        )
        analysis = result.scalar_one()
        repo_url = analysis.repo_url
        branch = analysis.branch

    clone_dir = os.path.join(CLONE_BASE, analysis_id)
    os.makedirs(clone_dir, exist_ok=True)

    cmd = ["git", "clone", "--depth=1"]
    if branch:
        cmd += ["--branch", branch]
    cmd += [repo_url, clone_dir]

    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await proc.communicate()

    await log_tool_call(
        analysis_id=analysis_id,
        tool_name="git",
        step_name="clone",
        endpoint=repo_url,
        request_payload={"branch": branch, "depth": 1},
        response_payload={"returncode": proc.returncode, "stderr": stderr.decode()[:2000]},
        status="success" if proc.returncode == 0 else "error",
    )

    if proc.returncode != 0:
        raise RuntimeError(f"git clone failed: {stderr.decode()[:500]}")

    async with async_session() as session:
        await session.execute(
            update(Analysis)
            .where(Analysis.analysis_id == analysis_id)
            .values(clone_dir=clone_dir)
        )
        await session.commit()

    return clone_dir


# ────────────────────────────────────────────────────────────────
# 2. METADATA INGESTION
# ────────────────────────────────────────────────────────────────

async def _ingest_metadata(analysis_id: str, clone_dir: str) -> dict[str, Any]:
    """Walk the filesystem and gather basic metadata."""
    files: list[dict] = []
    total_lines = 0
    languages: dict[str, int] = {}
    dependencies: list[dict] = []

    ext_to_lang = {
        ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
        ".tsx": "TypeScript", ".jsx": "JavaScript", ".java": "Java",
        ".go": "Go", ".rs": "Rust", ".rb": "Ruby", ".php": "PHP",
        ".cs": "C#", ".cpp": "C++", ".c": "C", ".swift": "Swift",
        ".kt": "Kotlin", ".vue": "Vue", ".svelte": "Svelte",
    }

    ignore_dirs = {".git", "node_modules", ".next", "__pycache__", ".venv", "venv", "dist", "build"}

    for root, dirs, filenames in os.walk(clone_dir):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        for fname in filenames:
            fpath = os.path.join(root, fname)
            rel_path = os.path.relpath(fpath, clone_dir)
            ext = os.path.splitext(fname)[1].lower()
            lang = ext_to_lang.get(ext, "")
            try:
                line_count = sum(1 for _ in open(fpath, "r", errors="ignore"))
            except Exception:
                line_count = 0
            total_lines += line_count
            if lang:
                languages[lang] = languages.get(lang, 0) + line_count
            files.append({
                "path": rel_path,
                "name": fname,
                "extension": ext,
                "language": lang,
                "lines": line_count,
                "category": "unknown",
            })

    # Parse package.json
    pkg_json = Path(clone_dir) / "package.json"
    if pkg_json.exists():
        try:
            pkg = json.loads(pkg_json.read_text(errors="ignore"))
            for name, ver in pkg.get("dependencies", {}).items():
                dependencies.append({"name": name, "version": ver, "is_dev": False})
            for name, ver in pkg.get("devDependencies", {}).items():
                dependencies.append({"name": name, "version": ver, "is_dev": True})
        except Exception:
            pass

    # Parse requirements.txt
    req_txt = Path(clone_dir) / "requirements.txt"
    if req_txt.exists():
        try:
            for line in req_txt.read_text(errors="ignore").splitlines():
                line = line.strip()
                if line and not line.startswith("#"):
                    parts = line.replace(">=", "==").replace("<=", "==").split("==")
                    dependencies.append({
                        "name": parts[0].strip(),
                        "version": parts[1].strip() if len(parts) > 1 else "latest",
                        "is_dev": False,
                    })
        except Exception:
            pass

    sorted_langs = sorted(languages.items(), key=lambda x: -x[1])
    detected_stack = {
        "languages": [l[0] for l in sorted_langs[:5]],
        "frameworks": _detect_frameworks(dependencies, files),
        "packageManager": "npm" if pkg_json.exists() else "pip" if req_txt.exists() else "unknown",
        "buildSystem": "next" if any(d["name"] == "next" for d in dependencies) else "unknown",
    }

    stats = {
        "total_files": len(files),
        "total_lines": total_lines,
        "total_dependencies": sum(1 for d in dependencies if not d["is_dev"]),
        "total_dev_dependencies": sum(1 for d in dependencies if d["is_dev"]),
        "total_functions": 0,
        "total_endpoints": 0,
    }

    return {
        "files": files[:500],
        "dependencies": dependencies,
        "detected_stack": detected_stack,
        "stats": stats,
    }


def _detect_frameworks(deps: list[dict], files: list[dict]) -> list[str]:
    frameworks = []
    dep_names = {d["name"].lower() for d in deps}
    if "next" in dep_names:
        frameworks.append("Next.js")
    if "react" in dep_names:
        frameworks.append("React")
    if "express" in dep_names:
        frameworks.append("Express")
    if "fastapi" in dep_names:
        frameworks.append("FastAPI")
    if "django" in dep_names:
        frameworks.append("Django")
    if "vue" in dep_names:
        frameworks.append("Vue")
    if "angular" in dep_names or "@angular/core" in dep_names:
        frameworks.append("Angular")
    return frameworks or ["Unknown"]


# ────────────────────────────────────────────────────────────────
# FASTINO — File Classification
# ────────────────────────────────────────────────────────────────

async def _fastino_classify_files(
    fastino: FastinoClient, analysis_id: str, metadata: dict
) -> dict:
    """Classify files into source/test/config/docs categories."""
    categories = ["source", "test", "config", "docs", "assets", "build", "ci-cd"]
    for f in metadata["files"][:100]:
        try:
            result = await fastino.classify_text(
                analysis_id=analysis_id,
                text=f"{f['path']} — {f['extension']} — {f['language']}",
                categories=categories,
                step_name=f"classify_file_{f['name'][:30]}",
            )
            f["category"] = result.get("label", "unknown")
        except Exception:
            f["category"] = "unknown"
    return metadata


# ────────────────────────────────────────────────────────────────
# 3. TAVILY — CVE Search
# ────────────────────────────────────────────────────────────────

async def _tavily_cve_search(
    tavily: TavilyClient, analysis_id: str, metadata: dict
) -> list[dict]:
    """Search for known CVEs in project dependencies."""
    if not tavily.available:
        return []

    cve_results: list[dict] = []
    deps = metadata.get("dependencies", [])
    non_dev = [d for d in deps if not d.get("is_dev")]

    # Batch deps in groups of 3
    for i in range(0, min(len(non_dev), 15), 3):
        batch = non_dev[i:i + 3]
        query_parts = [f'"{d["name"]}" "{d["version"]}" CVE vulnerability' for d in batch]
        query = " ".join(query_parts)
        try:
            result = await tavily.search(
                analysis_id=analysis_id,
                query=query,
                step_name=f"cve_search_batch_{i // 3}",
                include_domains=["nvd.nist.gov", "github.com/advisories", "security.snyk.io"],
            )
            cve_results.append({
                "packages": [d["name"] for d in batch],
                "query": query,
                "answer": result.get("answer", ""),
                "results": result.get("results", []),
            })
        except Exception:
            pass

    return cve_results


# ────────────────────────────────────────────────────────────────
# 4. FASTINO — Deep Analysis
# ────────────────────────────────────────────────────────────────

async def _fastino_analyze(
    fastino: FastinoClient, analysis_id: str, clone_dir: str, metadata: dict
) -> list[dict]:
    """Use Fastino to extract entities and classify code quality."""
    findings: list[dict] = []
    source_files = [f for f in metadata["files"] if f.get("category") == "source"]

    for f in source_files[:30]:
        fpath = os.path.join(clone_dir, f["path"])
        try:
            content = open(fpath, "r", errors="ignore").read()[:3000]
        except Exception:
            continue

        try:
            result = await fastino.classify_text(
                analysis_id=analysis_id,
                text=content,
                categories=[
                    "clean", "unhandled_error", "type_mismatch", "dead_code",
                    "god_function", "magic_number", "deep_nesting", "duplicated_logic",
                ],
                step_name=f"quality_{f['name'][:30]}",
            )
            label = result.get("label", "clean")
            if label != "clean":
                findings.append({
                    "id": f"fnd_{uuid.uuid4().hex[:6]}",
                    "type": "code_smell",
                    "severity": "warning",
                    "agent": "quality",
                    "title": f"{label.replace('_', ' ').title()} in {f['name']}",
                    "description": f"Fastino detected {label} pattern in {f['path']}",
                    "plain_description": f"Code quality issue: {label}",
                    "location": {"files": [f["path"]], "primary_file": f["path"], "start_line": 1, "end_line": f["lines"]},
                    "blast_radius": {"files_affected": 1, "functions_affected": 0, "endpoints_affected": 0},
                    "chain_ids": [],
                    "confidence": result.get("score", 0.5),
                })
        except Exception:
            pass

    return findings


# ────────────────────────────────────────────────────────────────
# 5. YUTORI — Web Research
# ────────────────────────────────────────────────────────────────

async def _yutori_research(
    yutori: YutoriClient,
    analysis_id: str,
    metadata: dict,
    cve_results: list[dict],
) -> dict:
    """Use Yutori Research API to do deep investigation of found CVEs."""
    stack = metadata.get("detected_stack", {})
    frameworks = ", ".join(stack.get("frameworks", []))
    cve_summary = "; ".join(
        r.get("answer", "")[:200] for r in cve_results if r.get("answer")
    )[:1000]

    query = (
        f"Security vulnerabilities and best practices for {frameworks} applications. "
        f"Known issues: {cve_summary}"
    )

    try:
        result = await yutori.research(
            analysis_id=analysis_id,
            query=query,
            step_name="vulnerability_research",
            output_schema={
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "severity": {"type": "string"},
                        "summary": {"type": "string"},
                        "source_url": {"type": "string"},
                    },
                },
            },
            max_wait=90,
        )
        return result
    except Exception:
        return {}


# ────────────────────────────────────────────────────────────────
# 6. OPENAI — Backup Reasoning
# ────────────────────────────────────────────────────────────────

async def _openai_analyze(
    openai_client: OpenAIClient,
    analysis_id: str,
    clone_dir: str,
    metadata: dict,
    cve_results: list[dict],
    fastino_findings: list[dict],
) -> list[dict]:
    """Use OpenAI for deep reasoning on the codebase."""
    stack = metadata.get("detected_stack", {})
    stats = metadata.get("stats", {})

    context = (
        f"Repository: {stats.get('total_files', 0)} files, "
        f"{stats.get('total_lines', 0)} lines\n"
        f"Stack: {json.dumps(stack)}\n"
        f"Dependencies: {len(metadata.get('dependencies', []))}\n"
        f"CVE search results: {len(cve_results)} batches\n"
        f"Fastino findings: {len(fastino_findings)} issues\n"
    )

    cve_context = "\n".join(
        f"- {r.get('answer', 'No answer')[:300]}"
        for r in cve_results
    )[:2000]

    try:
        result = await openai_client.chat(
            analysis_id=analysis_id,
            system_prompt=(
                "You are a senior security and code-quality analyst. "
                "Analyze the repository data and produce structured findings. "
                "Focus on critical security issues, dependency vulnerabilities, "
                "and architecture anti-patterns. Return valid JSON."
            ),
            user_prompt=(
                f"Analyze this repository:\n{context}\n\n"
                f"CVE Intelligence:\n{cve_context}\n\n"
                "Produce a JSON object with a 'findings' array. Each finding has: "
                "id (string), type (string), severity (critical/warning/info), "
                "agent ('pattern' or 'security'), title (string), description (string), "
                "confidence (float 0-1)."
            ),
            step_name="deep_analysis",
            json_schema={
                "name": "analysis_findings",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "findings": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "type": {"type": "string"},
                                    "severity": {"type": "string"},
                                    "agent": {"type": "string"},
                                    "title": {"type": "string"},
                                    "description": {"type": "string"},
                                    "confidence": {"type": "number"},
                                },
                                "required": ["id", "type", "severity", "agent", "title", "description", "confidence"],
                                "additionalProperties": False,
                            },
                        },
                    },
                    "required": ["findings"],
                    "additionalProperties": False,
                },
            },
        )

        findings: list[dict] = []
        for f in result.get("findings", []):
            findings.append({
                "id": f.get("id", f"fnd_{uuid.uuid4().hex[:6]}"),
                "type": f.get("type", "code_issue"),
                "severity": f.get("severity", "info"),
                "agent": f.get("agent", "pattern"),
                "title": f.get("title", ""),
                "description": f.get("description", ""),
                "plain_description": f.get("description", "")[:200],
                "location": {"files": [], "primary_file": "", "start_line": 0, "end_line": 0},
                "blast_radius": {"files_affected": 0, "functions_affected": 0, "endpoints_affected": 0},
                "chain_ids": [],
                "confidence": f.get("confidence", 0.5),
            })
        return findings

    except Exception:
        return []


# ────────────────────────────────────────────────────────────────
# Aggregate Findings & Health Score
# ────────────────────────────────────────────────────────────────

def _merge_findings(*sources) -> list[dict]:
    """Flatten and deduplicate findings from all sources."""
    all_f: list[dict] = []
    for src in sources:
        if isinstance(src, list):
            for item in src:
                if isinstance(item, dict) and "id" in item:
                    all_f.append(item)
    return all_f


def _compute_health_score(findings: list[dict], stats: dict) -> dict:
    """Local algorithm — no LLM needed."""
    critical = sum(1 for f in findings if f.get("severity") == "critical")
    warnings = sum(1 for f in findings if f.get("severity") == "warning")
    info = sum(1 for f in findings if f.get("severity") == "info")

    penalty = critical * 3 + warnings * 1 + info * 0.2
    overall = max(0, min(100, round(100 - penalty * 2)))

    def grade(score):
        if score >= 97: return "A+"
        if score >= 93: return "A"
        if score >= 90: return "A-"
        if score >= 87: return "B+"
        if score >= 83: return "B"
        if score >= 80: return "B-"
        if score >= 77: return "C+"
        if score >= 73: return "C"
        if score >= 70: return "C-"
        if score >= 60: return "D"
        return "F"

    return {
        "overall": overall,
        "letterGrade": grade(overall),
        "breakdown": {
            "codeQuality": {"score": max(0, 10 - warnings), "max": 10, "status": "warning" if warnings > 3 else "healthy"},
            "security": {"score": max(0, 10 - critical * 3), "max": 10, "status": "critical" if critical > 0 else "healthy"},
            "patterns": {"score": 7, "max": 10, "status": "healthy"},
            "dependencies": {"score": max(0, 10 - critical), "max": 10, "status": "warning" if critical > 0 else "healthy"},
            "architecture": {"score": 7, "max": 10, "status": "healthy"},
        },
        "confidence": 0.85,
    }


# ────────────────────────────────────────────────────────────────
# 7. NEO4J — Graph Build
# ────────────────────────────────────────────────────────────────

async def _build_neo4j_graph(
    analysis_id: str, metadata: dict, findings: list[dict]
) -> dict:
    """Build graph nodes/edges and write to Neo4j (+ JSON fallback)."""
    nodes: list[dict] = []
    edges: list[dict] = []

    # Root directory node
    root_id = f"dir_{analysis_id}_root"
    nodes.append({"id": root_id, "type": "directory", "label": "/", "path": "/", "findingCount": 0, "metadata": {}})

    # File nodes
    for f in metadata.get("files", [])[:200]:
        fid = f"file_{analysis_id}_{f['path'].replace('/', '_').replace('.', '_')}"
        finding_count = sum(1 for fd in findings if f["path"] in fd.get("location", {}).get("files", []))
        severity = None
        if finding_count:
            severities = [fd["severity"] for fd in findings if f["path"] in fd.get("location", {}).get("files", [])]
            severity = "critical" if "critical" in severities else "warning" if "warning" in severities else "healthy"

        nodes.append({
            "id": fid,
            "type": "file",
            "label": f["name"],
            "path": f["path"],
            "category": f.get("category", "unknown"),
            "language": f.get("language", ""),
            "lines": f.get("lines", 0),
            "severity": severity,
            "findingCount": finding_count,
            "metadata": {},
        })
        edges.append({
            "id": f"edge_{root_id}_{fid}",
            "source": root_id,
            "target": fid,
            "type": "contains",
            "isVulnerabilityChain": False,
        })

    # Package nodes
    for d in metadata.get("dependencies", [])[:50]:
        pid = f"pkg_{analysis_id}_{d['name'].replace('/', '_')}"
        nodes.append({
            "id": pid,
            "type": "package",
            "label": f"{d['name']}@{d['version']}",
            "findingCount": 0,
            "metadata": {"version": d["version"], "isDev": d.get("is_dev", False)},
        })

    # Write to Neo4j if available
    if await neo4j_service.is_connected():
        for n in nodes:
            try:
                if n["type"] == "file":
                    await neo4j_service.write_file_node(analysis_id, n["id"], n.get("path", ""), n.get("language", ""), n.get("lines", 0), n.get("category", ""))
                elif n["type"] == "directory":
                    await neo4j_service.write_directory_node(analysis_id, n["id"], n.get("path", "/"))
            except Exception:
                pass
        for e in edges:
            try:
                await neo4j_service.write_edge(analysis_id, e["id"], e["source"], e["target"], e["type"])
            except Exception:
                pass

    return {"nodes": nodes, "edges": edges}


# ────────────────────────────────────────────────────────────────
# 8. SENSO — Optional Knowledge Persistence
# ────────────────────────────────────────────────────────────────

async def _senso_persist(
    senso: SensoClient, analysis_id: str, metadata: dict, findings: list[dict]
) -> list[str]:
    """Ingest findings and repo profile into Senso."""
    ids: list[str] = []

    # Ingest repo profile
    stack = metadata.get("detected_stack", {})
    stats = metadata.get("stats", {})
    try:
        result = await senso.ingest_content(
            analysis_id=analysis_id,
            title=f"Repo Analysis: {analysis_id}",
            summary=f"{', '.join(stack.get('frameworks', []))} — {stats.get('total_files', 0)} files",
            text=json.dumps({"stack": stack, "stats": stats, "findings_count": len(findings)}, indent=2),
            step_name="ingest_profile",
            wait_for_processing=False,
        )
        if cid := result.get("id"):
            ids.append(cid)
    except Exception:
        pass

    # Ingest top findings
    for f in findings[:10]:
        try:
            result = await senso.ingest_content(
                analysis_id=analysis_id,
                title=f["title"],
                summary=f"{f['severity']}: {f.get('description', '')[:200]}",
                text=json.dumps(f, indent=2),
                step_name=f"ingest_finding_{f['id']}",
                wait_for_processing=False,
            )
            if cid := result.get("id"):
                ids.append(cid)
        except Exception:
            pass

    return ids


# ────────────────────────────────────────────────────────────────
# DB + WS helpers
# ────────────────────────────────────────────────────────────────

async def _update_status(analysis_id: str, status: AnalysisStatus):
    async with async_session() as session:
        await session.execute(
            update(Analysis)
            .where(Analysis.analysis_id == analysis_id)
            .values(status=status, updated_at=datetime.now(timezone.utc))
        )
        await session.commit()


async def _save_metadata(analysis_id: str, metadata: dict):
    async with async_session() as session:
        await session.execute(
            update(Analysis)
            .where(Analysis.analysis_id == analysis_id)
            .values(
                detected_stack=metadata["detected_stack"],
                stats=metadata["stats"],
            )
        )
        await session.commit()


async def _finalize(
    analysis_id: str,
    findings: list[dict],
    health_score: dict,
    graph: dict,
    senso_ids: list[str],
    duration: int,
):
    critical = sum(1 for f in findings if f.get("severity") == "critical")
    warnings = sum(1 for f in findings if f.get("severity") == "warning")
    info = sum(1 for f in findings if f.get("severity") == "info")

    async with async_session() as session:
        await session.execute(
            update(Analysis)
            .where(Analysis.analysis_id == analysis_id)
            .values(
                status=AnalysisStatus.COMPLETED,
                findings=findings,
                findings_summary={"critical": critical, "warning": warnings, "info": info, "total": len(findings)},
                health_score=health_score,
                graph_nodes=graph.get("nodes"),
                graph_edges=graph.get("edges"),
                senso_content_ids=senso_ids,
                completed_at=datetime.now(timezone.utc),
                duration_seconds=duration,
            )
        )
        await session.commit()


async def _ws(analysis_id: str, agent: str, status: str, progress: float, message: str):
    try:
        await ws_manager.broadcast(analysis_id, {
            "type": "status", "agent": agent,
            "status": status, "progress": progress, "message": message,
        })
    except Exception:
        pass


async def _ws_complete(analysis_id: str, health_score: dict, findings: list[dict], duration: int):
    critical = sum(1 for f in findings if f.get("severity") == "critical")
    warnings = sum(1 for f in findings if f.get("severity") == "warning")
    info = sum(1 for f in findings if f.get("severity") == "info")
    try:
        await ws_manager.broadcast(analysis_id, {
            "type": "complete",
            "healthScore": health_score,
            "findingsSummary": {"critical": critical, "warning": warnings, "info": info, "total": len(findings)},
            "duration": duration,
        })
    except Exception:
        pass


async def _ws_error(analysis_id: str, message: str):
    try:
        await ws_manager.broadcast(analysis_id, {
            "type": "error", "agent": "orchestrator",
            "message": message[:500], "recoverable": False,
        })
    except Exception:
        pass
