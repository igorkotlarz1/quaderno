"""Builds the dictionary: frequency list × lemmas × Polish meanings → lex_* tables.

    python -m app.lexicon.build                 # download the sources (cache in LEXICON_CACHE) and load
    python -m app.lexicon.build --from DIR      # use files already in DIR
                                                # (it_50k.txt, morph-it_048.txt, wiktionary.jsonl)

Method (also in the README, "Słownik"):
1. Every Italian entry of Wikisłownik with at least one real meaning becomes a lemma row; senses that only say
   "form of X" are not meanings, they become form → lemma links instead.
2. Morph-it! maps each inflected form to its lemma (finestre → finestra). A form that could be two lemmas
   (sono → essere / sonare) is split between them in proportion to how common each lemma is on its own.
3. A lemma's frequency is the sum of the subtitle counts of all its forms; rank 1 = most frequent.
4. Glosses are cleaned (qualifiers like "(rysunek)" become notes), never rewritten or invented.
"""

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.request
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import delete, insert
from sqlalchemy.orm import Session

from ..models import LexForm, LexLemma, LexMeta
from . import sources
from .text import accent_key

FILES = {"frequencywords": "it_50k.txt", "morphit": "morph-it_048.txt", "plwiktionary": "wiktionary.jsonl"}
MAX_SENSES = 6
COVERAGE_AT = (100, 500, 1000, 2000, 5000)

# Morph-it! tags → the part-of-speech names Wiktionary (wiktextract) uses.
MORPHIT_POS = {
    "NOUN": "noun",
    "VER": "verb",
    "AUX": "verb",
    "MOD": "verb",
    "CAU": "verb",
    "ADJ": "adj",
    "ADV": "adv",
    "ART": "article",
    "ARTPRE": "prep",
    "PRE": "prep",
    "CON": "conj",
    "INT": "intj",
    "NUM": "num",
    "PRO": "pron",
    "DET": "pron",
    "WH": "pron",
    "TALE": "pron",
    "CE": "pron",
    "CI": "pron",
    "NE": "pron",
    "SI": "pron",
}


@dataclass
class Entry:
    lemma: str
    pos: str
    senses: list[dict]
    tags: list[str] = field(default_factory=list)


# ---------------------------------------------------------------- reading the sources


def read_frequency(lines: Iterable[str]) -> dict[str, int]:
    """'finestra 12345' per line → {'finestra': 12345} (forms lower-cased, counts summed)."""
    out: dict[str, int] = defaultdict(int)
    for line in lines:
        parts = line.strip().rsplit(" ", 1)
        if len(parts) == 2 and parts[1].isdigit():
            out[parts[0].lower()] += int(parts[1])
    return dict(out)


def read_morphit(lines: Iterable[str]) -> dict[str, set[tuple[str, str]]]:
    """'finestre<TAB>finestra<TAB>NOUN-F:p' → {'finestre': {('finestra', 'noun')}}."""
    out: dict[str, set[tuple[str, str]]] = defaultdict(set)
    for line in lines:
        parts = line.rstrip("\n").split("\t")
        if len(parts) < 3:
            continue
        form, lemma, tag = parts[0].lower(), parts[1].lower(), parts[2]
        pos = MORPHIT_POS.get(re.split(r"[-:]", tag, maxsplit=1)[0], "other")
        out[form].add((lemma, pos))
    return dict(out)


QUALIFIER = re.compile(r"^\(([^)]{1,40})\)\s*")
FOOTNOTE = re.compile(r"\s*\[\d+\]")


def clean_gloss(raw: str) -> dict | None:
    """'(rysunek) plan, rzut poziomy' → {'gloss': 'plan, rzut poziomy', 'note': 'rysunek'}.
    References ("zob. ...") are dropped."""
    g = FOOTNOTE.sub("", raw).strip()
    g = re.sub(r"\s+", " ", g)
    note = None
    m = QUALIFIER.match(g)
    if m:
        note, g = m.group(1), g[m.end() :]
    g = g.strip(" ;,")
    if not g or g.lower().startswith(("zob.", "zobacz", "por.")):
        return None
    out = {"gloss": g}
    if note:
        out["note"] = note
    return out


