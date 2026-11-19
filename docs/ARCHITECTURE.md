# Architecture

Full reasoning (in Polish): Claude Doc "Quaderno – architektura i milestony".

| Area | Choice | Why |
|------|--------|-----|
| Database | PostgreSQL 17 + pgvector | Relational core (lessons → entries → reviews); JSONB for flexible LLM output; vectors for search. One database instead of three. |
| Backend | Python 3.12 + FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, uv | Best AI and audio libraries are in Python. |
| Frontend | React + Vite + TypeScript, installable PWA | Works offline during the lesson; same logic as the original single-file app. |
| Offline data | IndexedDB (Dexie) + sync with the API | Wi-Fi can fail, typing must always work. |
| LLM | Claude API: Haiku 5.5 (cheap fixes), Sonnet 5.5 (synthesis, quizzes, weekly level), Opus 5.5 (notebook photos) | No GPU at home; API cost at this scale is small. Regular verbs are conjugated locally. |
| Embeddings | bge-m3 locally, batch after the lesson | Thousands of short texts, CPU is enough. |
| Hosting | Dell OptiPlex 7050 Micro (Core i5 vPro, ~16 GB RAM), Ubuntu Server 24.04, Docker Compose | Own hardware, runs 24/7. |
| Access | Tailscale | No open ports; private network. |
| Backups | nightly pg_dump + restic to Backblaze B2 | Home is a single point of failure. |

```
phone / laptop (PWA + IndexedDB)
        │  Tailscale, HTTPS
        ▼
OptiPlex ── FastAPI ── Postgres + pgvector
   │            │
   │            └── Claude API (only the server knows the key)
   ├── audio worker (faster-whisper)
   ├── embeddings (bge-m3)
   └── nightly pg_dump + restic ──► Backblaze B2
```
