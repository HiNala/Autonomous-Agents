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
    senso_content_ids: Mapped[list | None] = mapped_column(JSON, default=list)

    # Populated by agents — stored as JSONB blobs
    findings: Mapped[list | None] = mapped_column(JSON, nullable=True)
    fixes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    chains: Mapped[list | None] = mapped_column(JSON, nullable=True)
    graph_nodes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    graph_edges: Mapped[list | None] = mapped_column(JSON, nullable=True)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
