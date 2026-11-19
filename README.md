# Quaderno

A personal app for learning Italian, built step by step as a testbed for an AI tutoring platform.
During a lesson you type Italian → Polish pairs fast; after the lesson an LLM fills the gaps, fixes accents,
conjugates the verbs the app is unsure about and estimates your CEFR level (A1 → B1) every week.

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Milestones M1–M8: [docs/MILESTONES.md](docs/MILESTONES.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)

## How to run

On the server (the OptiPlex), everything runs in Docker Compose; step by step in Polish: [docs/runbook/m2.md](docs/runbook/m2.md).

```bash
cp .env.example .env            # set POSTGRES_PASSWORD
docker compose up -d --build    # db (Postgres 17 + pgvector), api (FastAPI, serves the app), backup (nightly)
curl -s localhost:8000/api/health
```

Development:

```bash
# API (Python 3.12, uv)
cd server
uv sync
uv run pytest                   # SQLite by default; TEST_DATABASE_URL=postgresql+psycopg://... for Postgres
uv run uvicorn app.main:app --reload    # http://127.0.0.1:8000, needs DATABASE_URL or uses a local SQLite file

# Web app (Node 22)
cd web
npm ci
npm run dev                     # http://localhost:5173, /api is proxied to :8000
npm test                        # unit tests (Vitest)
npm run e2e                     # gate M1 (Playwright, vite preview)
npm run e2e:server              # gate M2, against an EMPTY compose stack
```

Without a server the web app works on localStorage alone, as in M1.
`legacy/quaderno.html` is the original single-file app (no data inside); gate M1 compares the new app with it.
Step-by-step checks for each milestone, in Polish: [docs/runbook](docs/runbook). Milestone logs: [docs/log](docs/log).

## Repository rules

This repo is public. Secrets live only in `.env` (ignored); `.env.example` lists the keys with empty values.
Real lesson data never goes into the repo; tests use made-up fixtures.
