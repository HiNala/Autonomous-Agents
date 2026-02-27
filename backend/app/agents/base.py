from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

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
        """Template method wrapping execution with lifecycle hooks."""
        await self.on_start()
        try:
            await self.execute()
            await self.on_complete()
        except Exception as exc:  # noqa: BLE001
            await self.on_error(exc)
            raise

    async def on_start(self) -> None:
        """Optional hook for startup logic (e.g. websocket notifications)."""

    async def on_complete(self) -> None:
        """Optional hook for successful completion logic."""

    async def on_error(self, error: Exception) -> None:  # noqa: ARG002
        """Optional hook for error handling."""

    @abstractmethod
    async def execute(self) -> None:
        """Agent-specific implementation."""
        raise NotImplementedError

