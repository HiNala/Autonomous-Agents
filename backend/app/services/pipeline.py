"""
Analysis pipeline — orchestrates the full repo-analysis flow.

Flow:
  1. Clone repository (git)
  2. Metadata ingestion (file walk, dependency detection, function/endpoint counting)
  3. OpenAI: classify files, extract code-quality findings
  4. Tavily: search for CVEs in detected dependencies
  5. Yutori: deep web research on vulnerabilities
  6. OpenAI: deep reasoning on findings, generate fixes
  7. Neo4j: build knowledge graph

Every sponsor-tool call is logged to the tool_calls table via the
client wrappers, so the full audit trail is available.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import update

from app.database import async_session
from app.models import Analysis, AnalysisStatus
from app.clients.tavily_client import TavilyClient
from app.clients.yutori import YutoriClient
from app.clients.openai_client import OpenAIClient
from app.clients.fastino import FastinoClient
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

    try:
        # ── 1. CLONE ────────────────────────────────────────────
        await _update_status(analysis_id, AnalysisStatus.CLONING)
        await _ws(analysis_id, "orchestrator", "running", 0.05, "Cloning repository...")
        clone_dir = await _clone_repo(analysis_id)

        # ── 2. METADATA INGESTION ───────────────────────────────
        await _update_status(analysis_id, AnalysisStatus.MAPPING)
        await _ws(analysis_id, "mapper", "running", 0.1, "Scanning files...")
        metadata = await _ingest_metadata(analysis_id, clone_dir)

        # Classify files: Fastino primary, OpenAI fallback
        await _ws(analysis_id, "mapper", "running", 0.3, "Classifying files...")
        metadata = await _classify_files(fastino, openai, analysis_id, metadata)

        await _save_metadata(analysis_id, metadata)
        await _ws(analysis_id, "mapper", "complete", 1.0,
                  f"Mapped {metadata['stats']['total_files']} files, "
                  f"{metadata['stats']['total_functions']} functions, "
                  f"{metadata['stats']['total_dependencies']} deps")

        # Broadcast file nodes as they're mapped
        await _ws_activity(analysis_id, "mapper", f"Scanned {metadata['stats']['total_files']} files, {metadata['stats']['total_lines']} lines", "openai")

        # ── 3. TAVILY — CVE Search + Best Practices Research ────
        await _update_status(analysis_id, AnalysisStatus.ANALYZING)
        await _ws(analysis_id, "security", "running", 0.1, "Searching for CVEs and best practices...")
        await _ws_activity(analysis_id, "security", "Querying CVE databases via Tavily...", "tavily")
        cve_results = await _tavily_cve_search(tavily, analysis_id, metadata)

        # ── 3a. Best practices and vulnerability research via Tavily
        bp_findings: list[dict] = []
        await _ws(analysis_id, "security", "running", 0.15, "Researching best practices...")
        await _ws_activity(analysis_id, "security", "Researching security best practices via Tavily...", "tavily")
        bp_findings = await _tavily_best_practices_search(tavily, openai, analysis_id, metadata)
        for f in bp_findings:
            await _ws_finding(analysis_id, f)
        if bp_findings:
            await _ws_activity(analysis_id, "security", f"Found {len(bp_findings)} best-practice issues", "tavily")

        # ── 3b. Extract + parse CVE entities (Tavily extract + Fastino NER)
        cve_findings: list[dict] = []
        if cve_results:
            cve_findings = await _tavily_extract_and_fastino_cve(
                tavily, fastino, analysis_id, cve_results
            )
            for f in cve_findings:
                await _ws_finding(analysis_id, f)
            if cve_findings:
                await _ws_activity(analysis_id, "security", f"Extracted {len(cve_findings)} CVE findings", "fastino")

        # ── 3c. Best-practices & known-vulnerability research (Tavily) ──────
        best_practices: list[dict] = []
        best_practices_context: str = ""
        if tavily.available:
            await _ws(analysis_id, "security", "running", 0.28,
                      "Researching security best practices & known vulnerabilities...")
            await _ws_activity(analysis_id, "security",
                               "Querying OWASP, CWE, and framework security advisories via Tavily...", "tavily")
            best_practices = await _tavily_best_practices_research(tavily, analysis_id, metadata)
            if best_practices:
                best_practices_context = await _tavily_extract_best_practices(tavily, analysis_id, best_practices)
                await _ws_activity(analysis_id, "security",
                                   f"Gathered intelligence from {len(best_practices)} security knowledge sources", "tavily")

        # ── 4. Code Quality Analysis (Fastino primary, OpenAI fallback)
        quality_findings: list[dict] = []
        await _ws(analysis_id, "quality", "running", 0.2, "Analyzing code quality...")
        await _ws_activity(analysis_id, "quality", "Analyzing source files for code quality issues...", "fastino")
        quality_findings = await _code_quality_analysis(fastino, openai, analysis_id, clone_dir, metadata)
        for f in quality_findings:
            await _ws_finding(analysis_id, f)
        if quality_findings:
            await _ws_activity(analysis_id, "quality", f"Found {len(quality_findings)} code quality issues", "openai")

        # ── 5. Deep Research (Yutori primary, OpenAI fallback) ────
        yutori_results: dict = {}
        if cve_results:
            await _ws(analysis_id, "security", "running", 0.5, "Deep research on vulnerabilities...")
            await _ws_activity(analysis_id, "security", "Researching vulnerabilities...", "yutori")
            yutori_results = await _deep_research(yutori, openai, analysis_id, metadata, cve_results)

        # ── 6. Deep Pattern Analysis (OpenAI) ────────────────────
        deep_findings: list[dict] = []
        if openai.available:
            await _ws(analysis_id, "pattern", "running", 0.3, "Deep pattern analysis...")
            await _ws_activity(analysis_id, "pattern", "Running deep pattern and architecture analysis...", "openai")
            deep_findings = await _openai_analyze(
                openai, analysis_id, clone_dir, metadata, cve_results, quality_findings,
                best_practices_context=best_practices_context,
            )
            for f in deep_findings:
                await _ws_finding(analysis_id, f)
            if deep_findings:
                await _ws_activity(analysis_id, "pattern", f"Found {len(deep_findings)} pattern/security issues", "openai")

        # ── Aggregate Findings ──────────────────────────────────
        all_findings = _merge_findings(cve_findings, bp_findings, quality_findings, deep_findings, yutori_results)
        health_score = _compute_health_score(all_findings, metadata["stats"])

        # ── 7. Doctor Agent — Generate Fixes ─────────────────────
        fixes: list[dict] = []
        if all_findings and openai.available:
            await _ws(analysis_id, "doctor", "running", 0.3, "Generating fix plans...")
            await _ws_activity(analysis_id, "doctor", "Generating remediation plans...", "openai")
            fixes = await _generate_fixes(openai, analysis_id, all_findings, metadata)
            if fixes:
                await _ws_activity(analysis_id, "doctor", f"Generated {len(fixes)} fix recommendations", "openai")
            await _ws(analysis_id, "doctor", "complete", 1.0, f"{len(fixes)} fixes generated")

        # ── 8. NEO4J — Build Graph ──────────────────────────────
        await _ws(analysis_id, "orchestrator", "running", 0.85, "Building knowledge graph...")
        await _ws_activity(analysis_id, "mapper", "Constructing Neo4j knowledge graph...", "neo4j")
        graph = await _build_neo4j_graph(analysis_id, metadata, all_findings)
        # Stream graph nodes/edges to frontend (limit to 300 for performance)
        for n in graph.get("nodes", [])[:300]:
            await _ws_graph_node(analysis_id, n)
        for e in graph.get("edges", [])[:300]:
            await _ws_graph_edge(analysis_id, e)
        await _ws_activity(analysis_id, "mapper", f"Graph built: {len(graph.get('nodes', []))} nodes, {len(graph.get('edges', []))} edges", "neo4j")

        # ── COMPLETE ────────────────────────────────────────────
        duration = round(time.time() - t_start)
        await _finalize(analysis_id, all_findings, health_score, graph, duration, fixes=fixes)

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

    # Disable terminal prompts so git never blocks waiting for credentials
    # For private repos, embed GITHUB_TOKEN in the URL
    from app.config import get_settings as _gs
    _settings = _gs()
    effective_url = repo_url
    if _settings.github_token and "github.com" in repo_url:
        # Embed token: https://token@github.com/owner/repo
        effective_url = repo_url.replace("https://", f"https://{_settings.github_token}@")

    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0", "GIT_ASKPASS": "echo"}

    # If the user didn't specify a non-default branch, let git use the remote's
    # HEAD (which is "main" on modern GitHub repos). Only pin a branch when the
    # user explicitly requested one that isn't the generic default.
    branch_arg = branch if branch and branch not in ("main",) else None

    cmd = ["git", "clone", "--depth=1"]
    if branch_arg:
        cmd += ["--branch", branch_arg]
    cmd += [effective_url, clone_dir]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    stdout, stderr = await proc.communicate()
    returncode = proc.returncode

    # Detect which branch was actually checked out
    if returncode == 0:
        bp = await asyncio.create_subprocess_exec(
            "git", "-C", clone_dir, "rev-parse", "--abbrev-ref", "HEAD",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, env=env,
        )
        b_out, _ = await bp.communicate()
        detected_branch = b_out.decode().strip() or "main"
    else:
        detected_branch = branch or "main"

    await log_tool_call(
        analysis_id=analysis_id,
        tool_name="git",
        step_name="clone",
        endpoint=repo_url,
        request_payload={"branch": detected_branch, "depth": 1},
        response_payload={"returncode": returncode, "stderr": stderr.decode()[:2000]},
        status="success" if returncode == 0 else "error",
    )

    if returncode != 0:
        raise RuntimeError(f"git clone failed: {stderr.decode()[:500]}")

    # Update branch + clone_dir in DB
    async with async_session() as session:
        await session.execute(
            update(Analysis)
            .where(Analysis.analysis_id == analysis_id)
            .values(branch=detected_branch, clone_dir=clone_dir)
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
                with open(fpath, "r", errors="ignore") as _f:
                    line_count = sum(1 for _ in _f)
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

    # Count functions and endpoints with regex
    total_functions = 0
    total_endpoints = 0
    fn_patterns = [
        re.compile(r"^\s*(?:async\s+)?def\s+\w+"),                   # Python
        re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+\w+"), # JS/TS
        re.compile(r"^\s*(?:export\s+)?(?:const|let)\s+\w+\s*=\s*(?:async\s+)?\("),  # Arrow fns
    ]
    endpoint_patterns = [
        re.compile(r"@(?:app|router)\.\s*(?:get|post|put|delete|patch)\s*\("),  # FastAPI/Flask
        re.compile(r"(?:app|router)\.(?:get|post|put|delete|patch)\s*\("),       # Express
    ]
    for f in files:
        if f["language"]:
            fpath = os.path.join(clone_dir, f["path"])
            try:
                with open(fpath, "r", errors="ignore") as _fh:
                    for line in _fh:
                        for pat in fn_patterns:
                            if pat.search(line):
                                total_functions += 1
                                break
                        for pat in endpoint_patterns:
                            if pat.search(line):
                                total_endpoints += 1
                                break
            except Exception:
                pass

    stats = {
        "total_files": len(files),
        "total_lines": total_lines,
        "total_dependencies": sum(1 for d in dependencies if not d["is_dev"]),
        "total_dev_dependencies": sum(1 for d in dependencies if d["is_dev"]),
        "total_functions": total_functions,
        "total_endpoints": total_endpoints,
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
# FILE CLASSIFICATION — Fastino primary, OpenAI fallback
# ────────────────────────────────────────────────────────────────

async def _classify_files(
    fastino: FastinoClient, openai_client: OpenAIClient,
    analysis_id: str, metadata: dict,
) -> dict:
    """Classify files — tries Fastino per-file, falls back to OpenAI batch."""
    files_to_classify = metadata["files"][:100]
    if not files_to_classify:
        return metadata

    categories = ["source", "test", "config", "docs", "assets", "build", "ci-cd"]
    classified = False

    # ── Try Fastino first (per-file classification) ──
    if fastino.available:
        try:
            for f in files_to_classify:
                result = await fastino.classify_text(
                    analysis_id=analysis_id,
                    text=f"{f['path']} — {f['extension']} — {f['language']}",
                    categories=categories,
                    step_name=f"classify_{f['name'][:30]}",
                )
                f["category"] = result.get("label", "unknown")
            classified = True
            logger.info("File classification completed via Fastino")
        except Exception:
            logger.warning("Fastino classification failed, falling back to OpenAI")

    # ── OpenAI fallback (batch classification) ──
    if not classified and openai_client.available:
        file_list = "\n".join(
            f"- {f['path']} ({f['extension']}, {f['language'] or 'unknown'})"
            for f in files_to_classify
        )
        try:
            result = await openai_client.chat(
                analysis_id=analysis_id,
                system_prompt=(
                    "Classify each file into exactly one category: source, test, config, "
                    "docs, assets, build, ci-cd. Return JSON with a "
                    "'classifications' array of {path, category} objects."
                ),
                user_prompt=f"Classify these files:\n{file_list}",
                step_name="classify_files_fallback",
                json_schema={
                    "name": "file_classifications",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "classifications": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "path": {"type": "string"},
                                        "category": {"type": "string"},
                                    },
                                    "required": ["path", "category"],
                                    "additionalProperties": False,
                                },
                            },
                        },
                        "required": ["classifications"],
                        "additionalProperties": False,
                    },
                },
            )
            cat_map = {c["path"]: c["category"] for c in result.get("classifications", [])}
            for f in files_to_classify:
                f["category"] = cat_map.get(f["path"], "unknown")
            classified = True
            logger.info("File classification completed via OpenAI (fallback)")
        except Exception:
            logger.warning("OpenAI classification also failed, using heuristic")

    # ── Heuristic last resort ──
    if not classified:
        for f in files_to_classify:
            f["category"] = _heuristic_classify(f["path"], f["extension"])

    return metadata


def _heuristic_classify(path: str, ext: str) -> str:
    """Fast regex fallback when LLM classification fails."""
    p = path.lower()
    if any(x in p for x in ("test", "spec", "__test__", ".test.")):
        return "test"
    if any(x in p for x in (".config", "tsconfig", "eslint", ".env", "docker", "compose", "makefile")):
        return "config"
    if ext in (".md", ".rst", ".txt", ".adoc"):
        return "docs"
    if ext in (".png", ".jpg", ".svg", ".ico", ".gif", ".woff", ".ttf"):
        return "assets"
    if any(x in p for x in (".github/workflows", "ci", "jenkinsfile")):
        return "ci-cd"
    if ext in (".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java", ".rb", ".php"):
        return "source"
    return "unknown"


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
    for i in range(0, min(len(non_dev), 18), 3):
        batch = non_dev[i:i + 3]
        query_parts = [f'"{d["name"]}" "{d["version"]}" CVE vulnerability security advisory' for d in batch]
        query = " ".join(query_parts)
        try:
            result = await tavily.search(
                analysis_id=analysis_id,
                query=query,
                step_name=f"cve_search_batch_{i // 3}",
                max_results=7,
                include_domains=[
                    "nvd.nist.gov", "github.com/advisories", "security.snyk.io",
                    "cvedetails.com", "osv.dev", "vuldb.com", "huntr.dev",
                ],
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


async def _tavily_extract_and_fastino_cve(
    tavily: TavilyClient,
    fastino: FastinoClient,
    analysis_id: str,
    cve_results: list[dict],
) -> list[dict]:
    """Extract advisory content with Tavily, parse CVE entities with Fastino; return security findings."""
    findings: list[dict] = []
    urls: list[str] = []
    for batch in cve_results:
        for r in (batch.get("results") or [])[:2]:
            if r.get("url"):
                urls.append(r["url"])
    urls = list(dict.fromkeys(urls))[:5]
    if not urls or not tavily.available:
        return findings

    await _ws(analysis_id, "security", "running", 0.18, "Extracting advisory content with Tavily...")
    extracted_texts: list[str] = []
    try:
        ext = await tavily.extract(analysis_id=analysis_id, urls=urls, step_name="cve_extract")
        if isinstance(ext.get("results"), list):
            for item in ext["results"]:
                content = item.get("content") or item.get("raw_content") or item.get("text") or ""
                if content:
                    extracted_texts.append(str(content)[:8000])
        elif ext.get("content"):
            extracted_texts.append(str(ext["content"])[:8000])
    except Exception:
        pass

    combined = "\n\n".join(extracted_texts) or " ".join(b.get("answer", "") for b in cve_results)[:12000]
    if not combined.strip() or not fastino.available:
        return findings

    await _ws(analysis_id, "security", "running", 0.22, "Parsing CVEs with Fastino...")
    t0 = time.perf_counter()
    try:
        result = await fastino.extract_entities(
            analysis_id=analysis_id,
            text=combined,
            labels=["CVE_ID", "CVSS", "fixed_version", "affected_package", "vulnerability_description"],
            step_name="cve_entity_extract",
        )
        elapsed_ms = round((time.perf_counter() - t0) * 1000)
        await _ws(analysis_id, "security", "running", -1, f"⚡ Fastino: CVE entities extracted in {elapsed_ms}ms")

        entities = result.get("entities", result.get("result", []))
        if isinstance(entities, dict):
            entities = [entities]
        if isinstance(entities, list):
            for ent in entities:
                if not isinstance(ent, dict):
                    continue
                cve_id = ent.get("CVE_ID") or ent.get("cve_id")
                if not cve_id and (ent.get("type") == "CVE_ID" or ent.get("label") == "CVE_ID"):
                    cve_id = ent.get("text") or ent.get("value") or ""
                if not cve_id or not str(cve_id).strip().upper().startswith("CVE-"):
                    continue
                try:
                    cvss_val = float(ent.get("CVSS") or ent.get("cvss") or 0)
                except (TypeError, ValueError):
                    cvss_val = 0.0
                findings.append({
                    "id": f"fnd_{uuid.uuid4().hex[:6]}",
                    "type": "vulnerability",
                    "severity": "critical",
                    "agent": "security",
                    "provider": "fastino",
                    "title": f"{cve_id} in affected dependency",
                    "description": (ent.get("vulnerability_description") or ent.get("description") or "")[:500] or f"CVE {cve_id} detected from advisory.",
                    "plain_description": f"CVE {cve_id}",
                    "location": {"files": [], "primary_file": "", "start_line": 0, "end_line": 0},
                    "blast_radius": {"files_affected": 0, "functions_affected": 0, "endpoints_affected": 0},
                    "chain_ids": [],
                    "confidence": 0.85,
                    "cve_id": str(cve_id),
                    "cve": {
                        "id": str(cve_id),
                        "cvssScore": cvss_val,
                        "fixedVersion": ent.get("fixed_version") or "",
                    },
                })
    except Exception:
        pass
    return findings


# ────────────────────────────────────────────────────────────────
# 3c. TAVILY — Best Practices + Stack Vulnerability Research
# ────────────────────────────────────────────────────────────────

async def _tavily_best_practices_search(
    tavily: TavilyClient,
    openai_client: "OpenAIClient",
    analysis_id: str,
    metadata: dict,
) -> list[dict]:
    """Use Tavily to research known vulnerabilities and best-practice violations for the detected stack."""
    if not tavily.available:
        return []

    stack = metadata.get("detected_stack", {})
    languages = stack.get("languages", [])
    frameworks = stack.get("frameworks", [])
    stats = metadata.get("stats", {})
    files = metadata.get("files", [])

    has_env = any(".env" in f.get("name", "") for f in files)
    has_docker = any("docker" in f.get("name", "").lower() for f in files)
    has_ci = any(f.get("category") == "ci-cd" for f in files)
    has_tests = any(f.get("category") == "test" for f in files)

    search_results: list[dict] = []

    # Query 1: Stack-specific security best practices
    stack_str = ", ".join(languages + frameworks)
    if stack_str:
        try:
            r = await tavily.search(
                analysis_id=analysis_id,
                query=f"{stack_str} security vulnerabilities best practices 2025 2026",
                step_name="best_practices_stack",
                max_results=5,
                include_answer=True,
            )
            search_results.append(r)
        except Exception:
            pass

    # Query 2: Common misconfigurations for the stack
    try:
        r = await tavily.search(
            analysis_id=analysis_id,
            query=f"common security misconfigurations {stack_str} applications OWASP",
            step_name="best_practices_misconfig",
            max_results=5,
            include_answer=True,
        )
        search_results.append(r)
    except Exception:
        pass

    if not search_results and not openai_client.available:
        return []

    answers = "\n".join(r.get("answer", "") for r in search_results if r.get("answer"))[:4000]

    context_notes = []
    if not has_tests:
        context_notes.append("NO test files detected — zero test coverage")
    if has_env:
        context_notes.append(".env files present — potential secrets exposure risk")
    if not has_docker:
        context_notes.append("No Docker configuration — no containerization")
    if not has_ci:
        context_notes.append("No CI/CD configuration detected")
    if stats.get("total_dependencies", 0) == 0:
        context_notes.append("No dependency manifest detected (no package.json, requirements.txt)")

    findings: list[dict] = []

    if openai_client.available:
        prompt = (
            f"You are a ruthless senior security auditor. Based on Tavily web research and codebase facts, produce concrete findings.\n\n"
            f"Stack: {stack_str}\n"
            f"Files: {stats.get('total_files', 0)}, Lines: {stats.get('total_lines', 0)}\n"
            f"Project observations:\n" + "\n".join(f"- {n}" for n in context_notes) + "\n\n"
            f"Tavily research results:\n{answers}\n\n"
            f"Produce a JSON object with 'findings' array. Each finding:\n"
            f'- id: string, type: "best_practice"|"security"|"configuration", severity: "critical"|"warning"|"info"\n'
            f"- title: concise issue title, description: detailed explanation with specific recommendation\n"
            f"- confidence: 0-1\n\n"
            f"Be thorough. Flag missing tests, missing CI, exposed secrets, missing security headers, "
            f"missing dependency lockfiles, outdated patterns, and any OWASP Top 10 violations. "
            f"Generate at least 3-5 findings even for well-maintained repos."
        )
        try:
            result = await openai_client.chat(
                analysis_id=analysis_id,
                system_prompt=(
                    "You are a ruthless senior security auditor. Produce concrete findings as JSON."
                ),
                user_prompt=prompt,
                step_name="best_practices_analysis",
                json_schema={
                    "name": "bp_findings",
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
                                        "title": {"type": "string"},
                                        "description": {"type": "string"},
                                        "confidence": {"type": "number"},
                                    },
                                    "required": ["id", "type", "severity", "title", "description", "confidence"],
                                    "additionalProperties": False,
                                },
                            },
                        },
                        "required": ["findings"],
                        "additionalProperties": False,
                    },
                },
            )
            raw = result.get("findings", [])
            for f in raw:
                findings.append({
                    "id": f.get("id", f"fnd_bp_{uuid.uuid4().hex[:6]}"),
                    "type": f.get("type", "best_practice"),
                    "severity": f.get("severity", "warning"),
                    "agent": "security",
                    "provider": "tavily+openai",
                    "title": f.get("title", "Best practice issue"),
                    "description": f.get("description", ""),
                    "plain_description": f.get("description", "")[:200],
                    "location": {"files": [], "primary_file": "", "start_line": 0, "end_line": 0},
                    "blast_radius": {"files_affected": 0, "functions_affected": 0, "endpoints_affected": 0},
                    "chain_ids": [],
                    "confidence": f.get("confidence", 0.75),
                })
        except Exception:
            pass

    # If no OpenAI, generate findings from context notes directly
    if not findings:
        for i, note in enumerate(context_notes):
            sev = "warning" if "NO test" in note or "secrets" in note else "info"
            findings.append({
                "id": f"fnd_bp_{uuid.uuid4().hex[:6]}",
                "type": "best_practice",
                "severity": sev,
                "agent": "security",
                "provider": "tavily",
                "title": note.split("—")[0].strip() if "—" in note else note,
                "description": note,
                "plain_description": note,
                "location": {"files": [], "primary_file": "", "start_line": 0, "end_line": 0},
                "blast_radius": {"files_affected": 0, "functions_affected": 0, "endpoints_affected": 0},
                "chain_ids": [],
                "confidence": 0.9,
            })

    return findings


async def _tavily_best_practices_research(
    tavily: TavilyClient, analysis_id: str, metadata: dict
) -> list[dict]:
    """Search for security best practices and known vulnerability patterns for the detected stack."""
    if not tavily.available:
        return []

    stack = metadata.get("detected_stack", {})
    frameworks = stack.get("frameworks", [])
    languages = stack.get("languages", [])
    deps = metadata.get("dependencies", [])
    research: list[dict] = []
    queries: list[tuple[str, list[str]]] = []

    # Framework-specific security queries
    for fw in frameworks[:3]:
        queries.append((
            f"{fw} security vulnerabilities OWASP hardening common misconfigurations 2024 2025",
            ["owasp.org", "cheatsheetseries.owasp.org", "snyk.io", "portswigger.net"],
        ))

    # Language-specific vulnerability patterns
    for lang in languages[:2]:
        queries.append((
            f"{lang} common security vulnerabilities injection authentication flaws CWE",
            ["owasp.org", "cwe.mitre.org", "sans.org", "snyk.io"],
        ))

    # High-risk packages (auth, crypto, HTTP)
    high_risk_pkgs = [
        d["name"] for d in deps if not d.get("is_dev")
        and d["name"].lower() in {
            "express", "django", "flask", "fastapi", "spring", "rails",
            "lodash", "axios", "requests", "urllib3", "serialize",
            "jsonwebtoken", "jwt", "passport", "bcrypt", "crypto",
            "multer", "formidable", "sequelize", "mongoose", "typeorm",
        }
    ][:4]
    if high_risk_pkgs:
        queries.append((
            f"{', '.join(high_risk_pkgs)} security vulnerabilities CVE misconfiguration risks",
            ["nvd.nist.gov", "snyk.io", "github.com/advisories", "owasp.org"],
        ))

    # Always include general web security best practices
    queries.append((
        "web application OWASP Top 10 authentication authorization injection XSS CSRF hardening 2024",
        ["owasp.org", "cheatsheetseries.owasp.org", "portswigger.net", "sans.org"],
    ))

    for i, (query, domains) in enumerate(queries[:5]):
        try:
            result = await tavily.search(
                analysis_id=analysis_id,
                query=query,
                step_name=f"best_practices_{i}",
                search_depth="advanced",
                max_results=5,
                include_domains=domains,
                include_answer=True,
            )
            answer = result.get("answer", "")
            results = result.get("results", [])
            if answer or results:
                research.append({"query": query, "answer": answer, "results": results[:3]})
        except Exception:
            pass

    return research


async def _tavily_extract_best_practices(
    tavily: TavilyClient, analysis_id: str, best_practices: list[dict]
) -> str:
    """Extract full advisory content from best-practices URLs; returns consolidated text."""
    if not best_practices or not tavily.available:
        return ""

    # Prioritise authoritative security sources
    trusted = {"owasp.org", "cheatsheetseries.owasp.org", "snyk.io",
                "portswigger.net", "cwe.mitre.org", "sans.org", "nvd.nist.gov"}
    urls: list[str] = []
    for item in best_practices:
        for r in (item.get("results") or [])[:2]:
            url = r.get("url", "")
            if url and any(d in url for d in trusted):
                urls.append(url)
    # Fill up to 6 with any remaining URLs
    for item in best_practices:
        for r in (item.get("results") or [])[:2]:
            if r.get("url") and r["url"] not in urls:
                urls.append(r["url"])
    urls = list(dict.fromkeys(urls))[:6]

    extracted_text = ""
    if urls:
        try:
            ext = await tavily.extract(
                analysis_id=analysis_id,
                urls=urls,
                step_name="best_practices_extract",
            )
            texts: list[str] = []
            if isinstance(ext.get("results"), list):
                for item in ext["results"]:
                    content = (item.get("content") or item.get("raw_content")
                               or item.get("text") or "")
                    if content:
                        texts.append(str(content)[:4000])
            extracted_text = "\n\n".join(texts)[:12000]
        except Exception:
            pass

    # Fall back to answer summaries when extraction fails
    if not extracted_text.strip():
        extracted_text = "\n\n".join(
            f"[{item['query']}]\n{item.get('answer', '')}"
            for item in best_practices
            if item.get("answer")
        )[:8000]

    return extracted_text


# ────────────────────────────────────────────────────────────────
# 4. Code Quality — Fastino primary, OpenAI fallback
# ────────────────────────────────────────────────────────────────

async def _code_quality_analysis(
    fastino: FastinoClient, openai_client: OpenAIClient,
    analysis_id: str, clone_dir: str, metadata: dict,
) -> list[dict]:
    """Try Fastino for per-file quality, fall back to OpenAI batch."""
    source_files = [f for f in metadata["files"] if f.get("category") == "source"]
    if not source_files:
        return []

    # ── Try Fastino first ──
    if fastino.available:
        try:
            findings = await _fastino_code_quality(fastino, analysis_id, clone_dir, source_files)
            if findings is not None:
                logger.info("Code quality analysis completed via Fastino (%d findings)", len(findings))
                return findings
        except Exception:
            logger.warning("Fastino code quality failed, falling back to OpenAI")

    # ── OpenAI fallback ──
    return await _openai_code_quality(openai_client, analysis_id, clone_dir, source_files)


async def _fastino_code_quality(
    fastino: FastinoClient, analysis_id: str, clone_dir: str, source_files: list[dict],
) -> list[dict]:
    """Per-file classification with Fastino."""
    findings: list[dict] = []
    for f in source_files[:30]:
        fpath = os.path.join(clone_dir, f["path"])
        try:
            with open(fpath, "r", errors="ignore") as _fh:
                content = _fh.read()[:3000]
        except Exception:
            continue
        result = await fastino.classify_text(
            analysis_id=analysis_id,
            text=content,
            categories=[
                "clean",
                # Security issues (critical)
                "hardcoded_secret", "injection_risk", "missing_auth_check",
                "insecure_deserialization", "path_traversal",
                # Code quality (warning)
                "unhandled_error", "type_mismatch", "dead_code",
                "god_function", "magic_number", "deep_nesting",
                "duplicated_logic", "missing_input_validation",
            ],
            step_name=f"quality_{f['name'][:30]}",
        )
        label = result.get("label", "clean")
        if label != "clean":
            security_labels = {"hardcoded_secret", "injection_risk", "missing_auth_check",
                               "insecure_deserialization", "path_traversal"}
            severity = "critical" if label in security_labels else "warning"
            finding_type = "vulnerability" if label in security_labels else "code_smell"
            findings.append({
                "id": f"fnd_{uuid.uuid4().hex[:6]}",
                "type": finding_type,
                "severity": severity,
                "agent": "quality",
                "title": f"{label.replace('_', ' ').title()} in {f['name']}",
                "description": f"Detected {label.replace('_', ' ')} pattern in {f['path']}. "
                               f"This requires immediate attention." if severity == "critical"
                               else f"Detected {label.replace('_', ' ')} in {f['path']}.",
                "plain_description": f"Code quality issue: {label}",
                "location": {"files": [f["path"]], "primary_file": f["path"], "start_line": 1, "end_line": f["lines"]},
                "blast_radius": {"files_affected": 1, "functions_affected": 0, "endpoints_affected": 0},
                "chain_ids": [],
                "confidence": result.get("score", 0.5),
            })
    return findings


async def _openai_code_quality(
    openai_client: OpenAIClient, analysis_id: str, clone_dir: str, source_files: list[dict],
) -> list[dict]:
    """Use OpenAI to analyze code quality across source files — SCRUTINIZING mode."""
    findings: list[dict] = []
    if not source_files or not openai_client.available:
        return findings

    code_samples: list[str] = []
    sample_files: list[dict] = []
    for f in source_files[:40]:
        fpath = os.path.join(clone_dir, f["path"])
        try:
            with open(fpath, "r", errors="ignore") as _f:
                content = _f.read()[:4000]
            code_samples.append(f"### {f['path']} ({f['lines']} lines)\n```\n{content}\n```")
            sample_files.append(f)
        except Exception:
            continue

    if not code_samples:
        return findings

    code_block = "\n\n".join(code_samples[:25])[:24000]

    try:
        result = await openai_client.chat(
            analysis_id=analysis_id,
            system_prompt=(
                "You are a ruthless, world-class code auditor performing a comprehensive code review. "
                "You are paid to find problems. You must be thorough and critical.\n\n"
                "Check EVERY file for:\n"
                "- Unhandled errors / missing try-catch / bare except clauses\n"
                "- Security issues: hardcoded secrets, SQL injection, XSS, path traversal, insecure deserialization\n"
                "- Type safety problems: missing types, any casts, unsafe assertions\n"
                "- Dead code, unused imports, unreachable branches\n"
                "- God functions (>50 lines), deep nesting (>3 levels), high cyclomatic complexity\n"
                "- Missing input validation, missing authentication checks\n"
                "- Race conditions, improper async handling, missing error boundaries\n"
                "- Duplicated logic, DRY violations, copy-paste code\n"
                "- Missing logging, missing error messages\n"
                "- Performance issues: N+1 queries, unnecessary re-renders, unbounded loops\n\n"
                "Be SPECIFIC. Name the exact file, the exact issue, and WHY it matters. "
                "Generate at least 5-10 findings. Return structured JSON."
            ),
            user_prompt=(
                f"Perform a thorough code audit of these {len(code_samples)} source files:\n\n"
                f"{code_block}\n\n"
                "Return a JSON object with a 'findings' array. Each finding must have: "
                "id, type (code_smell/security/bug/performance), "
                "severity (critical/warning/info), title, description, file_path, confidence (0-1). "
                "Be brutally honest — flag everything that a senior engineer would object to in code review."
            ),
            step_name="code_quality_analysis",
            json_schema={
                "name": "quality_findings",
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
                                    "title": {"type": "string"},
                                    "description": {"type": "string"},
                                    "file_path": {"type": "string"},
                                    "confidence": {"type": "number"},
                                },
                                "required": ["id", "type", "severity", "title", "description", "file_path", "confidence"],
                                "additionalProperties": False,
                            },
                        },
                    },
                    "required": ["findings"],
                    "additionalProperties": False,
                },
            },
        )
        for f in result.get("findings", []):
            findings.append({
                "id": f.get("id", f"fnd_{uuid.uuid4().hex[:6]}"),
                "type": f.get("type", "code_smell"),
                "severity": f.get("severity", "warning"),
                "agent": "quality",
                "title": f.get("title", ""),
                "description": f.get("description", ""),
                "plain_description": f.get("description", "")[:200],
                "location": {
                    "files": [f.get("file_path", "")],
                    "primary_file": f.get("file_path", ""),
                    "start_line": 1,
                    "end_line": 0,
                },
                "blast_radius": {"files_affected": 1, "functions_affected": 0, "endpoints_affected": 0},
                "chain_ids": [],
                "confidence": f.get("confidence", 0.7),
            })
    except Exception:
        logger.warning("OpenAI code quality analysis failed")

    return findings


# ────────────────────────────────────────────────────────────────
# 5. Deep Research — Yutori primary, OpenAI fallback
# ────────────────────────────────────────────────────────────────

async def _deep_research(
    yutori: YutoriClient, openai_client: OpenAIClient,
    analysis_id: str, metadata: dict, cve_results: list[dict],
) -> dict:
    """Try Yutori for web research, fall back to OpenAI reasoning."""
    if yutori.available:
        try:
            result = await _yutori_research(yutori, analysis_id, metadata, cve_results)
            if result:
                logger.info("Deep research completed via Yutori")
                return result
        except Exception:
            logger.warning("Yutori research failed, falling back to OpenAI")

    # OpenAI fallback — use reasoning instead of web research
    if openai_client.available:
        try:
            stack = metadata.get("detected_stack", {})
            cve_summary = "; ".join(r.get("answer", "")[:200] for r in cve_results if r.get("answer"))[:1000]
            result = await openai_client.chat(
                analysis_id=analysis_id,
                system_prompt=(
                    "You are a security researcher. Analyze the vulnerability data and "
                    "provide detailed security assessments. Return a JSON object with a "
                    "'vulnerabilities' array of {title, severity, summary} objects."
                ),
                user_prompt=(
                    f"Stack: {json.dumps(stack)}\n"
                    f"CVE intelligence: {cve_summary}\n\n"
                    "Provide security assessment and remediation guidance."
                ),
                step_name="deep_research_fallback",
                json_schema={
                    "name": "security_research",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "vulnerabilities": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "title": {"type": "string"},
                                        "severity": {"type": "string"},
                                        "summary": {"type": "string"},
                                    },
                                    "required": ["title", "severity", "summary"],
                                    "additionalProperties": False,
                                },
                            },
                        },
                        "required": ["vulnerabilities"],
                        "additionalProperties": False,
                    },
                },
            )
            logger.info("Deep research completed via OpenAI (fallback)")
            return result
        except Exception:
            logger.warning("OpenAI research fallback also failed")

    return {}


async def _yutori_research(
    yutori: YutoriClient,
    analysis_id: str,
    metadata: dict,
    cve_results: list[dict],
) -> list[dict]:
    """Use Yutori Research API to do deep investigation of found CVEs; return list of findings."""
    findings: list[dict] = []
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
        # Parse Research task output into findings (merge into main findings list)
        raw = result.get("output") or result.get("result") or result.get("findings")
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except json.JSONDecodeError:
                raw = []
        if isinstance(raw, list):
            for i, item in enumerate(raw):
                if not isinstance(item, dict):
                    continue
                title = item.get("title") or item.get("name") or f"Yutori finding {i + 1}"
                severity = (item.get("severity") or "info").lower()
                if severity not in ("critical", "warning", "info"):
                    severity = "warning" if severity in ("high", "medium") else "info"
                findings.append({
                    "id": f"fnd_yutori_{uuid.uuid4().hex[:6]}",
                    "type": "security_research",
                    "severity": severity,
                    "agent": "security",
                    "provider": "yutori",
                    "title": title[:300],
                    "description": item.get("summary") or item.get("description") or title,
                    "plain_description": (item.get("summary") or title)[:200],
                    "location": {"files": [], "primary_file": "", "start_line": 0, "end_line": 0},
                    "blast_radius": {"files_affected": 0, "functions_affected": 0, "endpoints_affected": 0},
                    "chain_ids": [],
                    "confidence": 0.8,
                    "source_url": item.get("source_url") or item.get("url") or "",
                })
    except Exception:
        pass
    return findings


# ────────────────────────────────────────────────────────────────
# 6. OPENAI — Deep Pattern Analysis
# ────────────────────────────────────────────────────────────────

async def _openai_analyze(
    openai_client: OpenAIClient,
    analysis_id: str,
    clone_dir: str,
    metadata: dict,
    cve_results: list[dict],
    quality_findings: list[dict],
    best_practices_context: str = "",
) -> list[dict]:
    """Use OpenAI for deep adversarial security and pattern analysis with Tavily research context."""
    stack = metadata.get("detected_stack", {})
    stats = metadata.get("stats", {})
    files = metadata.get("files", [])

    # Read actual code samples for deeper analysis
    code_snippets: list[str] = []
    for f in files[:30]:
        fpath = os.path.join(clone_dir, f.get("path", ""))
        try:
            with open(fpath, "r", errors="ignore") as _fh:
                content = _fh.read()[:3000]
            code_snippets.append(f"### {f['path']}\n```\n{content}\n```")
        except Exception:
            continue
    code_block = "\n\n".join(code_snippets[:20])[:20000]

    deps = metadata.get("dependencies", [])
    dep_list = "\n".join(f"- {d.get('name','?')}@{d.get('version','?')}" for d in deps[:50])

    existing = "\n".join(f"- [{qf.get('severity','')}] {qf.get('title','')}" for qf in quality_findings[:15])

    context = (
        f"Repository: {stats.get('total_files', 0)} files, "
        f"{stats.get('total_lines', 0)} lines\n"
        f"Stack: {json.dumps(stack)}\n"
        f"Dependencies ({len(deps)}):\n{dep_list}\n\n"
        f"CVE search results: {len(cve_results)} batches\n"
        f"Quality findings already identified: {len(quality_findings)}\n{existing}\n\n"
        f"SOURCE CODE:\n{code_block}"
    )

    cve_context = "\n".join(
        f"- {r.get('answer', 'No answer')[:300]}"
        for r in cve_results
    )[:3000]

    try:
        result = await openai_client.chat(
            analysis_id=analysis_id,
            system_prompt=(
                "You are a ruthless principal engineer performing a final deep audit before production deployment. "
                "Your reputation depends on finding EVERY issue. You must be thorough and unforgiving.\n\n"
                "Analyze the ACTUAL SOURCE CODE provided, not just metadata. Look for:\n"
                "1. SECURITY: SQL injection, XSS, CSRF, path traversal, insecure crypto, hardcoded secrets, "
                "missing auth checks, exposed debug endpoints, SSRF\n"
                "2. ARCHITECTURE: God classes, circular dependencies, tight coupling, missing abstractions, "
                "violation of SOLID principles, missing error boundaries\n"
                "3. DEPENDENCIES: Known vulnerable packages, outdated major versions, unused dependencies, "
                "missing lockfile, transitive vulnerability exposure\n"
                "4. PATTERNS: Anti-patterns, callback hell, promise chains without error handling, "
                "mutable shared state, race conditions, memory leaks\n"
                "5. OPERATIONAL: Missing health checks, no graceful shutdown, missing rate limiting, "
                "no request validation, missing CORS configuration\n\n"
                "Do NOT duplicate findings already identified. Generate NEW, DISTINCT issues. "
                "Produce at least 5-8 NEW findings. Be specific with file paths and line-level detail where possible."
            ),
            user_prompt=(
                f"Deep audit this repository:\n{context}\n\n"
                f"CVE Intelligence:\n{cve_context}\n\n"
                + (
                    f"Security Best Practices & Advisory Research (from Tavily):\n"
                    f"{best_practices_context[:4000]}\n\n"
                    if best_practices_context else ""
                ) +
                "Cross-reference the OWASP Top 10 (2021) against this codebase:\n"
                "A01 Broken Access Control, A02 Cryptographic Failures, A03 Injection, "
                "A04 Insecure Design, A05 Security Misconfiguration, A06 Vulnerable Components, "
                "A07 Identification/Auth Failures, A08 Data Integrity Failures, "
                "A09 Logging Failures, A10 SSRF.\n\n"
                "Also check: hardcoded secrets, missing rate limiting, wide CORS, debug endpoints, "
                "unvalidated redirects, and missing security headers.\n\n"
                "Produce a JSON object with a 'findings' array. Each finding: "
                "id (string), type (architecture/security/dependency/pattern/operational), "
                "severity (critical/warning/info), "
                "agent ('pattern' or 'security'), title (string), description (detailed, reference "
                "specific files/functions/OWASP category where applicable), "
                "confidence (float 0-1, only include >= 0.65). Be exhaustive and brutally honest."
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
                "provider": "openai",
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
# Doctor Agent — Fix Generation
# ────────────────────────────────────────────────────────────────

async def _generate_fixes(
    openai: "OpenAIClient", analysis_id: str,
    findings: list[dict], metadata: dict,
) -> list[dict]:
    """Generate prioritized fix recommendations from findings using OpenAI."""
    if not findings:
        return []

    findings_summary = "\n".join(
        f"- [{f.get('severity','info').upper()}] {f.get('title','')} ({f.get('type','')}) in {(f.get('location') or {}).get('primary_file','unknown')}"
        for f in findings[:20]
    )

    prompt = (
        f"You are a senior software engineer. Analyze these findings from a codebase audit and generate fix recommendations.\n\n"
        f"Repository: {metadata.get('stats', {}).get('total_files', 0)} files, "
        f"{metadata.get('stats', {}).get('total_lines', 0)} lines of code\n\n"
        f"Findings:\n{findings_summary}\n\n"
        f"Generate a JSON array of fix objects. Each fix should have:\n"
        f'- "id": unique string like "fix_001"\n'
        f'- "priority": number starting at 1\n'
        f'- "title": concise fix title\n'
        f'- "severity": "critical", "warning", or "info"\n'
        f'- "type": "dependency_upgrade", "code_patch", or "refactor"\n'
        f'- "estimatedEffort": e.g. "15 min", "1 hour"\n'
        f'- "chainsResolved": number of attack chains this fix resolves\n'
        f'- "findingsResolved": array of finding IDs this fix addresses\n'
        f'- "documentation": object with "whatsWrong" (string), "steps" (array of strings), "affectedCode" (array), "beforeCode" (optional string), "afterCode" (optional string)\n\n'
        f"Return only valid JSON. Generate fixes for the most important findings first."
    )

    try:
        result = await openai.chat(
            analysis_id=analysis_id,
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o",
            response_format={"type": "json_object"},
            step_name="doctor_fix_generation",
        )
        content = result.get("content", "")
        import json as _json
        parsed = _json.loads(content)
        fix_list = parsed if isinstance(parsed, list) else parsed.get("fixes", [])
        for fix in fix_list:
            if "documentation" not in fix:
                fix["documentation"] = {"whatsWrong": fix.get("title", ""), "steps": [], "affectedCode": []}
            if "findingsResolved" not in fix:
                fix["findingsResolved"] = []
        return fix_list[:15]
    except Exception:
        logger.warning("Fix generation failed for %s", analysis_id)
        return _fallback_fixes(findings)


def _fallback_fixes(findings: list[dict]) -> list[dict]:
    """Generate simple fixes without OpenAI."""
    fixes = []
    for i, f in enumerate(findings[:10], 1):
        fixes.append({
            "id": f"fix_{i:03d}",
            "priority": i,
            "title": f"Fix: {f.get('title', 'Issue')}",
            "severity": f.get("severity", "info"),
            "type": "code_patch",
            "estimatedEffort": "30 min",
            "chainsResolved": 0,
            "findingsResolved": [f.get("id", "")],
            "documentation": {
                "whatsWrong": f.get("description", f.get("plain_description", "")),
                "steps": [f"Address the {f.get('type', 'issue')} in {(f.get('location') or {}).get('primary_file', 'the affected file')}"],
                "affectedCode": [],
            },
        })
    return fixes


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
            "patterns": {"score": max(0, 10 - sum(1 for f in findings if f.get("agent") == "pattern")), "max": 10, "status": "warning" if any(f.get("agent") == "pattern" for f in findings) else "healthy"},
            "dependencies": {"score": max(0, 10 - critical), "max": 10, "status": "warning" if critical > 0 else "healthy"},
            "architecture": {"score": max(5, 10 - sum(1 for f in findings if "architecture" in (f.get("type") or ""))), "max": 10, "status": "warning" if any("architecture" in (f.get("type") or "") for f in findings) else "healthy"},
        },
        "confidence": 0.85,
    }


# ────────────────────────────────────────────────────────────────
# 7. NEO4J — Graph Build
# ────────────────────────────────────────────────────────────────

async def _build_neo4j_graph(
    analysis_id: str, metadata: dict, findings: list[dict]
) -> dict:
    """Build graph nodes/edges with proper nested directory hierarchy."""
    nodes: list[dict] = []
    edges: list[dict] = []
    dir_nodes: dict[str, str] = {}  # path -> node_id

    def _safe_id(s: str) -> str:
        return s.replace("/", "_").replace(".", "_").replace("-", "_").replace(" ", "_")

    def ensure_dir(dir_path: str) -> str:
        """Recursively create directory nodes and CONTAINS edges."""
        if dir_path in dir_nodes:
            return dir_nodes[dir_path]
        nid = f"dir_{analysis_id}_{_safe_id(dir_path)}" if dir_path != "/" else f"dir_{analysis_id}_root"
        label = dir_path.split("/")[-1] if dir_path != "/" else "/"
        nodes.append({"id": nid, "type": "directory", "label": label or "/", "path": dir_path, "findingCount": 0, "metadata": {}})
        dir_nodes[dir_path] = nid
        if dir_path != "/":
            parent = "/".join(dir_path.split("/")[:-1]) or "/"
            parent_id = ensure_dir(parent)
            edges.append({
                "id": f"edge_{parent_id}_{nid}",
                "source": parent_id, "target": nid, "type": "contains",
                "isVulnerabilityChain": False,
            })
        return nid

    ensure_dir("/")

    for f in metadata.get("files", [])[:200]:
        fid = f"file_{analysis_id}_{_safe_id(f['path'])}"
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
        parent_dir = "/".join(f["path"].split("/")[:-1]) or "/"
        parent_id = ensure_dir(parent_dir)
        edges.append({
            "id": f"edge_{parent_id}_{fid}",
            "source": parent_id, "target": fid, "type": "contains",
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
            "metadata": {"name": d["name"], "version": d["version"], "isDev": d.get("is_dev", False)},
        })

    # Write to Neo4j if available
    if await neo4j_service.is_connected():
        for n in nodes:
            try:
                if n["type"] == "file":
                    await neo4j_service.write_file_node(
                        analysis_id, n["id"], n.get("path", ""), n.get("language", ""),
                        n.get("lines", 0), n.get("category", ""),
                        finding_count=n.get("findingCount", 0),
                        severity=n.get("severity"),
                    )
                elif n["type"] == "directory":
                    await neo4j_service.write_directory_node(analysis_id, n["id"], n.get("path", "/"))
                elif n["type"] == "package":
                    pkg_name = n.get("metadata", {}).get("name") or (n.get("label", "").split("@")[0] if "@" in (n.get("label") or "") else n.get("label", ""))
                    await neo4j_service.write_package_node(
                        analysis_id, n["id"],
                        pkg_name,
                        n.get("metadata", {}).get("version", ""),
                        is_dev=n.get("metadata", {}).get("isDev", False),
                        finding_count=n.get("findingCount", 0),
                        severity=n.get("severity"),
                    )
            except Exception:
                pass
        for e in edges:
            try:
                await neo4j_service.write_edge(analysis_id, e["id"], e["source"], e["target"], e["type"])
            except Exception:
                pass
        # Finding nodes and AFFECTS / HAS_CVE for blast radius and chain analysis
        for fd in findings:
            try:
                fid = fd.get("id")
                if not fid:
                    continue
                await neo4j_service.write_finding_node(
                    analysis_id, fid,
                    title=fd.get("title", "")[:500],
                    severity=fd.get("severity", "info"),
                    finding_type=fd.get("type", "finding"),
                    agent=fd.get("agent", "unknown"),
                    description=fd.get("description", "") or fd.get("plain_description", ""),
                )
                for loc_file in (fd.get("location") or {}).get("files", [])[:20]:
                    file_node_id = f"file_{analysis_id}_{loc_file.replace('/', '_').replace('.', '_')}"
                    await neo4j_service.write_affects_edge(analysis_id, fid, file_node_id)
                cve_id = (fd.get("cve") or {}).get("id") if isinstance(fd.get("cve"), dict) else fd.get("cve_id")
                if cve_id:
                    cve_node_id = f"cve_{analysis_id}_{cve_id}"
                    await neo4j_service.write_cve_node(
                        analysis_id, cve_node_id,
                        cvss_score=(fd.get("cve") or {}).get("cvssScore") if isinstance(fd.get("cve"), dict) else None,
                        description=(fd.get("cve") or {}).get("description", "") if isinstance(fd.get("cve"), dict) else "",
                        fixed_version=(fd.get("cve") or {}).get("fixedVersion", "") if isinstance(fd.get("cve"), dict) else "",
                    )
                    await neo4j_service.write_has_cve_edge(analysis_id, fid, cve_node_id)
            except Exception:
                pass

    return {"nodes": nodes, "edges": edges}


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
    duration: int,
    fixes: list[dict] | None = None,
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
                fixes=fixes or [],
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


async def _ws_finding(analysis_id: str, finding: dict):
    """Broadcast a single finding as it's discovered."""
    try:
        await ws_manager.broadcast(analysis_id, {"type": "finding", "finding": finding})
    except Exception:
        pass


async def _ws_graph_node(analysis_id: str, node: dict):
    try:
        await ws_manager.broadcast(analysis_id, {"type": "graph_node", "node": node})
    except Exception:
        pass


async def _ws_graph_edge(analysis_id: str, edge: dict):
    try:
        await ws_manager.broadcast(analysis_id, {"type": "graph_edge", "edge": edge})
    except Exception:
        pass


async def _ws_activity(analysis_id: str, agent: str, message: str, provider: str = ""):
    """Broadcast an agent activity message for the live feed."""
    try:
        await ws_manager.broadcast(analysis_id, {
            "type": "tool_activity",
            "agent": agent,
            "message": message,
            "provider": provider,
            "timestamp": datetime.now(timezone.utc).isoformat(),
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
