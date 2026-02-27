from __future__ import annotations

import logging
from typing import Any, Dict

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

BASE_URL = "https://api.tavily.com"


async def search_repo_context(repo_url: str) -> Dict[str, Any]:
    """Use Tavily to enrich a GitHub repo with CVE/dependency context.

    Returns Tavily's raw JSON response. If TAVILY_API_KEY is not configured or
    the request fails, an empty dict is returned and a warning is logged.
    """
    api_key = settings.tavily_api_key
    if not api_key:
        logger.info("TAVILY_API_KEY not configured; skipping Tavily enrichment")
        return {}

    query = (
        f"Security and dependency overview for GitHub repository {repo_url}. "
        f"Summarize known CVEs, key dependencies, and any closely related projects."
    )

    payload: Dict[str, Any] = {
        "api_key": api_key,
        "query": query,
        "search_depth": "advanced",
        "include_answer": True,
        "max_results": 5,
    }

    try:
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
            resp = await client.post("/search", json=payload)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as exc:  # pragma: no cover - best effort
        logger.warning("Tavily enrichment failed: %s", exc)
        return {}

