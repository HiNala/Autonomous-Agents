from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from typing import Optional
from datetime import datetime
from enum import Enum


class CamelModel(BaseModel):
    """Base model that auto-generates camelCase aliases for all fields."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class AnalysisStatusEnum(str, Enum):
    queued = "queued"
    cloning = "cloning"
    mapping = "mapping"
    analyzing = "analyzing"
    completing = "completing"
    completed = "completed"
    failed = "failed"


class Severity(str, Enum):
    critical = "critical"
    warning = "warning"
    info = "info"


class AnalyzeRequest(CamelModel):
    repo_url: str
    branch: Optional[str] = None
    scope: Optional[str] = "full"
    max_files: Optional[int] = 500
    use_senso_intelligence: Optional[bool] = True


class AnalyzeResponse(CamelModel):
    analysis_id: str
    status: str
    repo_name: str
    estimated_duration: int
    websocket_url: str


class DetectedStack(CamelModel):
    languages: list[str] = []
    frameworks: list[str] = []
    package_manager: str = ""
    build_system: str = ""


class RepoStats(CamelModel):
    total_files: int = 0
    total_lines: int = 0
    total_dependencies: int = 0
    total_dev_dependencies: int = 0
    total_functions: int = 0
    total_endpoints: int = 0


class CategoryScore(CamelModel):
    score: int
    max: int = 10
    status: str


class HealthScore(CamelModel):
    overall: int
    letter_grade: str
    breakdown: dict[str, CategoryScore] = {}
    confidence: float = 0.0


class FindingsSummary(CamelModel):
    critical: int = 0
    warning: int = 0
    info: int = 0
    total: int = 0


class Timestamps(CamelModel):
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration: Optional[int] = None


class AnalysisResult(CamelModel):
    analysis_id: str
    status: AnalysisStatusEnum
    repo_url: str
    repo_name: str
    branch: str
    detected_stack: Optional[DetectedStack] = None
    stats: Optional[RepoStats] = None
    health_score: Optional[HealthScore] = None
    findings: FindingsSummary = FindingsSummary()
    vulnerability_chains: int = 0
    fixes_generated: int = 0
    timestamps: Timestamps = Timestamps()


class HealthResponse(CamelModel):
    status: str
    service: str
    version: str
    database: str = "unknown"


class ErrorDetail(CamelModel):
    code: str
    message: str
    details: Optional[dict] = None


class ErrorResponse(CamelModel):
    error: ErrorDetail
