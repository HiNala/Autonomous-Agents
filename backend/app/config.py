from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Autonomix API"
    debug: bool = True

    database_url: str = "postgresql+asyncpg://autonomix:autonomix_secret@localhost:5432/autonomix"
    database_url_sync: str = "postgresql://autonomix:autonomix_secret@localhost:5432/autonomix"

    yutori_api_key: str = ""
    neo4j_uri: str = ""
    neo4j_user: str = "neo4j"
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
