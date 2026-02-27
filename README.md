# VIBE CHECK — Codebase Intelligence Engine

Autonomous multi-agent GitHub repository analyzer. Clones repos, builds knowledge graphs, runs specialist analysis agents, and generates prioritized fix documentation.

## Architecture

| Service    | Tech                          | Port |
|------------|-------------------------------|------|
| Frontend   | Next.js 15 · TypeScript · Tailwind | 3000 |
| Backend    | FastAPI · SQLAlchemy · Alembic     | 8000 |
| Database   | PostgreSQL 16                      | 5432 |

## Quick Start

```bash
# 1. Copy env and fill in your API keys
cp .env.example .env

# 2. Boot everything
docker compose up --build -d

# 3. Verify
#    Frontend:  http://localhost:3000
#    Backend:   http://localhost:8000/api/v1/health
#    Postgres:  localhost:5432
```

## Development

```bash
# Frontend (standalone)
cd frontend && npm install && npm run dev

# Backend (standalone — needs postgres running)
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

# Run migrations
cd backend && alembic upgrade head
```

## Project Structure

```
├── docker-compose.yml
├── .env / .env.example
├── frontend/          # Next.js 15
│   ├── src/app/       # App Router pages
│   └── src/types/     # Shared TypeScript types
├── backend/           # FastAPI
│   ├── app/           # Application code
│   │   ├── main.py    # FastAPI entry point
│   │   ├── models.py  # SQLAlchemy models
│   │   ├── schemas.py # Pydantic schemas
│   │   └── routers/   # API route modules
│   ├── alembic/       # Database migrations
│   └── requirements.txt
└── docks/             # PRD & API documentation
```
