# VIBE CHECK — Codebase Intelligence Engine

Autonomous multi-agent GitHub repository analyzer. Clones repos, builds knowledge graphs with Neo4j, runs specialist analysis agents, and generates prioritized fix documentation.

## Architecture

| Service    | Tech                                    | Port  |
|------------|------------------------------------------|-------|
| Frontend   | Next.js 16 · TypeScript · Tailwind       | 3000  |
| Backend    | FastAPI · SQLAlchemy · Alembic · Asyncio | 8000  |
| Database   | PostgreSQL 16                            | 5432  |
| Graph DB   | Neo4j 5 Community (Docker)               | 7474/7687 |

## Sponsor Integrations

| Integration | Purpose                        | Status       |
|-------------|--------------------------------|--------------|
| Neo4j       | Knowledge graph (local Docker) | ✅ Wired     |
| Yutori      | Primary reasoning engine       | ✅ Wired     |
| Tavily      | Fast web search / CVE lookup   | ✅ Wired     |
| OpenAI      | Fallback LLM reasoning         | ✅ Wired     |
| Fastino     | Entity extraction / classify   | ✅ Wired     |
| Senso       | Persistent cross-repo memory   | ⚙️ Key needed |
| PostgreSQL  | Primary relational store       | ✅ Wired     |
| GitHub API  | Repo metadata / rate limits    | ⚙️ Key optional |

## Quick Start

```bash
# 1. Copy env template and fill in your API keys
cp .env.example .env
# Edit .env — add YUTORI_API_KEY, TAVILY_API_KEY, OPENAI_API_KEY, FASTINO_API_KEY
# Neo4j runs locally in Docker — no external key needed

# 2. Boot everything (Postgres + Neo4j + Backend + Frontend)
docker compose up --build -d

# 3. Verify all services
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/api/v1/health/integrations
```

### Service URLs

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Frontend app |
| `http://localhost:8000/docs` | Backend Swagger UI |
| `http://localhost:8000/api/v1/health` | Health check |
| `http://localhost:8000/api/v1/health/integrations` | All integration status |
| `http://localhost:7474` | Neo4j Browser UI |

### Neo4j Local Setup

Neo4j runs inside Docker Compose — **no separate install required**.

```
URI (inside Docker):  bolt://neo4j:7687
URI (from host):      bolt://localhost:7687
Browser UI:           http://localhost:7474
Username:             neo4j
Password:             vibecheck_neo4j  (set in .env as NEO4J_PASSWORD)
```

On first boot, the backend automatically:
1. Connects to Neo4j via the Docker network
2. Creates indexes for fast analysis queries
3. Creates a uniqueness constraint for Repository nodes

To browse your graph data: open `http://localhost:7474` and log in with the credentials above.

```cypher
-- See all analyses in the graph
MATCH (n) RETURN labels(n), count(n) ORDER BY count(n) DESC LIMIT 20

-- See the file graph for an analysis
MATCH (f:File {analysisId: "your-analysis-id"}) RETURN f LIMIT 50
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
# Required — sponsor API keys
YUTORI_API_KEY=yt_...        # platform.yutori.com
TAVILY_API_KEY=tvly-...      # app.tavily.com
OPENAI_API_KEY=sk-proj-...   # platform.openai.com
FASTINO_API_KEY=pio_sk_...   # fastino.ai

# Optional — enhanced features
SENSO_API_KEY=...            # email tom@senso.ai
GITHUB_TOKEN=ghp_...         # github.com/settings/tokens (raises rate limits)

# Neo4j — local Docker (defaults work out of the box)
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=vibecheck_neo4j

# Auto-configured (do not change for Docker)
POSTGRES_USER=vibecheck
POSTGRES_PASSWORD=vibecheck_secret
POSTGRES_DB=vibecheck
```

## Development

```bash
# Frontend (standalone)
cd frontend && npm install && npm run dev

# Backend (standalone — needs postgres + neo4j running via docker)
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

# Run DB migrations only
cd backend && alembic upgrade head

# Just spin up dependencies (no app rebuild)
docker compose up postgres neo4j -d
```

## Project Structure

```
├── docker-compose.yml        # All 4 services
├── .env / .env.example       # API keys & config
├── frontend/                 # Next.js 16 App Router
│   ├── src/app/              # Pages (/, /analysis/[id])
│   ├── src/components/       # UI components
│   │   ├── findings/         # FindingsPanel, FindingDetail
│   │   ├── graph/            # GraphPanel, GraphCanvas (Cytoscape.js)
│   │   ├── score/            # HealthScoreHero, ScoreBreakdown
│   │   ├── senso/            # SensoIntelligencePanel
│   │   └── input/            # AnalysisInput
│   └── src/stores/           # Zustand state (analysisStore)
├── backend/                  # FastAPI
│   ├── app/
│   │   ├── main.py           # FastAPI entry point + Neo4j lifespan
│   │   ├── config.py         # Pydantic settings (env vars)
│   │   ├── models.py         # SQLAlchemy models
│   │   ├── routers/          # API routes (analysis, findings, graph, health…)
│   │   ├── services/
│   │   │   ├── neo4j.py      # Neo4j graph writes + reads + schema init
│   │   │   └── pipeline.py   # Full analysis pipeline orchestrator
│   │   └── clients/          # Sponsor API wrappers
│   │       ├── fastino.py    # Fastino GLiNER-2
│   │       ├── tavily_client.py  # Tavily search
│   │       ├── yutori.py     # Yutori reasoning
│   │       ├── openai_client.py  # OpenAI fallback
│   │       ├── senso_client.py   # Senso memory
│   │       ├── neo4j_client.py   # Neo4j repo graph writer
│   │       └── github_client.py  # GitHub REST API
│   ├── alembic/              # DB migrations
│   └── requirements.txt
├── docks/                    # PRD, API reference, contracts
└── README.md
```

## API Quick Reference

```
GET  /api/v1/health                    Health check
GET  /api/v1/health/integrations       All integration status (use for pre-demo test)
POST /api/v1/analysis                  Start new analysis  { "repo_url": "https://..." }
GET  /api/v1/analysis/{id}             Get analysis status + results
GET  /api/v1/analysis/{id}/graph       Get graph nodes + edges
GET  /api/v1/findings/{analysis_id}    Get findings list
GET  /api/v1/fixes/{analysis_id}       Get fix plan
WS   /ws/{analysis_id}                 Real-time progress updates
```

Full API docs at `http://localhost:8000/docs` when running.
