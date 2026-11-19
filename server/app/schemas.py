"""Request/response shapes. They mirror web/src/lib/types.ts; unknown fields are kept (extra="allow")."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class EntryIn(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    it: str | None = None
    pl: str | None = None
    kind: str = "word"
    pl_source: str | None = None
    pos: str | None = None
    lemma: str | None = None
    it_original: str | None = None
    it_suggestion: str | None = None
    created_at: str | None = None


class VerbIn(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    it: str
    pl: str | None = None
    tense: str = "presente"
    forms: dict[str, str] | None = None
    forms_source: str | None = None
    confidence: str | None = None
    revealed: dict[str, bool] = Field(default_factory=dict)
    created_at: str | None = None


class LessonIn(BaseModel):
    id: str
    date: str | None = None
    title: str | None = ""
    source: str = "live"
    created_at: str
    updated_at: str
    entries: list[EntryIn] = Field(default_factory=list)
    verbs: list[VerbIn] = Field(default_factory=list)
    summary: Any = None
    notes: Any = None


class AssessmentIn(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    week_end: str
    level: str
    progress: int
    assessed_at: str | None = None


class StateOut(BaseModel):
    lessons: list[dict[str, Any]]
    assessments: list[dict[str, Any]]
    deleted: list[str]  # lesson ids deleted on another device
