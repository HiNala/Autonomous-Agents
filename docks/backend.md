# VIBE CHECK — BACKEND PRD v4.0
## Python + FastAPI — Agent System, Sponsor Integrations & Infrastructure

*Digital Studio Labs — February 27, 2026*

---

## TABLE OF CONTENTS

1. Vision & Architecture Overview
2. Infrastructure (Local-First, AWS Optional)
3. LLM Strategy: Fastino Primary Demo, OpenAI Backup
4. Agent Specifications (7 Agents)
5. Sponsor Tool Reference — Complete Endpoint Mapping
   - 5.1 Fastino Labs (PRIMARY DEMO — TLMs + GLiNER-2)
   - 5.2 OpenAI (BACKUP — General Reasoning)
   - 5.3 Tavily (CVE Search & Extraction)
   - 5.4 Neo4j (Knowledge Graph)
   - 5.5 Yutori (STRETCH — Deep Web Intelligence)
   - 5.7 AWS (OPTIONAL — Production Infra)
6. Neo4j Graph Schema
7. Database & State Schemas
8. Processing Pipeline & Data Flow
9. Build Plan (Backend Focus)
10. Python Project Structure

---

## 1. VISION & ARCHITECTURE OVERVIEW

VIBE CHECK is an autonomous multi-agent GitHub repository analyzer. The backend is the engine: it clones repos, builds knowledge graphs, runs 6 specialist analysis agents, searches the web for CVEs, and generates fix documentation.

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER: GitHub URL                                 │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 NEXT.JS FRONTEND (localhost:3000)                        │
│          Dashboard · Graph · Findings · WebSocket Client                 │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ REST + WebSocket
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              FASTAPI BACKEND (localhost:8000)                            │
│                     ORCHESTRATOR AGENT                                   │
│  Clone → Detect Stack → Dispatch Agents → Aggregate → Score             │
└──┬──────────┬──────────┬──────────┬──────────┬──────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐
│ MAPPER ││QUALITY ││PATTERN ││SECURITY││ DOCTOR │
│ AGENT  ││ AGENT  ││ AGENT  ││ AGENT  ││ AGENT  │
│        ││        ││        ││        ││        │
│ Graph  ││ Bugs & ││ Best   ││ CVEs & ││ Fix    │
│ Build  ││ Smells ││ Prctce ││ Vulns  ││ Docs   │
└────────┘└────────┘└────────┘└────────┘└────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
┌──────────────────┐ ┌───────────────────┐
│    NEO4J         │ │ FASTINO (PRIMARY) │
│  Knowledge Graph │ │ + OPENAI (BACKUP)  │
│  (Structure +    │ │  (TLMs + LLM       │
│   Relationships) │ │   Reasoning)        │
└──────────────────┘ └───────────────────┘
```

### Split Architecture: Why Python Backend + Next.js Frontend

| Concern | Decision | Rationale |
|---------|----------|-----------|
| **Backend** | **Python 3.12 + FastAPI** | Native async, best-in-class AI/ML SDKs (openai, tavily-python, gliner2), Pydantic for validation, asyncio for parallel agents |
| **Frontend** | Next.js 15 (App Router) | React ecosystem, Cytoscape.js for graph viz, Framer Motion animations, Tailwind CSS |
| **Communication** | REST + WebSocket | FastAPI serves both; frontend calls `:8000/api/v1/*` |

**Why Python over Node.js for the backend:**
- Fastino's primary SDK is Python (`pip install gliner2`)
- OpenAI's Python SDK is more mature with better async support
- Tavily's Python SDK (`tavily-python`) is first-class
- Neo4j's async Python driver (`neo4j[async]`) is excellent
- `asyncio.gather()` gives clean parallel agent execution
- Tree-sitter Python bindings are more robust
- Pydantic models eliminate runtime type bugs

### Backend Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Runtime | Python 3.12 + FastAPI | Async-first, uvicorn server |
| Validation | Pydantic v2 | Request/response models, settings |
| Graph DB | Neo4j (AuraDB Free or Desktop) | `neo4j[async]` async driver |
| LLM (Demo) | Fastino TLMs + GLiNER-2 | `pip install gliner2` + REST API |
| LLM (Backup) | OpenAI GPT-4o | `pip install openai` async client |
| Web Search | Tavily API | `pip install tavily-python` |
| State | PostgreSQL via SQLAlchemy (async) | Central analysis store managed via Alembic migrations |
| Repo Storage | Local `/tmp` directory | Cloned repos via `asyncio.create_subprocess_exec` |
| Real-time | FastAPI WebSockets | Built-in via Starlette, no extra deps |
| Parsing | Tree-sitter + `ast` module | Code structure extraction |
| HTTP Client | `httpx` (async) | All external API calls |
| Task Runner | `asyncio.gather` + `asyncio.TaskGroup` | Parallel agent execution |

---

## 2. INFRASTRUCTURE (LOCAL-FIRST, AWS OPTIONAL)

**Default: Everything runs locally. All sponsor APIs are cloud-hosted.**

| Component | Local Setup (DEFAULT) | AWS Optional (Stretch) |
|-----------|----------------------|----------------------|
| Backend API | FastAPI, uvicorn, localhost:8000 | Lambda + API Gateway (Mangum adapter) |
| Frontend | Next.js, localhost:3000 | Vercel |
| Graph DB | Neo4j AuraDB Free (cloud) or Desktop | Same |
| Repo Storage | Local `/tmp/vibe-check/repos/` | S3 bucket |
| State/DB | PostgreSQL via SQLAlchemy (async) | DynamoDB via aioboto3 |
| Agent Execution | asyncio.gather in-process | Lambda per agent |

### Environment Variables

```bash
# .env — loaded via pydantic-settings
# Required — Sponsor APIs
FASTINO_API_KEY=your_fastino_key          # Primary demo inferencing
OPENAI_API_KEY=sk-...                      # Backup reasoning
TAVILY_API_KEY=tvly-...                    # CVE search
NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
GITHUB_TOKEN=ghp_...                       # GitHub API (optional, for rate limits)

# Server
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=["http://localhost:3000"]     # Next.js frontend

# Optional — Stretch
YUTORI_API_KEY=your_yutori_key
AWS_REGION=us-east-1
```

### Settings Model (Pydantic)

```python
# app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Sponsor APIs
    fastino_api_key: str
    openai_api_key: str
    tavily_api_key: str
    neo4j_uri: str
    neo4j_username: str = "neo4j"
    neo4j_password: str
    github_token: str | None = None

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000"]

    # Limits
    max_files: int = 500
    agent_timeout_seconds: int = 60
    clone_dir: str = "/tmp/vibe-check/repos"

    # Optional
    yutori_api_key: str | None = None

    model_config = {"env_file": ".env"}

settings = Settings()
```

---

## 3. LLM STRATEGY: FASTINO PRIMARY DEMO, OPENAI BACKUP

### Why Fastino First

Fastino's Task-Specific Language Models (TLMs) are purpose-built for the exact tasks our agents perform: entity extraction, text classification, structured data parsing, and function calling. They run 99x faster than general-purpose LLMs with <150ms CPU latency. For a hackathon demo, this speed difference is dramatic and visible.

### The Dual-Provider Architecture

```python
# app/llm/provider.py — Unified LLM abstraction
from abc import ABC, abstractmethod
from typing import Any

class LLMProvider(ABC):
    @abstractmethod
    async def extract_entities(self, text: str, labels: list[str]) -> dict: ...

    @abstractmethod
    async def classify_text(self, text: str, categories: list[str]) -> dict: ...

    @abstractmethod
    async def extract_json(self, text: str, schema: dict) -> Any: ...

    @abstractmethod
    async def reason(self, system_prompt: str, user_prompt: str) -> str: ...

    @abstractmethod
    async def reason_structured(self, system_prompt: str, user_prompt: str, json_schema: dict) -> Any: ...


class FastinoProvider(LLMProvider):
    """Primary — fast extraction, classification, structured parsing."""
    BASE_URL = "https://api.fastino.ai"

    async def extract_entities(self, text: str, labels: list[str]) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.BASE_URL}/gliner-2", json={
                "task": "extract_entities",
                "text": text,
                "schema": labels,
            }, headers=self._headers(), timeout=10.0)
            return resp.json()["result"]

    async def classify_text(self, text: str, categories: list[str]) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.BASE_URL}/gliner-2", json={
                "task": "classify_text",
                "text": text,
                "schema": {"categories": categories},
            }, headers=self._headers(), timeout=10.0)
            return resp.json()["result"]

    async def extract_json(self, text: str, schema: dict) -> Any:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.BASE_URL}/gliner-2", json={
                "task": "extract_json",
                "text": text,
                "schema": schema,
            }, headers=self._headers(), timeout=10.0)
            return resp.json()["result"]

    # Fastino doesn't do open-ended reasoning — falls through to OpenAI
    async def reason(self, system_prompt: str, user_prompt: str) -> str:
        raise NotImplementedError("Use OpenAI for reasoning tasks")

    async def reason_structured(self, system_prompt: str, user_prompt: str, json_schema: dict) -> Any:
        raise NotImplementedError("Use OpenAI for structured reasoning")


class OpenAIProvider(LLMProvider):
    """Backup — deep reasoning, code analysis, doc generation."""

    async def reason_structured(self, system_prompt: str, user_prompt: str, json_schema: dict) -> Any:
        from openai import AsyncOpenAI
        client = AsyncOpenAI()
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_schema", "json_schema": json_schema},
        )
        return json.loads(response.choices[0].message.content)
```

### Agent → Provider Mapping

| Agent | Task | Primary (Fastino) | Backup (OpenAI) |
|-------|------|-------------------|-----------------|
| **Mapper** | File categorization | ✅ `classify_text` → source/test/config/docs | `gpt-4o-mini` classification |
| **Mapper** | Import/dependency extraction | ✅ `extract_entities` → package names, versions | regex fallback |
| **Mapper** | Function extraction | ✅ `extract_json` → name, params, line numbers | `gpt-4o-mini` structured |
| **Quality** | Bug classification | ✅ `classify_text` → bug/smell/dead_code/complexity | `gpt-4o` reasoning |
| **Quality** | Code analysis reasoning | Stretch: TLM function calling | ✅ `gpt-4o` structured outputs |
| **Pattern** | Anti-pattern detection | ✅ `classify_text` → anti-pattern categories | `gpt-4o` reasoning |
| **Pattern** | Best practice scoring | Stretch: TLM structured output | ✅ `gpt-4o` structured outputs |
| **Security** | CVE entity extraction | ✅ `extract_entities` → CVE IDs, versions, scores | regex fallback |
| **Security** | Vulnerability reasoning | Stretch: TLM function calling | ✅ `gpt-4o` tool calling |
| **Doctor** | Fix doc generation | — | ✅ `gpt-4o` generation |
| **Orchestrator** | Stack detection | ✅ `classify_text` → language/framework/build | `gpt-4o-mini` |
| **Orchestrator** | Health score computation | Local algorithm (no LLM needed) | — |

### Demo Flow — Fastino Prominently Featured

During the demo, the terminal/dashboard will show:
```
🔍 Mapper Agent: Classifying 47 files...
   ⚡ Fastino TLM: 47 classifications in 142ms (avg 3ms/file)
   → 32 source, 8 test, 4 config, 2 docs, 1 asset

🔍 Mapper Agent: Extracting dependencies...
   ⚡ Fastino GLiNER-2: 12 packages extracted in 89ms
   → express@4.17.1, react@18.2.0, next@14.0.0...

🔍 Security Agent: Parsing CVE advisories...
   ⚡ Fastino GLiNER-2: Entity extraction from 5 advisory pages in 234ms
   → CVE-2024-XXXX (CVSS 9.1), CVE-2024-YYYY (CVSS 7.8)

🔍 Quality Agent: Analyzing code patterns...
   🧠 OpenAI gpt-4o: Deep code reasoning (structured output)
   → 12 findings generated in 3.2s
```

---

## 4. AGENT SPECIFICATIONS

> **Implementation note (current state):**  
> The production backend currently implements a **minimal `OrchestratorAgent`** that clones the repository, computes basic repository statistics, and streams status updates over WebSocket.  
> The additional agents described below (Mapper, Quality, Pattern, Security, Doctor) are **planned/roadmap** components and not yet wired into the running service.

### Base Agent Pattern

```python
# app/agents/base.py
from abc import ABC, abstractmethod
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Analysis


class BaseAgent(ABC):
    """Minimal base class for async analysis agents."""

    name: str = "agent"
    provider: str | None = None

    def __init__(self, db: AsyncSession, analysis: Analysis) -> None:
        self.db = db
        self.analysis = analysis

    async def run(self) -> None:
        await self.on_start()
        try:
            await self.execute()
            await self.on_complete()
        except Exception as exc:
            await self.on_error(exc)
            raise

    async def on_start(self) -> None:
        """Optional hook for startup logic (e.g. websocket notifications)."""

    async def on_complete(self) -> None:
        """Optional hook for successful completion logic."""

    async def on_error(self, error: Exception) -> None:
        """Optional hook for error handling."""

    @abstractmethod
    async def execute(self) -> None:
        """Agent-specific implementation."""
        raise NotImplementedError

### Agent 1: ORCHESTRATOR

**Input:** GitHub URL  
**Output (current implementation):** Clone repo, compute basic repository stats, update `Analysis` row, stream status updates over WebSocket.  
**Output (planned):** Dispatch all agents, aggregate results, compute Health Score.

```python
# app/agents/orchestrator.py
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import asyncio
import logging
import tempfile
from sqlalchemy import select

from app.database import async_session
from app.models import Analysis, AnalysisStatus
from app.routers.ws import manager
from app.agents.base import BaseAgent


class OrchestratorAgent(BaseAgent):
    name = "orchestrator"
    provider = "local"

    async def on_start(self) -> None:
        await self._broadcast_status("starting", 0.0, "Orchestrator starting...")

    async def on_complete(self) -> None:
        await self._broadcast_status("completed", 1.0, "Analysis completed.")

    async def on_error(self, error: Exception) -> None:
        self.analysis.status = AnalysisStatus.FAILED
        await self.db.commit()
        await self._broadcast_status("failed", 1.0, f"Analysis failed: {error}")

    async def execute(self) -> None:
        start_time = datetime.now(timezone.utc)

        # 1. Clone repo
        self.analysis.status = AnalysisStatus.CLONING
        await self.db.commit()
        await self._broadcast_status("cloning", 0.1, "Cloning repository...")
        clone_dir = await self._clone_repo(
            repo_url=self.analysis.repo_url,
            branch=self.analysis.branch,
            analysis_id=self.analysis.analysis_id,
        )
        self.analysis.clone_dir = str(clone_dir)

        # 2. Compute basic repo stats
        self.analysis.status = AnalysisStatus.MAPPING
        await self._broadcast_status("mapping", 0.4, "Computing basic repository statistics...")
        stats = await self._compute_basic_stats(clone_dir)
        self.analysis.stats = stats
        self.analysis.detected_stack = {
            "languages": stats.get("languages", []),
            "frameworks": [],
            "packageManager": "",
            "buildSystem": "",
        }

        # 3. Mark completed
        self.analysis.status = AnalysisStatus.COMPLETED
        completed_at = datetime.now(timezone.utc)
        self.analysis.completed_at = completed_at
        self.analysis.duration_seconds = int((completed_at - start_time).total_seconds())
        await self.db.commit()
        await self._broadcast_status("completed", 1.0, "Analysis completed.", extra={"stats": stats})

    async def _clone_repo(self, repo_url: str, branch: str | None, analysis_id: str) -> Path:
        base_dir = Path(tempfile.gettempdir()) / "vibe-check" / "repos"
        base_dir.mkdir(parents=True, exist_ok=True)
        clone_dir = base_dir / analysis_id
        # Reuse existing clone directory if present
        if clone_dir.exists():
            return clone_dir

        cmd = ["git", "clone", "--depth", "1"]
        if branch:
            cmd += ["--branch", branch]
        cmd += [repo_url, str(clone_dir)]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"Clone failed: {stderr.decode(errors='ignore')}")
        return clone_dir

    async def _compute_basic_stats(self, clone_dir: Path) -> dict[str, Any]:
        return await asyncio.to_thread(self._compute_basic_stats_sync, clone_dir)

    def _compute_basic_stats_sync(self, clone_dir: Path) -> dict[str, Any]:
        total_files = 0
        total_lines = 0
        languages: set[str] = set()

        for path in clone_dir.rglob("*"):
            if not path.is_file():
                continue
            total_files += 1
            try:
                with path.open("r", encoding="utf-8", errors="ignore") as f:
                    lines = sum(1 for _ in f)
                total_lines += lines
            except OSError:
                continue

            suffix = path.suffix.lower()
            if suffix == ".py":
                languages.add("python")
            elif suffix in {".ts", ".tsx"}:
                languages.add("typescript")
            elif suffix in {".js", ".jsx"}:
                languages.add("javascript")

        return {
            "total_files": total_files,
            "total_lines": total_lines,
            "total_dependencies": 0,
            "total_dev_dependencies": 0,
            "total_functions": 0,
            "total_endpoints": 0,
            "languages": sorted(languages),
        }

    async def _broadcast_status(
        self,
        stage: str,
        progress: float,
        message: str,
        extra: dict[str, Any] | None = None,
    ) -> None:
        payload: dict[str, Any] = {
            "type": "status",
            "agent": self.name,
            "stage": stage,
            "progress": progress,
            "message": message,
            "analysisId": self.analysis.analysis_id,
        }
        if extra:
            payload.update(extra)
        await manager.broadcast(self.analysis.analysis_id, payload)


async def run_orchestrator(analysis_id: str) -> None:
    """Entry point used by the HTTP layer to kick off background analysis."""
    async with async_session() as db:
        result = await db.execute(select(Analysis).where(Analysis.analysis_id == analysis_id))
        analysis = result.scalar_one_or_none()
        if not analysis:
            return
        agent = OrchestratorAgent(db=db, analysis=analysis)
        await agent.run()
```

**Health Score Algorithm (local, no LLM):**

```python
# app/scoring/health.py
from app.models.shared import HealthScore, CategoryScore

def compute_health_score(findings: list, stats: dict) -> HealthScore:
    weights = {
        "codeQuality": 0.20,
        "patterns": 0.15,
        "security": 0.30,   # highest weight
        "dependencies": 0.20,
        "architecture": 0.15,
    }

    def category_score(agent_findings: list) -> int:
        penalty = sum(
            3 if f.severity == "critical" else 1 if f.severity == "warning" else 0.2
            for f in agent_findings
        )
        return max(0, min(10, round(10 - penalty)))

    breakdown = {}
    for cat, weight in weights.items():
        agent_map = {"codeQuality": "quality", "patterns": "pattern",
                     "security": "security", "dependencies": "security",
                     "architecture": "pattern"}
        cat_findings = [f for f in findings if f.agent == agent_map.get(cat, cat)]
        score = category_score(cat_findings)
        status = "healthy" if score >= 7 else "warning" if score >= 4 else "critical"
        breakdown[cat] = CategoryScore(score=score, max=10, status=status)

    overall = round(sum(
        breakdown[cat].score * weights[cat] for cat in weights
    ) * 10)
    letter_grade = score_to_grade(overall)

    return HealthScore(
        overall=overall,
        letterGrade=letter_grade,
        breakdown=breakdown,
        confidence=0.91,
    )

def score_to_grade(score: int) -> str:
    if score >= 97: return "A+"
    if score >= 93: return "A"
    if score >= 90: return "A-"
    if score >= 87: return "B+"
    if score >= 83: return "B"
    if score >= 80: return "B-"
    if score >= 77: return "C+"
    if score >= 73: return "C"
    if score >= 70: return "C-"
    if score >= 67: return "D+"
    if score >= 63: return "D"
    if score >= 60: return "D-"
    return "F"
```

### Agent 2: MAPPER (Foundation)

**Primary LLM:** Fastino (classification + extraction)

```python
# app/agents/mapper.py
import os
from pathlib import Path

class MapperAgent(BaseAgent):
    name = "mapper"
    provider = "fastino"

    async def execute(self):
        clone_dir = Path(self.ctx.clone_dir)

        # 1. Walk filesystem → File/Directory nodes
        files = await self._walk_files(clone_dir)
        await self.ws.send_status("mapper", "running", 0.2, f"Found {len(files)} files...")

        # 2. Fastino batch classify all files
        import time
        t0 = time.perf_counter()
        classifications = await self._classify_files(files)
        elapsed_ms = round((time.perf_counter() - t0) * 1000)
        await self.ws.send_fastino_speed(f"{len(files)} files classified in {elapsed_ms}ms")

        # 3. Create graph nodes + stream to frontend
        for file_info, category in zip(files, classifications):
            node = await self._create_file_node(file_info, category)
            await self.ctx.neo4j.merge_file(node)
            await self.ws.send_graph_node(node)

        # 4. Parse dependencies
        await self.ws.send_status("mapper", "running", 0.5, "Extracting dependencies...")
        deps = await self._extract_dependencies(clone_dir)
        for dep in deps:
            await self.ctx.neo4j.merge_package(dep)
            await self.ws.send_graph_node(dep.to_graph_node())

        # 5. Parse imports → edges
        await self.ws.send_status("mapper", "running", 0.7, "Mapping imports...")
        edges = await self._extract_imports(files, clone_dir)
        for edge in edges:
            await self.ctx.neo4j.merge_edge(edge)
            await self.ws.send_graph_edge(edge)

        # 6. Extract functions via Fastino extract_json
        await self.ws.send_status("mapper", "running", 0.9, "Extracting functions...")
        functions = await self._extract_functions(files, clone_dir)
        for func in functions:
            await self.ctx.neo4j.merge_function(func)

    async def _classify_files(self, files: list) -> list[str]:
        """Batch classify using Fastino — this is the speed showpiece."""
        results = []
        for file_info in files:
            result = await self.ctx.fastino.classify_text(
                f"{file_info['path']} - {file_info.get('first_lines', '')}",
                ["source", "test", "config", "docs", "assets", "build", "ci-cd"]
            )
            results.append(result["label"])
        return results

    async def _extract_dependencies(self, clone_dir: Path) -> list:
        """Parse package.json/requirements.txt → Fastino extract_entities."""
        pkg_json = clone_dir / "package.json"
        if pkg_json.exists():
            content = pkg_json.read_text()
            result = await self.ctx.fastino.extract_entities(
                content,
                ["package_name", "version", "dev_dependency"]
            )
            return self._parse_package_entities(result)
        return []

    async def _extract_functions(self, files: list, clone_dir: Path) -> list:
        """Fastino extract_json for function signatures."""
        functions = []
        source_files = [f for f in files if f.get("category") == "source"]
        for file_info in source_files[:50]:  # cap for performance
            content = (clone_dir / file_info["path"]).read_text(errors="ignore")[:2000]
            result = await self.ctx.fastino.extract_json(content, {
                "functions": [
                    "name::str::Function name",
                    "params::str::Parameter list",
                    "exported::str::Is exported (yes/no)",
                    "async::str::Is async (yes/no)",
                    "start_line::str::Start line number",
                ]
            })
            functions.extend(self._parse_function_entities(result, file_info["path"]))
        return functions
```

### Agent 3: QUALITY

**Two-pass: Fastino fast scan → OpenAI deep analysis**

```python
# app/agents/quality.py
class QualityAgent(BaseAgent):
    name = "quality"
    provider = "fastino"  # primary, switches to openai for deep pass

    async def execute(self):
        source_files = await self.ctx.neo4j.get_source_files()

        # Pass 1: Fastino fast scan — classify code blocks
        flagged_blocks = []
        for i, file in enumerate(source_files):
            progress = i / len(source_files)
            await self.ws.send_status("quality", "running", progress * 0.5,
                                      f"Fast scan: {file['name']}...")
            content = self._read_file(file["path"])
            result = await self.ctx.fastino.classify_text(content[:2000], [
                "clean", "unhandled_error", "type_mismatch", "dead_code",
                "god_function", "magic_number", "deep_nesting", "duplicated_logic"
            ])
            if result["label"] != "clean":
                flagged_blocks.append({"file": file, "content": content, "smell": result})

        # Pass 2: OpenAI deep analysis on flagged blocks only
        await self.ws.send_status("quality", "running", 0.6,
                                  f"Deep analysis on {len(flagged_blocks)} flagged files...")
        from openai import AsyncOpenAI
        client = AsyncOpenAI()
        for block in flagged_blocks:
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": QUALITY_SYSTEM_PROMPT},
                    {"role": "user", "content": self._build_analysis_prompt(block)},
                ],
                response_format={"type": "json_schema", "json_schema": FINDING_SCHEMA},
            )
            findings = json.loads(response.choices[0].message.content)
            for finding_data in findings.get("findings", []):
                finding = self._create_finding(finding_data, block["file"])
                await self.ctx.neo4j.merge_finding(finding)
                await self.ws.send_finding(finding)
                self.ctx.findings.append(finding)
```

### Agent 4: PATTERN

**Fastino classification → OpenAI scoring**

```python
# app/agents/pattern.py
class PatternAgent(BaseAgent):
    name = "pattern"
    provider = "fastino"

    async def execute(self):
        # Get project structure from Neo4j
        structure = await self.ctx.neo4j.get_project_structure()
        framework = self.ctx.detected_stack["frameworks"][0]

        # Fastino: classify structural patterns
        result = await self.ctx.fastino.classify_text(
            f"Project structure:\n{structure}\nFramework: {framework}",
            ["well_structured", "missing_separation", "mixed_concerns",
             "non_standard_layout", "missing_tests", "missing_types"]
        )

        # OpenAI: detailed pattern scoring
        from openai import AsyncOpenAI
        client = AsyncOpenAI()
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": PATTERN_SYSTEM_PROMPT},
                {"role": "user", "content": f"Framework: {framework}\nStructure:\n{structure}\n"
                                             f"Initial classification: {result['label']}"},
            ],
            response_format={"type": "json_schema", "json_schema": PATTERN_FINDING_SCHEMA},
        )
        findings = json.loads(response.choices[0].message.content)
        for finding_data in findings.get("findings", []):
            finding = self._create_finding(finding_data)
            await self.ctx.neo4j.merge_finding(finding)
            await self.ws.send_finding(finding)
            self.ctx.findings.append(finding)
```

### Agent 5: SECURITY

**Tavily search → Fastino CVE extraction → OpenAI chain reasoning**

```python
# app/agents/security.py
from tavily import AsyncTavilyClient

class SecurityAgent(BaseAgent):
    name = "security"
    provider = "tavily"

    async def execute(self):
        packages = await self.ctx.neo4j.get_packages()
        tavily = AsyncTavilyClient(api_key=settings.tavily_api_key)

        # Step 1: Tavily search for CVEs (batch by 3 packages)
        all_cves = []
        for batch in self._chunk(packages, 3):
            query = " ".join(f'"{p.name}" "{p.version}" CVE' for p in batch)
            await self.ws.send_status("security", "running", 0.2,
                                      f"Searching CVEs: {', '.join(p.name for p in batch)}...")
            result = await tavily.search(
                query=query,
                search_depth="advanced",
                include_answer=True,
                max_results=5,
                include_domains=["nvd.nist.gov", "github.com/advisories", "security.snyk.io"],
            )

            # Step 2: Fastino extract structured CVE data from results
            combined_content = "\n".join(r["content"] for r in result["results"])
            entities = await self.ctx.fastino.extract_entities(combined_content, [
                "cve_id", "cvss_score", "affected_version", "fixed_version",
                "severity", "exploit_status"
            ])
            all_cves.extend(self._parse_cve_entities(entities, batch))

        # Step 3: Deep extraction from advisory pages
        for cve in all_cves[:5]:  # cap for speed
            if cve.advisory_url:
                extract_result = await tavily.extract(
                    urls=[cve.advisory_url],
                    extract_depth="advanced",
                )
                cve.enrich(extract_result)

        # Step 4: OpenAI chain reasoning using graph context
        await self.ws.send_status("security", "running", 0.7, "Mapping vulnerability chains...")
        graph_context = await self.ctx.neo4j.get_vulnerability_context()
        from openai import AsyncOpenAI
        client = AsyncOpenAI()
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": CHAIN_ANALYSIS_PROMPT},
                {"role": "user", "content": f"CVEs: {json.dumps([c.dict() for c in all_cves])}\n"
                                             f"Graph context:\n{graph_context}"},
            ],
            response_format={"type": "json_schema", "json_schema": CHAIN_SCHEMA},
        )
        chains = json.loads(response.choices[0].message.content)

        # Write to Neo4j
        for cve in all_cves:
            await self.ctx.neo4j.merge_cve(cve)
            finding = cve.to_finding()
            await self.ctx.neo4j.merge_finding(finding)
            await self.ws.send_finding(finding)
            self.ctx.findings.append(finding)
        for chain in chains.get("chains", []):
            await self.ctx.neo4j.merge_chain(chain)
```

### Agent 6: DOCTOR

```python
# app/agents/doctor.py
class DoctorAgent(BaseAgent):
    name = "doctor"
    provider = "openai"

    async def execute(self):
        findings = self.ctx.findings

        # Step 1: Generate fix docs with OpenAI
        from openai import AsyncOpenAI
        client = AsyncOpenAI()

        for i, finding in enumerate(findings):
            if finding.severity == "info":
                continue  # skip info-level for fix generation
            progress = 0.2 + (i / len(findings)) * 0.7
            await self.ws.send_status("doctor", "running", progress,
                                      f"Generating fix: {finding.title[:40]}...")

            graph_context = await self.ctx.neo4j.get_finding_context(finding.id)
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": FIX_DOC_SYSTEM_PROMPT},
                    {"role": "user", "content": (
                        f"Finding: {finding.model_dump_json()}\n"
                        f"Affected code:\n{graph_context}"
                    )},
                ],
                response_format={"type": "json_schema", "json_schema": FIX_DOC_SCHEMA},
            )
            fix = self._create_fix(json.loads(response.choices[0].message.content), finding)
            await self.ctx.neo4j.merge_fix(fix)
            self.ctx.fixes.append(fix)

        # Step 3: Priority ordering
        self.ctx.fixes.sort(key=lambda f: (
            {"critical": 0, "warning": 1, "info": 2}[f.severity],
            -f.chains_resolved,
        ))
        for i, fix in enumerate(self.ctx.fixes):
            fix.priority = i + 1
```

---

## 5. SPONSOR TOOL REFERENCE — COMPLETE ENDPOINT MAPPING

### 5.1 FASTINO LABS — PRIMARY DEMO INFERENCING

**Role:** Primary inferencing engine. 99x faster than LLMs with <150ms CPU latency.

**Base URL:** `https://api.fastino.ai`
**Auth:** `Authorization: Bearer YOUR_FASTINO_KEY`
**Free Tier:** 10,000 requests/month
**Python SDK:** `pip install gliner2` (also direct REST via httpx)

#### Python Client

```python
# app/clients/fastino.py
import httpx
import time
from app.core.config import settings

class FastinoClient:
    BASE_URL = "https://api.fastino.ai"

    def __init__(self):
        self._client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers={"Authorization": f"Bearer {settings.fastino_api_key}"},
            timeout=10.0,
        )

    async def extract_entities(self, text: str, labels: list[str]) -> dict:
        t0 = time.perf_counter()
        resp = await self._client.post("/gliner-2", json={
            "task": "extract_entities",
            "text": text,
            "schema": labels,
        })
        resp.raise_for_status()
        elapsed_ms = round((time.perf_counter() - t0) * 1000)
        result = resp.json()["result"]
        result["_latency_ms"] = elapsed_ms
        return result

    async def classify_text(self, text: str, categories: list[str]) -> dict:
        t0 = time.perf_counter()
        resp = await self._client.post("/gliner-2", json={
            "task": "classify_text",
            "text": text,
            "schema": {"categories": categories},
        })
        resp.raise_for_status()
        elapsed_ms = round((time.perf_counter() - t0) * 1000)
        result = resp.json()["result"]
        result["_latency_ms"] = elapsed_ms
        return result

    async def extract_json(self, text: str, schema: dict) -> dict:
        t0 = time.perf_counter()
        resp = await self._client.post("/gliner-2", json={
            "task": "extract_json",
            "text": text,
            "schema": schema,
        })
        resp.raise_for_status()
        elapsed_ms = round((time.perf_counter() - t0) * 1000)
        result = resp.json()["result"]
        result["_latency_ms"] = elapsed_ms
        return result

    async def close(self):
        await self._client.aclose()
```

#### Endpoints

| Endpoint | Method | Task Types | Purpose |
|----------|--------|------------|--------|
| `/gliner-2` | POST | `extract_entities` | Package names, CVE IDs, function names, versions |
| `/gliner-2` | POST | `classify_text` | File categories, code smells, anti-patterns, tech stack |
| `/gliner-2` | POST | `extract_json` | Structured function signatures, endpoint routes, dep metadata |

#### Expected Usage Per Scan

| Task | Calls | Latency |
|------|-------|---------|
| File categorization (47 files) | 47 | ~150ms total (batched) |
| Dependency extraction | 1-3 | ~90ms |
| Function extraction (per file) | ~30 | ~500ms total |
| CVE entity parsing | 5-10 | ~200ms |
| Code smell classification | ~30 | ~500ms |
| **Total** | **~120 calls** | **~1.5s total** |

---

### 5.2 OPENAI — BACKUP / DEEP REASONING

**Base URL:** `https://api.openai.com/v1`
**Python SDK:** `pip install openai`

```python
# app/clients/openai_client.py
from openai import AsyncOpenAI

openai_client = AsyncOpenAI()  # reads OPENAI_API_KEY from env

async def reason_structured(system: str, user: str, schema: dict) -> dict:
    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_schema", "json_schema": schema},
    )
    return json.loads(response.choices[0].message.content)
```

**Models:** `gpt-4o` (primary reasoning), `gpt-4o-mini` (fallback/simple), `o3-mini` (stretch — chain analysis)
**Expected:** ~15-30 calls/scan, ~40-60K tokens

---

### 5.3 TAVILY — CVE Search & Content Extraction

**Python SDK:** `pip install tavily-python`

```python
# app/clients/tavily_client.py
from tavily import AsyncTavilyClient

tavily_client = AsyncTavilyClient(api_key=settings.tavily_api_key)

async def search_cves(query: str) -> dict:
    return await tavily_client.search(
        query=query,
        search_depth="advanced",
        include_answer=True,
        max_results=5,
        include_domains=["nvd.nist.gov", "github.com/advisories", "security.snyk.io"],
    )

async def extract_advisory(urls: list[str]) -> dict:
    return await tavily_client.extract(urls=urls, extract_depth="advanced")
```

**Endpoints:** `/search` (CVE lookup), `/extract` (advisory deep extraction)
**Expected:** ~10-20 calls/scan

---

### 5.4 NEO4J — Codebase Knowledge Graph

**Python SDK:** `pip install neo4j`

```python
# app/clients/neo4j_client.py
from neo4j import AsyncGraphDatabase

class Neo4jClient:
    def __init__(self):
        self._driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_username, settings.neo4j_password),
        )

    async def merge_file(self, file_data: dict):
        async with self._driver.session() as session:
            await session.run(
                """MERGE (f:File {path: $path})
                   SET f.language = $language, f.lines = $lines,
                       f.category = $category, f.name = $name""",
                **file_data,
            )

    async def get_blast_radius(self, file_path: str, max_hops: int = 3) -> list:
        async with self._driver.session() as session:
            result = await session.run(
                f"""MATCH (start:File {{path: $path}})
                    MATCH (start)-[*1..{max_hops}]->(affected)
                    RETURN DISTINCT labels(affected) as type,
                           affected.path as path, affected.name as name""",
                path=file_path,
            )
            return [record.data() async for record in result]

    async def find_vulnerability_chains(self) -> list:
        async with self._driver.session() as session:
            result = await session.run(
                """MATCH path = (entry:Endpoint)-[:HANDLED_BY]->(:Function)
                   -[:CALLS*1..4]->(:Function)-[:DEFINED_IN]->(:File)
                   -[:DEPENDS_ON]->(:Package {hasVulnerability: true})
                   RETURN path"""
            )
            return [record.data() async for record in result]

    async def close(self):
        await self._driver.close()
```

Full schema defined in Section 6 below.

---

### 5.5 YUTORI — Deep Web Intelligence (STRETCH)

**Base URL:** `https://api.yutori.com`
**Python SDK:** `pip install yutori`

Only used if Tavily results are insufficient for complex CVE chains.

---

### 5.7 AWS — Production Infrastructure (OPTIONAL)

| Service | Purpose | Local Alternative |
|---------|---------|-------------------|
| Lambda | Agent execution (via Mangum) | In-process asyncio |
| S3 | Repo storage | Local `/tmp` |
| DynamoDB | Analysis state | SQLite |
| API Gateway | REST API | FastAPI/uvicorn |

---

## 6. NEO4J GRAPH SCHEMA

### Node Types

```cypher
(:Repository {url, name, owner, branch, clonedAt, healthScore, letterGrade})
(:Directory {path, depth, fileCount})
(:File {path, name, extension, language, lines, size, category,
        lastModified, complexity, hasVulnerability: boolean})
(:Function {name, filePath, startLine, endLine, complexity, paramCount,
            exported: boolean, isAsync: boolean, receivesUserInput: boolean,
            accessesSensitiveData: boolean, hasVulnerability: boolean})
(:Class {name, filePath, startLine, endLine, methodCount, exported: boolean})
(:Endpoint {method, routePath, handler, hasAuth: boolean, hasValidation: boolean})
(:Package {name, version, versionConstraint, isDev: boolean,
           isTransitive: boolean, hasVulnerability: boolean,
           latestVersion, cveCount: int})
(:Finding {id, type, severity, title, description, plainDescription,
           location, startLine, endLine, blastRadius: int,
           agent, confidence: float})
(:VulnerabilityChain {id, description, steps: int, severity, entryPoint, exitPoint})
(:CVE {id, cvssScore: float, description, fixedVersion, exploitAvailable: boolean})
(:Fix {id, title, priority: int, estimatedEffort, description,
       beforeCode, afterCode})
```

### Relationships

```cypher
(repo)-[:CONTAINS]->(dir)
(dir)-[:CONTAINS]->(file|dir)
(file)-[:IMPORTS]->(file)
(file)-[:DEPENDS_ON]->(package)
(package)-[:DEPENDS_ON]->(package)
(function)-[:DEFINED_IN]->(file)
(function)-[:CALLS]->(function)
(class)-[:DEFINED_IN]->(file)
(endpoint)-[:HANDLED_BY]->(function)
(finding)-[:AFFECTS]->(file|function|endpoint|package)
(finding)-[:PART_OF_CHAIN]->(vulnerabilityChain)
(cve)-[:IN_PACKAGE]->(package)
(finding)-[:HAS_CVE]->(cve)
(fix)-[:RESOLVES]->(finding)
(fix)-[:MODIFIES]->(file)
(fix)-[:UPGRADES]->(package)
```

---

## 7. DATABASE & STATE SCHEMAS

### Analysis Record (PostgreSQL via SQLAlchemy)

In the implemented backend, analysis state is stored in **PostgreSQL** using **SQLAlchemy's async ORM**.  
The `Analysis` table is defined as a declarative model and managed via Alembic migrations.

```python
# app/models.py
import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, Float, DateTime, JSON, Enum as SAEnum, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class AnalysisStatus(str, enum.Enum):
    QUEUED = "queued"
    CLONING = "cloning"
    MAPPING = "mapping"
    ANALYZING = "analyzing"
    COMPLETING = "completing"
    COMPLETED = "completed"
    FAILED = "failed"


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    repo_url: Mapped[str] = mapped_column(Text, nullable=False)
    repo_name: Mapped[str] = mapped_column(String(255), nullable=False)
    branch: Mapped[str] = mapped_column(String(255), default="main")
    clone_dir: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[AnalysisStatus] = mapped_column(
        SAEnum(AnalysisStatus, values_callable=lambda x: [e.value for e in x]),
        default=AnalysisStatus.QUEUED,
    )

    detected_stack: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    stats: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    agent_statuses: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    health_score: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    findings_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

Database connectivity is configured via environment-driven URLs:

```python
# app/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
```

At runtime, the FastAPI lifespan hook creates any missing tables using `Base.metadata.create_all`, and Alembic is used for schema migrations in containerized environments.

---

## 8. PROCESSING PIPELINE & DATA FLOW

### Current Implementation (MVP)

```
USER INPUT: "https://github.com/user/repo"
  │
  ▼
POST /api/v1/analyze → 202 Accepted → analysis_id
  │
  ▼ (background task via asyncio.create_task)
ORCHESTRATOR (0:00-0:30)
  ├── git clone → <temp>/vibe-check/repos/anl_abc123/
  ├── Walk filesystem → count files + lines
  ├── Detect languages by file extensions
  ├── Update Analysis row (stats + detected_stack)
  └── Stream status updates over WebSocket (type="status")
  │
  ▼
GET /api/v1/analysis/{analysis_id}
  └── Returns AnalysisResult (status, repo info, stats, timestamps)
```

### Planned Full Pipeline (Roadmap)

```
USER INPUT: "https://github.com/user/repo"
  │
  ▼
POST /api/v1/analyze → 202 Accepted → analysis_id
  │
  ▼ (background task via asyncio)
ORCHESTRATOR
  ├── git clone → /tmp/vibe-check/repos/anl_abc123/
  ├── Detect stack: Fastino classify_text → "Next.js + TypeScript"
  └── Dispatch agents
  │
  ▼
MAPPER AGENT
  ├── Walk filesystem → File/Directory nodes
  ├── Fastino classify_text (batch) → categorize all files
  ├── Parse package.json → Fastino extract_entities → Package nodes
  ├── Parse imports → IMPORTS edges
  ├── Fastino extract_json → Function/Class nodes
  └── All → Neo4j MERGE
  │
  ▼ (asyncio.TaskGroup — parallel)
QUALITY AGENT                     PATTERN AGENT                     SECURITY AGENT
├── Fastino classify per block    ├── Fastino classify structure    ├── Tavily search per dep batch
├── OpenAI deep analysis on flags ├── OpenAI score best practices  ├── Fastino extract CVE entities
└── Findings → Neo4j              └── Findings → Neo4j             ├── Tavily extract advisory pages
                                                                    ├── OpenAI chain reasoning
                                                                    └── Findings + Chains → Neo4j
  │
  ▼
DOCTOR AGENT
  ├── Collect all findings
  ├── OpenAI generate fix docs (with graph context)
  ├── Priority ordering
  └── Fix nodes → Neo4j
  │
  ▼
HEALTH SCORE COMPUTATION
  └── Local algorithm → HealthScore → Neo4j → WebSocket → Dashboard
```

---

## 9. BUILD PLAN (BACKEND FOCUS)

| Time | Backend Focus | Sponsor Integration |
|------|--------------|-------------------|
| 0:00-0:30 | **FastAPI scaffold**: uvicorn, CORS, routes, WebSocket endpoint, Pydantic models, SQLite init, all clients instantiated | — |
| 0:30-1:15 | **Mapper Agent**: git clone, file walk, Fastino classify/extract, Neo4j graph build, WS streaming | Fastino GLiNER-2 entity extraction |
| 1:15-1:45 | **WebSocket broadcaster**: message routing, agent status tracking, graph node/edge streaming | — |
| 1:45-2:30 | **Quality + Pattern agents**: Fastino classify → OpenAI deep analysis, findings to Neo4j | Fastino classification + OpenAI reasoning |
| 2:30-3:15 | **Security Agent**: Tavily search/extract → Fastino CVE parsing → OpenAI chains | Tavily + Fastino + OpenAI + Neo4j |
| 3:15-4:00 | **Doctor Agent**: fix doc gen | OpenAI |
| 4:00-4:30 | **Polish**: error handling, demo repo caching, timeout guards, health score algo | — |

---

## 10. PYTHON PROJECT STRUCTURE

### Current Backend Layout

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app, lifespan, CORS, include routers
│   ├── config.py            # Pydantic Settings (env vars, DB URLs, API keys)
│   ├── database.py          # Async SQLAlchemy engine + session + Base
│   ├── models.py            # SQLAlchemy ORM models (Analysis, AnalysisStatus)
│   ├── schemas.py           # Pydantic API schemas (AnalyzeRequest, AnalysisResult, etc.)
│   │
│   ├── agents/              # Agent implementations (in progress)
│   │   ├── __init__.py
│   │   ├── base.py          # BaseAgent ABC (shared agent lifecycle)
│   │   └── orchestrator.py  # OrchestratorAgent: clone + basic stats + WS status
│   │
│   └── routers/             # FastAPI routers
│       ├── __init__.py
│       ├── health.py        # GET /api/v1/health
│       ├── analysis.py      # POST /api/v1/analyze, GET /api/v1/analysis/{id}
│       └── ws.py            # WebSocket /ws/analysis/{id} + ConnectionManager
│
├── alembic/                 # Alembic migration environment
├── alembic.ini              # Alembic configuration
├── Dockerfile               # Backend image (runs Alembic + uvicorn)
├── entrypoint.sh            # Optional: wait for Postgres, migrate, start app
├── requirements.txt         # Python dependencies
└── README.md
```

### Planned Expansion (Roadmap)

The following modules and directories are part of the **target architecture** and are not yet implemented:

- Additional agents: `MapperAgent`, `QualityAgent`, `PatternAgent`, `SecurityAgent`, `DoctorAgent`
- External clients: `fastino.py`, `openai_client.py`, `tavily_client.py`, `neo4j_client.py`
- Neo4j graph layer and LLM prompt files

### requirements.txt

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
psycopg2-binary==2.9.10
alembic==1.14.1
pydantic==2.10.4
pydantic-settings==2.7.1
python-dotenv==1.0.1
httpx==0.28.1
websockets==14.1
neo4j==5.27.0
```

### FastAPI Entry Point

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.lifespan import lifespan
from app.api import analyze, analysis, ws

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    from app.db.repository import init_db
    from app.clients.fastino import FastinoClient
    from app.clients.neo4j_client import Neo4jClient

    await init_db()
    app.state.fastino = FastinoClient()
    app.state.neo4j = Neo4jClient()

    yield

    # Shutdown
    await app.state.fastino.close()
    await app.state.neo4j.close()

app = FastAPI(
    title="VIBE CHECK API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router, prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(ws.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
```

---

## SPONSOR INTEGRATION SCORECARD

| Sponsor | Depth | Role |
|---------|-------|------|
| **Fastino** | ESSENTIAL | Primary demo inferencing — TLMs + GLiNER-2 via Python SDK. 99x faster. The speed story. |
| **OpenAI** | ESSENTIAL | Backup reasoning — async Python SDK. Complex code analysis, chains, docs. The depth story. |
| **Neo4j** | ESSENTIAL | Codebase knowledge graph — async Python driver. The product IS the graph. |
| **Tavily** | ESSENTIAL | CVE web search — tavily-python async client. The security data source. |
| **Yutori** | STRETCH | Deep web research + continuous monitoring. |
| **AWS** | OPTIONAL | Production deployment via Mangum (Lambda adapter for FastAPI). |

---

*"Vibe code fast. VIBE CHECK before you ship."*