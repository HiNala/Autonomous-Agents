from __future__ import annotations

import logging
from typing import Any, Dict, List

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

BASE_URL = "https://api.fastino.ai"


def _auth_headers() -> Dict[str, str]:
    if not settings.fastino_api_key:
        raise RuntimeError(
            "FASTINO_API_KEY is not configured. Set it in your environment or .env file.",
        )
    return {"Authorization": f"Bearer {settings.fastino_api_key}"}


async def classify_text(text: str, categories: List[str]) -> Dict[str, Any]:
    """Classify text into one of the given categories using Fastino GLiNER-2."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        resp = await client.post(
            "/gliner-2",
            headers=_auth_headers(),
            json={
                "task": "classify_text",
                "text": text,
                "schema": {"categories": categories},
            },
        )
        resp.raise_for_status()
        return resp.json()["result"]


async def extract_entities(text: str, labels: List[str]) -> Dict[str, Any]:
    """Extract entities from text using Fastino GLiNER-2."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        resp = await client.post(
            "/gliner-2",
            headers=_auth_headers(),
            json={
                "task": "extract_entities",
                "text": text,
                "schema": labels,
            },
        )
        resp.raise_for_status()
        return resp.json()["result"]


async def extract_json(text: str, schema: Dict[str, Any]) -> Dict[str, Any]:
    """Extract structured JSON data from text using Fastino GLiNER-2."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        resp = await client.post(
            "/gliner-2",
            headers=_auth_headers(),
            json={
                "task": "extract_json",
                "text": text,
                "schema": schema,
            },
        )
        resp.raise_for_status()
        return resp.json()["result"]