def read_wiktionary(lines: Iterable[str]) -> tuple[dict[str, list[Entry]], dict[str, set[str]]]:
    """kaikki.org JSONL → ({lemma: [Entry per part of speech]}, {inflected form: {lemma}})."""
    entries: dict[str, list[Entry]] = defaultdict(list)
    form_of: dict[str, set[str]] = defaultdict(set)
    for line in lines:
        if not line.strip():
            continue
        rec = json.loads(line)
        if rec.get("lang_code") != "it" or not rec.get("word"):
            continue
        word = rec["word"].strip().lower()
        senses, seen = [], set()
        for s in sorted(rec.get("senses", []), key=lambda s: _sense_order(s.get("sense_index", ""))):
            targets = [
                f.get("word", "").lower() for f in s.get("form_of", []) + s.get("alt_of", []) if f.get("word")
            ]
            if targets:
                form_of[word].update(targets)
                continue
            for raw in s.get("glosses", [])[:1]:
                g = clean_gloss(raw)
                if g and g["gloss"] not in seen:
                    seen.add(g["gloss"])
                    tags = [t for t in s.get("tags", []) + s.get("topics", []) if t]
                    senses.append({**g, **({"tags": tags} if tags else {})})
        if senses:
            entries[word].append(
                Entry(word, rec.get("pos") or "other", senses[:MAX_SENSES], rec.get("tags", []))
            )
    return dict(entries), dict(form_of)


def _sense_order(index: str) -> tuple:
    return tuple(int(p) if p.isdigit() else 0 for p in re.split(r"[.]", index or "0"))


# ---------------------------------------------------------------- merging


@dataclass
class Built:
    lemmas: list[dict]  # rows for lex_lemmas, rank order; "forms": [(form, freq)]
    coverage: dict[int, float]  # share of corpus tokens covered by the top N lemmas
    stats: dict


def merge(
    freq: dict[str, int],
    morph: dict[str, set[tuple[str, str]]],
    entries: dict[str, list[Entry]],
    form_of: dict[str, set[str]],
) -> Built:
    known = set(entries)

    # Which lemmas (with a Polish meaning) can each form belong to, and with which part of speech.
    cands: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    for form, pairs in morph.items():
        for lemma, pos in pairs:
            if lemma in known:
                cands[form][lemma].add(pos)
    for form, lemmas in form_of.items():
        for lemma in lemmas:
            if lemma in known:
                cands[form][lemma]  # noqa: B018 - creates the key: any part of speech
    for lemma in known:
        cands[lemma][lemma]

    # Pass 1: unambiguous forms only. Pass 2: split ambiguous forms by the pass-1 weight of each lemma.
    base: dict[str, float] = defaultdict(float)
    for form, lemmas in cands.items():
        if len(lemmas) == 1:
            base[next(iter(lemmas))] += freq.get(form, 0)
    score: dict[str, float] = defaultdict(float, base)
    for form, lemmas in cands.items():
        if len(lemmas) > 1 and freq.get(form):
            weights = {lm: base.get(lm, 0) + 1 for lm in lemmas}
            total = sum(weights.values())
            for lm, w in weights.items():
                score[lm] += freq[form] * w / total

    order = sorted(known, key=lambda lm: (-score.get(lm, 0), lm))
    rank = {lm: i + 1 for i, lm in enumerate(order)}

    forms_by_lemma: dict[str, list[tuple[str, int, set[str]]]] = defaultdict(list)
    for form, lemmas in cands.items():
        for lm, poses in lemmas.items():
            forms_by_lemma[lm].append((form, freq.get(form, 0), poses))

    rows = []
    for lm in order:
        for e in entries[lm]:
            # A form links to this part of speech when Morph-it! agrees, or when it gives no part of speech.
            fs = sorted(
                {(f, n) for f, n, poses in forms_by_lemma[lm] if not poses or e.pos in poses or f == lm},
                key=lambda x: (-x[1], x[0]),
            )
            rows.append(
                {
                    "lemma": lm,
                    "pos": e.pos,
                    "rank": rank[lm],
                    "freq": round(score.get(lm, 0)),
                    "senses": e.senses,
                    "tags": e.tags,
                    "forms": fs,
                }
            )

    total = sum(freq.values()) or 1
    covered_by_rank: dict[int, float] = defaultdict(float)
    for form, n in freq.items():
        lemmas = cands.get(form)
        if lemmas:
            covered_by_rank[min(rank[lm] for lm in lemmas)] += n
    coverage, acc, ranks = {}, 0.0, sorted(covered_by_rank)
    i = 0
    for top in COVERAGE_AT:
        while i < len(ranks) and ranks[i] <= top:
            acc += covered_by_rank[ranks[i]]
            i += 1
        coverage[top] = round(acc / total, 4)
    stats = {
        "lemmas": len(order),
        "rows": len(rows),
        "forms": sum(len(r["forms"]) for r in rows),
        "corpus_tokens": total,
        "forms_in_corpus": len(freq),
    }
    return Built(rows, coverage, stats)


