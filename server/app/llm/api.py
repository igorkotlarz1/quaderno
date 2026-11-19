"""/api/llm: "Opracuj lekcję" and "Oceń tydzień" in one click, and the log of what they cost."""

from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_session
from ..models import LlmCall
from ..settings import settings
from . import prompts
from .client import LlmError, call, get_client
from .schemas import LessonFix, WeekAssessment

router = APIRouter(prefix="/api/llm")
Db = Annotated[Session, Depends(get_session)]
Client = Annotated[Any, Depends(get_client)]


def _need(client: Any) -> Any:
    if client is None:
        raise HTTPException(503, "Brak ANTHROPIC_API_KEY na serwerze: użyj promptu ręcznie")
    return client


def call_out(r: LlmCall) -> dict[str, Any]:
    return {
        "at": r.created_at,
        "purpose": r.purpose,
        "model": r.model,
        "status": r.status,
        "input_tokens": r.input_tokens,
        "output_tokens": r.output_tokens,
        "cost_usd": r.cost_usd,
        "duration_ms": r.duration_ms,
    }


@router.get("/status")
def status(db: Db, client: Client) -> dict[str, Any]:
    """Whether one-click works here, and what it has cost so far (today, this month, in total)."""
    now = datetime.now(UTC)

    def spent(since: str | None = None) -> float:
        q = select(func.coalesce(func.sum(LlmCall.cost_usd), 0.0))
        if since:
            q = q.where(LlmCall.created_at >= since)
        return round(float(db.scalar(q) or 0), 6)

    recent = db.scalars(select(LlmCall).order_by(LlmCall.id.desc()).limit(20)).all()
    return {
        "enabled": client is not None,
        "fake": settings.llm_fake,
        "models": {"lesson": settings.llm_lesson_model, "week": settings.llm_week_model},
        "spent_usd": {
            "today": spent(now.strftime("%Y-%m-%d")),
            "month": spent(now.strftime("%Y-%m")),
            "total": spent(),
        },
        "calls": [call_out(r) for r in recent],
    }


@router.post("/lesson")
def lesson(db: Db, client: Client, body: Annotated[dict[str, Any], Body()]) -> dict[str, Any]:
    """Body: one lesson as the app has it. Answer: a patch by id (the app applies it to its current copy)."""
    data = prompts.lesson_input(body)
    if not data["entries"] and not data["verbs"]:
        raise HTTPException(400, "Ta lekcja jest pusta")
    try:
        fix = call(
            _need(client),
            db,
            purpose="lesson",
            model=settings.llm_lesson_model,
            system=prompts.LESSON_SYSTEM,
            message=prompts.lesson_message(data),
            out=LessonFix,
            effort="medium",
            lesson_id=str(body.get("id") or "")[:64] or None,
        )
    except LlmError as e:
        raise HTTPException(e.status_code, e.message) from e
    # Keep only answers for what was sent: a made-up id cannot add rows.
    sent_e = {e["id"] for e in data["entries"]}
    sent_v = {v["id"] for v in data["verbs"]}
    last = db.scalars(select(LlmCall).order_by(LlmCall.id.desc()).limit(1)).first()
    return {
        "entries": [e.model_dump() for e in fix.entries if e.id in sent_e],
        "verbs": [v.model_dump() for v in fix.verbs if v.id in sent_v],
        "call": call_out(last) if last else None,
    }


@router.post("/week")
def week(db: Db, client: Client, body: Annotated[dict[str, Any], Body()]) -> dict[str, Any]:
    """Body: the week payload the app builds (lib/level.ts weekPayload). Answer: a level assessment."""
    try:
        a = call(
            _need(client),
            db,
            purpose="week",
            model=settings.llm_week_model,
            system=prompts.WEEK_SYSTEM,
            message=prompts.week_message(body),
            out=WeekAssessment,
            effort="high",
        )
    except LlmError as e:
        raise HTTPException(e.status_code, e.message) from e
    last = db.scalars(select(LlmCall).order_by(LlmCall.id.desc()).limit(1)).first()
    assessment = {
        "type": "level_assessment",
        "week_start": body.get("week_start"),
        "week_end": body.get("week_end"),
        **a.model_dump(),
        "progress": max(0, min(100, a.progress)),
        "model": last.model if last else settings.llm_week_model,
    }
    return {"assessment": assessment, "call": call_out(last) if last else None}
