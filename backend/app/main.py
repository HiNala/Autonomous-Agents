from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, Base
from app.models import Analysis, ToolCall  # noqa: F401 — register models with Base.metadata
from app.routers import health, analysis, ws
from app.routers import findings, fixes, graph, senso, tool_calls
from app.services import neo4j as neo4j_service

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create / verify DB tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created / verified")

    # Attempt Neo4j connection (non-fatal — graph features degrade gracefully)
    connected = await neo4j_service.is_connected()
    if connected:
        logger.info("Neo4j connected")
    else:
        logger.warning("Neo4j not available — graph features will use JSON fallback")

    yield

    await engine.dispose()
    await neo4j_service.close()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────
app.include_router(health.router,    prefix="/api/v1", tags=["health"])
app.include_router(analysis.router,  prefix="/api/v1", tags=["analysis"])
app.include_router(findings.router,  prefix="/api/v1", tags=["findings"])
app.include_router(fixes.router,     prefix="/api/v1", tags=["fixes"])
app.include_router(graph.router,     prefix="/api/v1", tags=["graph"])
app.include_router(senso.router,     prefix="/api/v1", tags=["senso"])
app.include_router(tool_calls.router, prefix="/api/v1", tags=["tool-calls"])
app.include_router(ws.router,        tags=["websocket"])


@app.get("/")
async def root():
    return {"message": "VIBE CHECK API", "version": "0.1.0", "docs": "/docs"}