# ---------------------------------------------------------------- loading into the database


def load(session: Session, built: Built, used: list[dict]) -> dict:
    """Replace the whole dictionary in one transaction (the app keeps the old one until this commits)."""
    session.execute(delete(LexForm))
    session.execute(delete(LexLemma))
    session.execute(delete(LexMeta))
    form_rows = []
    for i, r in enumerate(built.lemmas, start=1):
        r["id"] = i
        for f, n in r["forms"]:
            form_rows.append({"form": f, "key": accent_key(f), "lemma_id": i, "freq": n})
    lemma_rows = [
        {k: r[k] for k in ("id", "lemma", "pos", "rank", "freq", "senses", "tags")} for r in built.lemmas
    ]
    for chunk in _chunks(lemma_rows, 5000):
        session.execute(insert(LexLemma), chunk)
    for chunk in _chunks(form_rows, 10000):
        session.execute(insert(LexForm), chunk)
    digest = hashlib.sha256("".join(u["sha256"] for u in used).encode()).hexdigest()[:12]
    meta = {
        "version": digest,
        "built_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "stats": built.stats,
        "coverage": {str(k): v for k, v in built.coverage.items()},
        "sources": used,
    }
    session.add(LexMeta(key="info", value=meta))
    session.commit()
    return meta


def _chunks(rows: list, n: int):
    for i in range(0, len(rows), n):
        yield rows[i : i + n]


# ---------------------------------------------------------------- downloading


def fetch(src: sources.Source, cache: Path) -> Path:
    """Download once into the cache; check the pinned hash so a changed file is never used silently."""
    path = cache / FILES[src.id]
    if not path.exists():
        cache.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".part")
        req = urllib.request.Request(src.url, headers={"User-Agent": "quadernote-lexicon-build"})
        with urllib.request.urlopen(req, timeout=120) as res, open(tmp, "wb") as out:
            while chunk := res.read(1 << 20):
                out.write(chunk)
        tmp.rename(path)
    sha = sha256_of(path)
    if src.sha256 and sha != src.sha256:
        path.unlink()
        raise SystemExit(
            f"{src.id}: downloaded file changed (sha256 {sha}, expected {src.sha256}). Not using it."
        )
    return path


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return h.hexdigest()


def read_lines(path: Path, encoding: str) -> Iterable[str]:
    with open(path, encoding=encoding, errors="replace") as f:
        yield from f


def build_from(folder: Path, session: Session, log=print) -> dict:
    used, data = [], {}
    for src in sources.ALL:
        path = folder / FILES[src.id]
        if not path.exists():
            raise SystemExit(f"missing {path}")
        used.append({**src.public(), "sha256": sha256_of(path), "file": path.name})
        data[src.id] = path
    log("reading frequency list, Morph-it!, Wiktionary…")
    freq = read_frequency(read_lines(data["frequencywords"], sources.FREQUENCY.encoding))
    morph = read_morphit(read_lines(data["morphit"], sources.MORPHIT.encoding))
    entries, form_of = read_wiktionary(read_lines(data["plwiktionary"], sources.WIKTIONARY.encoding))
    built = merge(freq, morph, entries, form_of)
    meta = load(session, built, used)
    cov = ", ".join(f"top {k}: {v:.0%}" for k, v in built.coverage.items())
    log(
        f"lexicon {meta['version']}: {built.stats['lemmas']} lemmas, "
        f"{built.stats['forms']} forms; coverage {cov}"
    )
    return meta


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument(
        "--from", dest="folder", type=Path, help="use files already in this folder, download nothing"
    )
    args = ap.parse_args(argv)
    folder = args.folder
    if folder is None:
        folder = Path(os.environ.get("LEXICON_CACHE", "/tmp/quadernote-lexicon"))
        for src in sources.ALL:
            print(f"downloading {src.name}…", flush=True)
            fetch(src, folder)
    from ..db import SessionLocal

    with SessionLocal() as session:
        build_from(folder, session)


if __name__ == "__main__":
    main(sys.argv[1:])
