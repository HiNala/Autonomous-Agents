from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "VIBE CHECK API"
    debug: bool = True

    database_url: str = "postgresql+asyncpg://vibecheck:vibecheck_secret@localhost:5432/vibecheck"
    database_url_sync: str = "postgresql://vibecheck:vibecheck_secret@localhost:5432/vibecheck"

    yutori_api_key: str = ""
    senso_api_key: str = ""
    neo4j_uri: str = ""
    neo4j_password: str = ""
    tavily_api_key: str = ""
    openai_api_key: str = ""
    fastino_api_key: str = ""
    github_token: str = ""
    dashboard_webhook_secret: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
