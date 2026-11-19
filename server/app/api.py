from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_session
from .models import Assessment, Entry, Lesson, Verb
from .schemas import AssessmentIn, EntryIn, LessonIn, StateOut, VerbIn

router = APIRouter(prefix="/api")
Db = Annotated[Session, Depends(get_session)]

ENTRY_COLS = ("it", "pl", "kind", "pl_source", "pos", "lemma", "it_original", "it_suggestion", "created_at")
VERB_COLS = ("it", "pl", "tense", "forms", "forms_source", "confidence", "revealed", "created_at")


def _drop_none(d: dict[str, Any], keep: tuple[str, ...]) -> dict[str, Any]:
    """Optional LLM fields (pos, lemma, ...) are left out when empty, like in the frontend export."""
    return {k: v for k, v in d.items() if v is not None or k in keep}


def lesson_out(lesson: Lesson) -> dict[str, Any]:
    return {
        "id": lesson.id,
        "date": lesson.date,
        "title": lesson.title or "",
        "source": lesson.source,
        "created_at": lesson.created_at,
        "updated_at": lesson.updated_at,
        "entries": [
            _drop_none(
                {"id": e.id, **{c: getattr(e, c) for c in ENTRY_COLS}, **(e.extra or {})},
                keep=("it", "pl", "pl_source"),
            )
            for e in lesson.entries
        ],
        "verbs": [
            _drop_none(
                {"id": v.id, **{c: getattr(v, c) for c in VERB_COLS}, **(v.extra or {})}, keep=("pl", "forms")
            )
            for v in lesson.verbs
        ],
        **({"summary": lesson.summary} if lesson.summary is not None else {}),
        **({"notes": lesson.notes} if lesson.notes is not None else {}),
    }


def _entry_row(e: EntryIn, i: int) -> Entry:
    return Entry(id=e.id, position=i, **{c: getattr(e, c) for c in ENTRY_COLS}, extra=e.model_extra or {})


def _verb_row(v: VerbIn, i: int) -> Verb:
    return Verb(id=v.id, position=i, **{c: getattr(v, c) for c in VERB_COLS}, extra=v.model_extra or {})


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/state", response_model=StateOut)
def get_state(db: Db) -> StateOut:
    lessons = db.scalars(select(Lesson).order_by(Lesson.date, Lesson.created_at)).all()
    assessments = db.scalars(select(Assessment).order_by(Assessment.week_end)).all()
    return StateOut(
        lessons=[lesson_out(x) for x in lessons if not x.deleted_at],
        assessments=[a.data for a in assessments],
        deleted=[x.id for x in lessons if x.deleted_at],
    )


@router.put("/lessons/{lesson_id}")
def put_lesson(lesson_id: str, body: LessonIn, db: Db) -> dict[str, Any]:
    """Upsert a whole lesson. Last write wins by `updated_at`; an older copy gets the stored one back."""
    lesson = db.get(Lesson, lesson_id)
    if lesson and (lesson.deleted_at or lesson.updated_at > body.updated_at):
        return {"applied": False, "lesson": None if lesson.deleted_at else lesson_out(lesson)}
    if lesson is None:
        lesson = Lesson(id=lesson_id)
        db.add(lesson)
    lesson.date, lesson.title, lesson.source = body.date, body.title or "", body.source
    lesson.created_at, lesson.updated_at = body.created_at, body.updated_at
    lesson.summary, lesson.notes = body.summary, body.notes
    # Entries and verbs are replaced as a whole; ids are kept, so this is cheap at lesson size.
    lesson.entries.clear()
    lesson.verbs.clear()
    db.flush()
    lesson.entries.extend(_entry_row(e, i) for i, e in enumerate(body.entries))
    lesson.verbs.extend(_verb_row(v, i) for i, v in enumerate(body.verbs))
    db.commit()
    return {"applied": True, "lesson": lesson_out(lesson)}


@router.delete("/lessons/{lesson_id}")
def delete_lesson(lesson_id: str, db: Db) -> dict[str, bool]:
    lesson = db.get(Lesson, lesson_id)
    now = datetime.now(UTC).isoformat()
    if lesson is None:
        lesson = Lesson(id=lesson_id, created_at=now, updated_at=now)
        db.add(lesson)
    lesson.deleted_at = now
    lesson.entries.clear()
    lesson.verbs.clear()
    db.commit()
    return {"deleted": True}


@router.put("/assessments/{assessment_id}")
def put_assessment(assessment_id: str, body: AssessmentIn, db: Db) -> dict[str, Any]:
    a = db.get(Assessment, assessment_id) or Assessment(id=assessment_id)
    a.week_end, a.level, a.progress, a.assessed_at = (
        body.week_end,
        body.level,
        body.progress,
        body.assessed_at,
    )
    a.data = body.model_dump()
    a.updated_at = datetime.now(UTC)
    db.add(a)
    db.commit()
    return {"applied": True}
