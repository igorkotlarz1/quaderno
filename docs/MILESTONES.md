# Milestones

One pebble at a time: each milestone ends with something that works on a real lesson.
Status: `todo` · `in progress` · `done (date, PR)`.

| M | Goal | Done when | Status |
|---|------|-----------|--------|
| M1 | Quaderno in React + Vite + TS, logic 1:1 with the Artifact (entry, NULLs, verbs with reveal, accents, level bar, prompts) | importing the current JSON export (schema_version 1) shows the same view as the Artifact; conjugation and import tests are green | done (2026-11-19, #1) |
| M2 | FastAPI + Postgres 17 (pgvector) in Docker Compose on the OptiPlex, Tailscale, pg_dump + restic → B2 | phone and laptop see the same lesson; a test restore of the backup works | in progress |
| M3 | Offline-first PWA: IndexedDB (Dexie) + sync with the API | a lesson typed in airplane mode is saved and syncs when the network is back | todo |
| M4 | "Opracuj lekcję" via Claude API: accents, NULLs, pos/lemma, only verbs marked "do sprawdzenia"; weekly level via API; `llm_calls` table | one click instead of the manual prompt; cost of every call in the log | todo |
| M5 | FSRS reviews (`srs_cards`, `reviews`), 2–3 exercise types | the app picks what to review every day | todo |
| M6 | Notebook OCR (Opus vision) + review screen + merge | photo of a page → checked words in the lesson | todo |
| M7 | Voice: STT (faster-whisper on CPU), "repeat after me" pronunciation score | the app scores the pronunciation of a single word | todo |
| M8 | Embeddings (bge-m3, pgvector), semantic search, accounts (second user) | semantic search works; a second user has separate data | todo |

M1–M5 go in order. M6–M8 can be reordered by what hurts most in lessons.

## Out of scope / later

- PWA manifest and service worker: M3 (offline-first), not M1.
- Merging edits of the same lesson made at the same time on two devices (now: last write wins): M3 if it hurts.
- Login / accounts: M8. Until then access is limited by Tailscale only.
- Splitting the CSS into per-component files: only if it starts to hurt.
