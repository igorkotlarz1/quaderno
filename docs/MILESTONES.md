# Milestones

One pebble at a time: each milestone ends with something that works on a real lesson.
Status: `todo` · `in progress` · `done (date, PR)`.

| M | Goal | Done when | Status |
|---|------|-----------|--------|
| M1 | Quadernote in React + Vite + TS, logic 1:1 with the Artifact (entry, NULLs, verbs with reveal, accents, level bar, prompts) | importing the current JSON export (schema_version 1) shows the same view as the Artifact; conjugation and import tests are green | done (2026-11-19, #1) |
| M2 | FastAPI + Postgres 17 (pgvector) in Docker Compose on the OptiPlex, Tailscale, pg_dump + restic → B2 | phone and laptop see the same lesson; a test restore of the backup works | done (2026-11-19, #3) |
| M3 | Offline-first PWA: IndexedDB (Dexie) + sync with the API | a lesson typed in airplane mode is saved and syncs when the network is back | done (2026-11-19, #6) |
| M3.5 | Offline Italian→Polish dictionary from open data (frequency list + Morph-it! + Wikisłownik) in Postgres, top ~5000 lemmas in IndexedDB; suggestions under a row, "Uzupełnij ze słownika", credits in the app and README | a word from the top 5000 typed in airplane mode gets a Polish suggestion without the API; the prompt for Claude only carries what the dictionary does not know | in progress |
| M4 | "Opracuj lekcję" via Claude API: accents, NULLs, pos/lemma, only verbs marked "do sprawdzenia"; weekly level via API; `llm_calls` table | one click instead of the manual prompt; cost of every call in the log | todo |
| M5 | FSRS reviews (`srs_cards`, `reviews`), 2–3 exercise types | the app picks what to review every day | todo |
| M6 | Notebook OCR (Opus vision) + review screen + merge | photo of a page → checked words in the lesson | todo |
| M7 | Voice: STT (faster-whisper on CPU), "repeat after me" pronunciation score | the app scores the pronunciation of a single word | todo |
| M8 | Embeddings (bge-m3, pgvector), semantic search, accounts (second user), interface language switch PL ⇄ EN for a wider audience | semantic search works; a second user has separate data and can use the app in English | todo |

M1–M5 go in order (M3.5 is a small step between M3 and M4: it makes M4 cheaper). M6–M8 can be reordered by what hurts most in lessons.

## Out of scope / later

- Merging edits of the same lesson made at the same time on two devices (now: last write wins): M3 if it hurts.
- English interface (PL ⇄ EN switch): M8, long after the working MVP; until then all UI strings stay Polish. Keep new strings in components easy to move into one dictionary later.
- Push notifications and background sync while the app is closed: later; M3 syncs when the app is opened or the network comes back.
- Dictionary: senses ranked by context ("sono" = jestem vs. dźwięczę), example sentences (Tatoeba, CC BY 2.0 FR), phrases: later, maybe with M8 embeddings. Serving the dictionary to other users (M8) keeps the CC BY-SA credits and share-alike terms.
- Login / accounts: M8. Until then access is limited by Tailscale only.
- Splitting the CSS into per-component files: only if it starts to hurt.
