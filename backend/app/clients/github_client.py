from __future__ import annotations

import logging
from typing import Any, Dict, List, Tuple

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

BASE_URL = "https://api.github.com"


def _parse_github_repo(repo_url: str) -> Tuple[str, str]:
    """Extract (owner, repo) from a GitHub URL."""
    # Examples:
    # https://github.com/owner/repo
    # git@github.com:owner/repo.git
    url = repo_url.strip()
    if url.endswith(".git"):
        url = url[:-4]

    if url.startswith("git@github.com:"):
        path = url.split("git@github.com:")[1]
    elif "github.com/" in url:
        path = url.split("github.com/")[1]
    else:
        raise ValueError(f"Not a GitHub URL: {repo_url}")

    parts = [p for p in path.split("/") if p]
    if len(parts) < 2:
        raise ValueError(f"Could not parse owner/repo from URL: {repo_url}")
    owner, repo = parts[0], parts[1]
    return owner, repo


def _auth_headers() -> Dict[str, str]:
    headers: Dict[str, str] = {"Accept": "application/vnd.github+json"}
    token = settings.github_token
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def fetch_repo_metadata(repo_url: str) -> Dict[str, Any]:
    """Fetch basic GitHub metadata and contributors for a repository."""
    owner, repo = _parse_github_repo(repo_url)

    async with httpx.AsyncClient(timeout=20.0) as client:
        repo_resp = await client.get(
            f"{BASE_URL}/repos/{owner}/{repo}",
            headers=_auth_headers(),
        )
        repo_resp.raise_for_status()
        repo_data = repo_resp.json()

        contributors: List[Dict[str, Any]] = []
        try:
            contrib_resp = await client.get(
                f"{BASE_URL}/repos/{owner}/{repo}/contributors",
                headers=_auth_headers(),
            )
            if contrib_resp.status_code == 200:
                raw = contrib_resp.json()
                contributors = [
                    {
                        "login": c.get("login"),
                        "contributions": c.get("contributions", 0),
                    }
                    for c in raw
                ]
        except httpx.HTTPError as exc:  # pragma: no cover - best effort
            logger.warning("Failed to fetch GitHub contributors: %s", exc)

    metadata: Dict[str, Any] = {
        "full_name": repo_data.get("full_name"),
        "description": repo_data.get("description"),
        "stars": repo_data.get("stargazers_count"),
        "forks": repo_data.get("forks_count"),
        "open_issues": repo_data.get("open_issues_count"),
        "watchers": repo_data.get("subscribers_count"),
        "default_branch": repo_data.get("default_branch"),
        "archived": repo_data.get("archived"),
        "pushed_at": repo_data.get("pushed_at"),
        "created_at": repo_data.get("created_at"),
        "updated_at": repo_data.get("updated_at"),
    }

    return {
        "repo": metadata,
        "contributors": contributors,
    }

