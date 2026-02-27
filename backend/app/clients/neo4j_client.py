from __future__ import annotations

import logging
from typing import Any, Dict, List

from neo4j import AsyncGraphDatabase

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class Neo4jClient:
    """Very small wrapper for writing repository-level graph data.

    This is intentionally minimal: it focuses on the sponsor-visible story
    of contributor + language/dependency visualization rather than the full
    schema described in the design docs.
    """

    def __init__(self) -> None:
        if not settings.neo4j_uri or not settings.neo4j_password:
            raise RuntimeError("NEO4J_URI and NEO4J_PASSWORD must be configured")
        # Username is assumed to be the default "neo4j"
        self._driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=("neo4j", settings.neo4j_password),
        )

    async def __aenter__(self) -> "Neo4jClient":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:  # noqa: ANN001
        await self.close()

    async def close(self) -> None:
        await self._driver.close()

    async def write_repo_graph(
        self,
        repo_url: str,
        repo_name: str,
        branch: str,
        languages: List[str],
        contributors: List[Dict[str, Any]],
    ) -> None:
        """Create a simple graph: Repository → Languages, Repository → Contributors."""
        async with self._driver.session() as session:
            await session.execute_write(
                self._write_repo_tx,
                repo_url=repo_url,
                repo_name=repo_name,
                branch=branch,
                languages=languages,
                contributors=contributors,
            )

    @staticmethod
    async def _write_repo_tx(tx, **params):  # type: ignore[no-untyped-def]
        repo_url: str = params["repo_url"]
        repo_name: str = params["repo_name"]
        branch: str = params["branch"]
        languages: List[str] = params.get("languages", [])
        contributors: List[Dict[str, Any]] = params.get("contributors", [])

        await tx.run(
            """
            MERGE (r:Repository {url: $url})
              ON CREATE SET r.name = $name, r.defaultBranch = $branch
              ON MATCH  SET r.name = $name, r.defaultBranch = $branch
            """,
            url=repo_url,
            name=repo_name,
            branch=branch,
        )

        for lang in languages:
            await tx.run(
                """
                MERGE (l:Language {name: $lang})
                WITH l
                MATCH (r:Repository {url: $url})
                MERGE (r)-[:USES_LANGUAGE]->(l)
                """,
                lang=lang,
                url=repo_url,
            )

        for c in contributors:
            login = c.get("login")
            contributions = c.get("contributions", 0)
            if not login:
                continue
            await tx.run(
                """
                MERGE (u:Contributor {login: $login})
                  ON CREATE SET u.totalContributions = $contrib
                  ON MATCH  SET u.totalContributions = coalesce(u.totalContributions, 0) + $contrib
                WITH u
                MATCH (r:Repository {url: $url})
                MERGE (u)-[rel:CONTRIBUTED_TO]->(r)
                """,
                login=login,
                contrib=contributions,
                url=repo_url,
            )

