"""
Fastino GLiNER-2 client — entity extraction, text classification, structured JSON.

- If FASTINO_API_KEY is set: uses Fastino hosted API (https://api.fastino.com/gliner-2).
- Otherwise: uses local GLiNER2 (pip install gliner2, from gliner2 import GLiNER2).

Repository: https://github.com/fastino-ai/GLiNER2
"""
from __future__ import annotations

import asyncio
import time
import logging
from typing import Any

import httpx

from app.config import get_settings
from app.clients.tool_logger import log_tool_call

logger = logging.getLogger(__name__)

FASTINO_BASE = "https://api.fastino.com"
LOCAL_MODEL_ID = "fastino/gliner2-base-v1"

# Lazy-loaded local model (sync); loaded once per process
_local_extractor: Any = None
_local_load_error: Exception | None = None


def _get_local_extractor():
    """Load GLiNER2 model once; return extractor or raise."""
    global _local_extractor, _local_load_error
    if _local_extractor is not None:
        return _local_extractor
    if _local_load_error is not None:
        raise _local_load_error
    try:
        from gliner2 import GLiNER2
        _local_extractor = GLiNER2.from_pretrained(LOCAL_MODEL_ID)
        logger.info("GLiNER2 local model loaded: %s", LOCAL_MODEL_ID)
        return _local_extractor
    except Exception as e:
        _local_load_error = e
        logger.warning("GLiNER2 local load failed: %s", e)
        raise


def _classify_text_sync(text: str, categories: list[str], threshold: float) -> dict[str, Any]:
    """Run classify_text on local model (blocking)."""
    ext = _get_local_extractor()
    # schema: single key with list of labels → result[key] = label or {label, confidence}
    schema = {"category": categories}
    out = ext.classify_text(text[:8000], schema, include_confidence=True)
    # out e.g. {'category': {'label': 'positive', 'confidence': 0.82}} or {'category': 'positive'}
    cat = out.get("category")
    if isinstance(cat, dict):
        return {"label": cat.get("label", "unknown"), "score": cat.get("confidence", 0.5)}
    return {"label": cat if cat else "unknown", "score": 0.5}


def _extract_entities_sync(text: str, labels: list[str], threshold: float) -> dict[str, Any]:
    """Run extract_entities on local model (blocking)."""
    ext = _get_local_extractor()
    out = ext.extract_entities(text[:8000], labels, include_confidence=True)
    # out = {'entities': {'company': [{'text': 'Apple', 'confidence': 0.95}], ...}}
    entities_dict = out.get("entities", {})
    # Normalize to list of dicts for pipeline (type, text, score / CVE_ID, CVSS, etc.)
    flat: list[dict[str, Any]] = []
    for label, values in entities_dict.items():
        for v in values if isinstance(values, list) else [values]:
            if isinstance(v, dict):
                flat.append({
                    "type": label,
                    "text": v.get("text", v.get("value", "")),
                    "confidence": v.get("confidence", 0.5),
                    label: v.get("text", v.get("value", "")),
                })
            else:
                flat.append({"type": label, "text": str(v), label: str(v)})
    return {"entities": flat, "result": flat}


def _extract_json_sync(text: str, schema: dict) -> dict[str, Any]:
    """Run extract_json on local model (blocking)."""
    ext = _get_local_extractor()
    out = ext.extract_json(text[:8000], schema)
    return {"result": out, **out}


class FastinoClient:
    def __init__(self):
        self.settings = get_settings()
        self._headers = {
            "x-api-key": self.settings.fastino_api_key,
            "Content-Type": "application/json",
        }

    @property
    def available(self) -> bool:
        if bool(self.settings.fastino_api_key):
            return True
        try:
            _get_local_extractor()
            return True
        except Exception:
            return False

    async def classify_text(
        self,
        analysis_id: str,
        text: str,
        categories: list[str],
        step_name: str = "classify_text",
        threshold: float = 0.5,
    ) -> dict[str, Any]:
        payload = {
            "task": "classify_text",
            "text": text[:8000],
            "schema": {"categories": categories},
            "threshold": threshold,
        }
        return await self._call(analysis_id, step_name, payload)

    async def extract_entities(
        self,
        analysis_id: str,
        text: str,
        labels: list[str],
        step_name: str = "extract_entities",
        threshold: float = 0.5,
    ) -> dict[str, Any]:
        payload = {
            "task": "extract_entities",
            "text": text[:8000],
            "schema": labels,
            "threshold": threshold,
        }
        return await self._call(analysis_id, step_name, payload)

    async def extract_json(
        self,
        analysis_id: str,
        text: str,
        schema: dict,
        step_name: str = "extract_json",
    ) -> dict[str, Any]:
        payload = {
            "task": "extract_json",
            "text": text[:8000],
            "schema": schema,
        }
        return await self._call(analysis_id, step_name, payload)

    async def _call(self, analysis_id: str, step_name: str, payload: dict) -> dict[str, Any]:
        if self.settings.fastino_api_key:
            return await self._call_api(analysis_id, step_name, payload)
        return await self._call_local(analysis_id, step_name, payload)

    async def _call_api(self, analysis_id: str, step_name: str, payload: dict) -> dict[str, Any]:
        endpoint = f"{FASTINO_BASE}/gliner-2"
        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(endpoint, headers=self._headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
            latency = round((time.perf_counter() - t0) * 1000)
            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="fastino",
                step_name=step_name,
                endpoint=endpoint,
                request_payload=payload,
                response_payload=data,
                latency_ms=latency,
            )
            result = data.get("result", data)
            result["_latency_ms"] = latency
            return result
        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000)
            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="fastino",
                step_name=step_name,
                endpoint=endpoint,
                request_payload=payload,
                latency_ms=latency,
                status="error",
                error_message=str(exc)[:500],
            )
            logger.warning("Fastino API %s failed: %s", step_name, exc)
            raise

    async def _call_local(self, analysis_id: str, step_name: str, payload: dict) -> dict[str, Any]:
        task = payload.get("task", "")
        text = payload.get("text", "")
        t0 = time.perf_counter()
        try:
            if task == "classify_text":
                schema = payload.get("schema", {})
                categories = schema.get("categories", []) if isinstance(schema, dict) else list(schema) if schema else []
                threshold = payload.get("threshold", 0.5)
                result = await asyncio.to_thread(_classify_text_sync, text, categories, threshold)
            elif task == "extract_entities":
                labels = payload.get("schema", [])
                if isinstance(labels, dict):
                    labels = list(labels.keys())
                threshold = payload.get("threshold", 0.5)
                result = await asyncio.to_thread(_extract_entities_sync, text, labels, threshold)
            elif task == "extract_json":
                schema = payload.get("schema", {})
                result = await asyncio.to_thread(_extract_json_sync, text, schema)
            else:
                raise ValueError(f"Unknown task: {task}")
            latency = round((time.perf_counter() - t0) * 1000)
            result["_latency_ms"] = latency
            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="fastino",
                step_name=step_name,
                endpoint="local:gliner2",
                request_payload=payload,
                response_payload=result,
                latency_ms=latency,
            )
            return result
        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000)
            await log_tool_call(
                analysis_id=analysis_id,
                tool_name="fastino",
                step_name=step_name,
                endpoint="local:gliner2",
                request_payload=payload,
                latency_ms=latency,
                status="error",
                error_message=str(exc)[:500],
            )
            logger.warning("Fastino local %s failed: %s", step_name, exc)
            raise
