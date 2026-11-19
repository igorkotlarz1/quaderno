# Quaderno

A personal app for learning Italian, built step by step as a testbed for an AI tutoring platform.
During a lesson you type Italian → Polish pairs fast; after the lesson an LLM fills the gaps, fixes accents,
conjugates the verbs the app is unsure about and estimates your CEFR level (A1 → B1) every week.

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Milestones M1–M8: [docs/MILESTONES.md](docs/MILESTONES.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)

## How to run

```bash
cd web
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run e2e        # gate test (Playwright)
```

`legacy/quaderno.html` is the original single-file app (no data inside); the gate test compares the new app with it.
Step-by-step checks for each milestone, in Polish: [docs/runbook](docs/runbook).

## Repository rules

This repo is public. Secrets live only in `.env` (ignored); `.env.example` lists the keys with empty values.
Real lesson data never goes into the repo; tests use made-up fixtures.
