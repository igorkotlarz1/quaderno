"""/api/lexicon: dictionary lookups and the offline bundle the phone keeps in IndexedDB."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import LexForm, LexLemma, LexMeta
from .text import accent_key, normalize

router = APIRouter(prefix="/api/lexicon")
Db = Annotated[Session, Depends(get_session)]
MAX_BUNDLE = 20000


def info(db: Session) -> dict | None:
    row = db.get(LexMeta, "info")
    return row.value if row else None


def lemma_out(r: LexLemma) -> dict[str, Any]:
    return {"lemma": r.lemma, "pos": r.pos, "rank": r.rank, "senses": r.senses, "tags": r.tags}


@router.get("/meta")
def meta(db: Db) -> dict:
    """What is loaded and where it comes from (for "Źródła słownika" in the app)."""
    m = info(db)
    return {"loaded": False} if m is None else {"loaded": True, **m}


@router.get("/lookup")
def lookup(db: Db, q: Annotated[str, Query(min_length=1, max_length=120)]) -> dict:
    """All lemmas a typed word can belong to, most frequent first.
    Exact spelling first, then without accents."""
    word = normalize(q)
    ids = db.scalars(select(LexForm.lemma_id).where(LexForm.form == word)).all()
    if not ids:
        ids = db.scalars(select(LexForm.lemma_id).where(LexForm.key == accent_key(word))).all()
    rows = (
        db.scalars(
            select(LexLemma).where(LexLemma.id.in_(set(ids))).order_by(LexLemma.rank, LexLemma.id)
        ).all()
        if ids
        else []
    )
    return {"query": word, "results": [lemma_out(r) for r in rows]}


@router.get("/bundle")
def bundle(
    db: Db,
    response: Response,
    top: Annotated[int, Query(ge=100, le=MAX_BUNDLE)] = 5000,
    if_none_match: Annotated[str | None, Header()] = None,
) -> Any:
    """The `top` most frequent lemmas with their forms, compact, for offline use on the phone.

    Shape: {version, top, lemmas: [[lemma, pos, rank, [gloss, ...]]],
            forms: {form: [lemma index, ...]}, sources}.
    Only forms seen in the frequency list (plus each lemma itself) are included, which keeps it small.
    """
    m = info(db)
    if m is None:
        return Response(status_code=204)
    etag = f'"{m["version"]}-{top}"'
    if if_none_match == etag:
        return Response(status_code=304, headers={"ETag": etag})
    rows = db.scalars(select(LexLemma).where(LexLemma.rank <= top).order_by(LexLemma.rank, LexLemma.id)).all()
    index = {r.id: i for i, r in enumerate(rows)}
    forms: dict[str, list[int]] = {}
    if index:
        q = select(LexForm.form, LexForm.lemma_id, LexForm.freq).where(LexForm.lemma_id.in_(list(index)))
        lemma_of = {r.id: r.lemma for r in rows}
        for form, lemma_id, freq in db.execute(q):
            if freq > 0 or form == lemma_of[lemma_id]:
                forms.setdefault(form, []).append(index[lemma_id])
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "no-cache"
    return {
        "version": m["version"],
        "built_at": m["built_at"],
        "top": top,
        "lemmas": [[r.lemma, r.pos, r.rank, [s["gloss"] for s in r.senses]] for r in rows],
        "forms": forms,
        "sources": [
            {k: s[k] for k in ("id", "name", "authors", "license", "license_url", "homepage")}
            for s in m["sources"]
        ],
    }
