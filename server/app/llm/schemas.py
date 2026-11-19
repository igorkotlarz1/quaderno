"""What Claude has to return. Every field is required (null when there is nothing to say), which is what
structured outputs need; the JSON schema sent to the API is generated from these classes."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---- lesson: a patch, not a whole lesson, so edits made while Claude works are not overwritten


class EntryFix(Strict):
    id: str
    it: str | None  # corrected Italian (accents only); null = unchanged
    it_suggestion: str | None  # other typo, suggested but not applied
    pl: str | None  # translation, only for entries whose "pl" was null
    kind: Literal["word", "phrase"]
    pos: Literal["noun", "verb", "adj", "adv", "other"] | None  # null for phrases
    lemma: str | None


class Forms(Strict):
    io: str
    tu: str
    lui: str
    noi: str
    voi: str
    loro: str


class VerbFix(Strict):
    id: str
    pl: str | None  # meaning, only when it was null
    forms: Forms  # presente indicativo


class LessonFix(Strict):
    entries: list[EntryFix]
    verbs: list[VerbFix]


# ---- weekly level


class Evidence(Strict):
    words: int
    phrases: int
    verbs: int


class WeekAssessment(Strict):
    level: Literal["A1", "A1+", "A2", "A2+", "B1"]
    progress: int  # 0–100, way from `level` to the next one
    confidence: Literal["low", "medium", "high"]
    summary_pl: str
    can_do: list[str]
    gaps: list[str]
    next_week: list[str]
    evidence: Evidence


def json_schema(model: type[BaseModel]) -> dict[str, Any]:
    """Pydantic's schema with every $ref written out in place and titles dropped: a plain, self-contained
    schema for output_config.format."""
    raw = model.model_json_schema()
    defs = raw.pop("$defs", {})

    def inline(node: Any) -> Any:
        if isinstance(node, dict):
            if "$ref" in node:
                return inline(defs[node["$ref"].rsplit("/", 1)[-1]])
            return {k: inline(v) for k, v in node.items() if k != "title"}
        if isinstance(node, list):
            return [inline(x) for x in node]
        return node

    return inline(raw)
