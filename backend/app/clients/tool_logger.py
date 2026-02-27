"""
Centralised helper that records every sponsor-tool API call into the
tool_calls table so we can audit and build on the data later.
"""
from __future__ import annotations

import time
import logging
from typing import Any

from app.database import async_session
from app.models import ToolCall

logger = logging.getLogger(__name__)


async def log_tool_call(
    analysis_id: str,
    tool_name: str,
    step_name: str,
    endpoint: str,
    request_payload: dict | None = None,
    response_payload: dict | None = None,
    latency_ms: int | None = None,
    status: str = "success",
    error_message: str | None = None,
) -> ToolCall:
    """Persist a single tool interaction."""
    tc = ToolCall(
        analysis_id=analysis_id,
        tool_name=tool_name,
        step_name=step_name,
        endpoint=endpoint,
        request_payload=_safe_json(request_payload),
        response_payload=_safe_json(response_payload),
        latency_ms=latency_ms,
        status=status,
        error_message=error_message,
    )
    try:
        async with async_session() as session:
            session.add(tc)
            await session.commit()
    except Exception as exc:
        logger.warning("Failed to log tool call (%s/%s): %s", tool_name, step_name, exc)
    return tc


def _safe_json(obj: Any) -> dict | list | None:
    """Ensure the payload is JSON-serialisable; truncate huge blobs."""
    if obj is None:
        return None
    if isinstance(obj, (dict, list)):
        return _truncate(obj)
    return {"_raw": str(obj)[:4000]}


def _truncate(obj: Any, max_str_len: int = 4000) -> Any:
    if isinstance(obj, str):
        return obj[:max_str_len] if len(obj) > max_str_len else obj
    if isinstance(obj, dict):
        return {k: _truncate(v, max_str_len) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_truncate(v, max_str_len) for v in obj[:200]]
    return obj
