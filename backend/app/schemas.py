from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime
from enum import Enum


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


class AnalyzeRequest(BaseModel):
    repo_url: str
    branch: Optional[str] = None
    scope: Optional[str] = "full"
    max_files: Optional[int] = 500
    use_senso_intelligence: Optional[bool] = True


class AnalyzeResponse(BaseModel):
    analysis_id: str
    status: str
    repo_name: str
    estimated_duration: int
    websocket_url: str


class DetectedStack(BaseModel):
    languages: list[str] = []
    frameworks: list[str] = []
    package_manager: str = ""
    build_system: str = ""


class RepoStats(BaseModel):
    total_files: int = 0
    total_lines: int = 0
    total_dependencies: int = 0
    total_dev_dependencies: int = 0
    total_functions: int = 0
    total_endpoints: int = 0


class CategoryScore(BaseModel):
    score: int
    max: int = 10
    status: str


class HealthScore(BaseModel):
    overall: int
    letter_grade: str
    breakdown: dict[str, CategoryScore] = {}
    confidence: float = 0.0


class FindingsSummary(BaseModel):
    critical: int = 0
    warning: int = 0
    info: int = 0
    total: int = 0


class Timestamps(BaseModel):
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration: Optional[int] = None


class AnalysisResult(BaseModel):
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


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[dict] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
