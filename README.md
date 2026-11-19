# Quaderno

A personal app for learning Italian, built step by step as a testbed for an AI tutoring platform.
During a lesson you type Italian → Polish pairs fast; after the lesson an LLM fills the gaps, fixes accents,
conjugates the verbs the app is unsure about and estimates your CEFR level (A1 → B1) every week.

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Milestones M1–M8: [docs/MILESTONES.md](docs/MILESTONES.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)

## Repository rules

This repo is public. Secrets live only in `.env` (ignored); `.env.example` lists the keys with empty values.
Real lesson data never goes into the repo; tests use made-up fixtures.
