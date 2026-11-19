"""M3.5: an Italian → Polish dictionary built from open data, so most words get a translation without an LLM.

sources.py  what is downloaded, from where, under which license (also shown in the app and the README)
build.py    download + merge + load into Postgres: `python -m app.lexicon.build`
text.py     how a typed word is normalised before lookup (the frontend does the same, web/src/lib/lexicon.ts)
api.py      /api/lexicon/... (lookup, offline bundle for the phone, sources)
"""
