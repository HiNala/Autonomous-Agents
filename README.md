# Autonomix — Codebase Intelligence Engine

> Built at the **Autonomous Agents Hackathon** · AWS Builder Loft, San Francisco · Feb 27, 2026

Autonomous multi-agent GitHub repository analyzer. Paste a repo URL, watch 6 AI agents clone it, walk every file, build a live Neo4j knowledge graph, surface vulnerabilities and code quality issues, and produce a prioritized fix plan — all in under a minute.

---

## Hackathon Context

**Event:** Autonomous Agents Hackathon — Creators Corner  
**Date:** Friday, February 27, 2026 · 9:30 AM – 7:30 PM  
**Venue:** AWS Builder Loft · 525 Market St, San Francisco, CA  
**Prize Pool:** $47k+

**Sponsors powering this project:**

| Sponsor | Role in Autonomix |
|---------|-------------------|
| **Neo4j** | Knowledge graph — every file, function, CVE, and relationship lives here |
| **Fastino Labs** | Primary fast classification & entity extraction via GLiNER-2 REST API |
| **Yutori** | Primary deep web research & vulnerability intelligence |
| **OpenAI** | Active fallback for Fastino/Yutori + deep code reasoning via GPT-4o |
| **Tavily** | Fast CVE search & NVD/GitHub Advisory lookups |
| **AWS** | Builder Loft hosting + infrastructure inspiration |
| **Render** | Deployment target |

---

## What It Does

1. **Paste any public GitHub URL** → agents clone the repo instantly
2. **Mapper agent** walks every file, builds a live Neo4j graph (nodes stream to UI in real-time)
3. **Quality agent** analyzes code smells, dead code, complexity — Fastino fast scan → OpenAI deep pass
4. **Security agent** runs Tavily CVE search + Yutori vulnerability research
5. **Pattern agent** detects architectural anti-patterns and best practice violations
6. **Doctor agent** generates a prioritized fix plan with before/after code examples
7. **Health score** computed: letter grade + breakdown across 5 dimensions

The whole pipeline is **live-streamed over WebSocket** — you watch nodes appear in the graph and findings trickle in as the agents work.

---

## Architecture

| Service    | Tech                                    | Port  |
|------------|-----------------------------------------|-------|
| Frontend   | Next.js 16 · TypeScript · Zustand       | 3000  |
| Backend    | FastAPI · SQLAlchemy · Alembic · Asyncio | 8000  |
| Database   | PostgreSQL 16                           | 5432  |
| Graph DB   | Neo4j 5 Community (Docker)              | 7474/7687 |

---

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env
# Fill in your API keys (OpenAI alone is enough for a full run)

# 2. Boot everything
docker compose up --build -d

# 3. Open the app
open http://localhost:3000

# 4. Verify all integrations
curl http://localhost:8000/api/v1/health/integrations
```

### Service URLs

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Frontend app |
| `http://localhost:8000/docs` | Backend Swagger UI |
| `http://localhost:8000/api/v1/health` | Health check |
| `http://localhost:8000/api/v1/health/integrations` | Integration status (pre-demo test) |
| `http://localhost:7474` | Neo4j Browser UI |

---

## Sponsor Integrations

| Integration | Purpose | Status |
|-------------|---------|--------|
| **Neo4j** | Knowledge graph (local Docker — no external key) | ✅ Active |
| **Fastino** | Primary: fast classification & entity extraction | ✅ Wired — key activates full speed |
| **Yutori** | Primary: deep web research & reasoning | ✅ Wired — key activates research agents |
| **OpenAI** | Active fallback + deep reasoning (GPT-4o) | ✅ Active |
| **Tavily** | CVE search & web intelligence | ✅ Active |
| **PostgreSQL** | Primary relational store | ✅ Active |
| **GitHub API** | Repo metadata & rate limit boost | ⚙️ Optional |

**Fallback architecture:** Fastino and Yutori are the intended primaries. When their keys aren't set, OpenAI handles those tasks automatically — the system runs completely with only an OpenAI key. Activate Fastino/Yutori keys to get 99x faster classification and live web research.

