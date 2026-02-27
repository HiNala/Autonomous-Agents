from __future__ import annotations

import asyncio
import logging
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from sqlalchemy import select

from app.config import get_settings
from app.database import async_session
from app.models import Analysis, AnalysisStatus
from app.routers.ws import manager
from app.clients.github_client import fetch_repo_metadata
from app.clients.tavily_client import search_repo_context
from app.clients.fastino import classify_text
from app.clients.neo4j_client import Neo4jClient
from app.llm.provider import get_reasoning_provider

from .base import BaseAgent

logger = logging.getLogger(__name__)
settings = get_settings()


class OrchestratorAgent(BaseAgent):
    """Lightweight orchestrator that clones the repo and computes basic stats.

    This is a minimal, production-backed implementation that can be extended
    later with the full multi-agent pipeline described in backend.md.
    """

    name = "orchestrator"
    provider = "local"

    async def on_start(self) -> None:  # type: ignore[override]
        await self._broadcast_status(
            stage="starting",
            progress=0.0,
            message="Orchestrator starting...",
        )

    async def on_complete(self) -> None:  # type: ignore[override]
        await self._broadcast_status(
            stage="completed",
            progress=1.0,
            message="Analysis completed.",
        )

    async def on_error(self, error: Exception) -> None:  # type: ignore[override]
        logger.exception("Orchestrator failed for analysis %s", self.analysis.analysis_id)
        self.analysis.status = AnalysisStatus.FAILED
        await self.db.commit()
        await self._broadcast_status(
            stage="failed",
            progress=1.0,
            message=f"Analysis failed: {error}",
        )

    async def execute(self) -> None:  # type: ignore[override]
        start_time = datetime.now(timezone.utc)

        # 1. Clone repository
        self.analysis.status = AnalysisStatus.CLONING
        await self.db.commit()
        await self._broadcast_status(
            stage="cloning",
            progress=0.1,
            message="Cloning repository...",
        )
        clone_dir = await self._clone_repo(
            repo_url=self.analysis.repo_url,
            branch=self.analysis.branch,
            analysis_id=self.analysis.analysis_id,
        )
        self.analysis.clone_dir = str(clone_dir)

        # 2. Compute very basic repository statistics
        self.analysis.status = AnalysisStatus.MAPPING
        await self._broadcast_status(
            stage="mapping",
            progress=0.4,
            message="Computing basic repository statistics...",
        )
        stats = await self._compute_basic_stats(clone_dir)
        # Ensure stats dict exists so we can enrich it in later stages.
        self.analysis.stats = stats
        self.analysis.detected_stack = {
            "languages": stats.get("languages", []),
            "frameworks": [],
            "packageManager": "",
            "buildSystem": "",
        }

        # 3. GitHub metadata ingestion
        self.analysis.status = AnalysisStatus.ANALYZING
        await self._broadcast_status(
            stage="github_metadata",
            progress=0.5,
            message="Fetching GitHub repository metadata...",
        )
        try:
            github_meta = await fetch_repo_metadata(self.analysis.repo_url)
        except Exception as exc:  # noqa: BLE001
            logger.warning("GitHub metadata ingestion failed: %s", exc)
            github_meta = {}

        enriched_stats: Dict[str, Any] = dict(self.analysis.stats or {})
        enriched_stats["github"] = github_meta

        # 4. Tavily enrichment (CVE + deps + related projects)
        await self._broadcast_status(
            stage="tavily_enrichment",
            progress=0.6,
            message="Running Tavily enrichment (CVE + dependencies)...",
        )
        try:
            tavily_data = await search_repo_context(self.analysis.repo_url)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Tavily enrichment failed: %s", exc)
            tavily_data = {}
        enriched_stats["tavily"] = tavily_data

        # 5. Fastino quick scoring (high-level risk signal)
        await self._broadcast_status(
            stage="fastino_scoring",
            progress=0.7,
            message="Computing quick risk score with Fastino...",
        )
        quick_context = (
            f"Repo: {self.analysis.repo_name}\n"
            f"Languages: {', '.join(stats.get('languages', []))}\n"
            f"Total files: {stats.get('total_files')}\n"
            f"Total lines: {stats.get('total_lines')}\n"
            f"GitHub: {github_meta.get('repo', {})}\n"
            f"Tavily summary: {tavily_data.get('answer') if isinstance(tavily_data, dict) else ''}\n"
        )
        fastino_quick = {}
        try:
            fastino_quick = await classify_text(
                quick_context,
                ["healthy", "needs_attention", "high_risk"],
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Fastino quick scoring failed: %s", exc)
        enriched_stats["fastinoQuickScore"] = fastino_quick

        # 6. Yutori (primary) / OpenAI (backup) deep reasoning
        await self._broadcast_status(
            stage="deep_reasoning",
            progress=0.8,
            message="Running deep reasoning (Yutori/OpenAI)...",
        )
        deep_summary = ""
        try:
            provider = get_reasoning_provider()
            system_prompt = (
                "You are a senior engineering manager performing a holistic review of "
                "a GitHub repository. Analyze architecture, maintainability, bus "
                "factor, and security posture. Write a concise multi-paragraph "
                "summary suitable for a technical stakeholder."
            )
            user_prompt = (
                f"Repository URL: {self.analysis.repo_url}\n"
                f"Basic stats: {stats}\n"
                f"GitHub metadata: {github_meta}\n"
                f"Tavily enrichment: {tavily_data}\n"
                f"Fastino quick score: {fastino_quick}\n"
            )
            deep_summary = await provider.reason(system_prompt, user_prompt)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Deep reasoning step failed: %s", exc)
        enriched_stats["yutoriDeepAnalysis"] = {"summary": deep_summary}

        # 7. Neo4j contributor + language graph (optional)
        await self._broadcast_status(
            stage="neo4j_graph",
            progress=0.9,
            message="Updating Neo4j contributor + language graph...",
        )
        neo4j_status: Dict[str, Any] = {}
        try:
            if settings.neo4j_uri and settings.neo4j_password:
                async with Neo4jClient() as neo:
                    await neo.write_repo_graph(
                        repo_url=self.analysis.repo_url,
                        repo_name=self.analysis.repo_name,
                        branch=self.analysis.branch,
                        languages=stats.get("languages", []),
                        contributors=github_meta.get("contributors", []),
                    )
                neo4j_status = {"status": "ok"}
        except Exception as exc:  # noqa: BLE001
            logger.warning("Neo4j graph update failed: %s", exc)
            neo4j_status = {"status": "error", "message": str(exc)}
        enriched_stats["neo4j"] = neo4j_status

        # Persist enriched stats
        self.analysis.stats = enriched_stats

        # 3. Mark analysis as completed
        self.analysis.status = AnalysisStatus.COMPLETED
        completed_at = datetime.now(timezone.utc)
        self.analysis.completed_at = completed_at
        self.analysis.duration_seconds = int((completed_at - start_time).total_seconds())
        await self.db.commit()
        await self._broadcast_status(
            stage="completed",
            progress=1.0,
            message="Analysis completed.",
            extra={"stats": stats},
        )

    async def _clone_repo(self, repo_url: str, branch: str | None, analysis_id: str) -> Path:
        base_dir = Path(tempfile.gettempdir()) / "vibe-check" / "repos"
        base_dir.mkdir(parents=True, exist_ok=True)
        clone_dir = base_dir / analysis_id

        if clone_dir.exists():
            # Reuse existing clone directory if it already exists.
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
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            logger.error(
                "Git clone failed for %s (branch=%s): %s",
                repo_url,
                branch,
                stderr.decode(errors="ignore"),
            )
            raise RuntimeError(f"Clone failed with exit code {proc.returncode}")

        logger.info("Cloned repository %s into %s", repo_url, clone_dir)
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
            logger.warning("Analysis %s not found when starting orchestrator", analysis_id)
            return

        agent = OrchestratorAgent(db=db, analysis=analysis)
        await agent.run()