---

## Environment Variables

```bash
# Required — OpenAI alone gives you a full working system
OPENAI_API_KEY=sk-proj-...     # platform.openai.com

# Sponsor primaries — activate for full speed + features
FASTINO_API_KEY=pio_sk_...     # fastino.ai — 99x faster classification
YUTORI_API_KEY=yt_...          # platform.yutori.com — deep web research
TAVILY_API_KEY=tvly-...        # app.tavily.com — CVE search

# Optional
GITHUB_TOKEN=ghp_...           # higher rate limits + private repos

# Neo4j — runs in Docker, no cloud account needed
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=vibecheck_neo4j

# Auto-configured for Docker (do not change)
POSTGRES_USER=vibecheck
POSTGRES_PASSWORD=vibecheck_secret
POSTGRES_DB=vibecheck
```

---

## Neo4j Local Setup

Neo4j runs inside Docker Compose — **no separate install required**.

```
URI (inside Docker):  bolt://neo4j:7687
URI (from host):      bolt://localhost:7687
Browser UI:           http://localhost:7474
Username:             neo4j
Password:             vibecheck_neo4j
```

On first boot the backend auto-initializes: indexes, constraints, and schema. Browse your graph at `http://localhost:7474`:

```cypher
-- All node types
MATCH (n) RETURN labels(n), count(n) ORDER BY count(n) DESC LIMIT 20

-- File graph for a specific analysis
MATCH (f:File {analysisId: "your-id"}) RETURN f LIMIT 50
```

---

## Project Structure

```
├── docker-compose.yml
├── .env / .env.example
├── frontend/                       # Next.js 16 App Router
│   └── src/
│       ├── app/                    # Pages (/, /analysis/[id])
│       ├── components/
│       │   ├── graph/              # GraphPanel, GraphCanvas (Cytoscape.js)
│       │   ├── findings/           # FindingsPanel, FindingDetail
│       │   ├── score/              # HealthScoreHero, ScoreBreakdown
│       │   ├── progress/           # AnalysisProgress, ActivityFeed (live agent feed)
│       │   └── layout/             # AppShell, SponsorFooter, TopBar
│       ├── stores/                 # Zustand (analysisStore)
│       └── hooks/                  # useAnalysisWebSocket
├── backend/
│   └── app/
│       ├── routers/                # analysis, findings, fixes, graph, health
│       ├── services/
│       │   ├── pipeline.py         # 6-agent analysis pipeline
│       │   └── neo4j.py            # Graph writes, schema init, blast radius
│       ├── clients/
│       │   ├── fastino.py          # Fastino GLiNER-2 (primary)
│       │   ├── yutori.py           # Yutori research (primary)
│       │   ├── openai_client.py    # OpenAI fallback + deep reasoning
│       │   ├── tavily_client.py    # CVE search
│       │   └── neo4j_client.py     # Graph writer
│       └── agents/
│           └── orchestrator.py     # High-level analysis orchestrator
├── docks/                          # PRD, API reference, contracts, design
└── README.md
```

---

## API Quick Reference

```
GET  /api/v1/health                   Health check
GET  /api/v1/health/integrations      All sponsor integration status
POST /api/v1/analysis                 Start analysis  { "repo_url": "https://..." }
GET  /api/v1/analysis/{id}            Status + results
GET  /api/v1/analysis/{id}/graph      Graph nodes + edges
GET  /api/v1/findings/{id}            Findings list
GET  /api/v1/fixes/{id}               Fix plan
WS   /ws/{id}                         Real-time WebSocket stream
```

Full docs at `http://localhost:8000/docs` when running.

---

## Development (without Docker)

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend (needs postgres + neo4j via docker)
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# DB migrations only
cd backend && alembic upgrade head

# Just spin up dependencies
docker compose up postgres neo4j -d
```

---

*Built with ❤️ at Creators Corner · Autonomous Agents Hackathon · San Francisco 2026*
