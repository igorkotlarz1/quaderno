"""Tables from docs/ARCHITECTURE.md. The frontend JSON (schema_version 1) maps onto them 1:1;
fields we don't have a column for yet land in `extra`, so nothing the LLM adds is lost."""

from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, JsonType


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    date: Mapped[str | None] = mapped_column(String(10), index=True)  # YYYY-MM-DD, as in the frontend
    title: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(16), default="live")  # live / text / ocr / import
    created_at: Mapped[str] = mapped_column(String(40))
    updated_at: Mapped[str] = mapped_column(String(40), index=True)  # ISO time; last write wins
    deleted_at: Mapped[str | None] = mapped_column(String(40))  # tombstone, so other devices drop it too
    summary: Mapped[dict | None] = mapped_column(JsonType)
    notes: Mapped[dict | None] = mapped_column(JsonType)

    entries: Mapped[list["Entry"]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan", order_by="Entry.position"
    )
    verbs: Mapped[list["Verb"]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan", order_by="Verb.position"
    )


class Entry(Base):
    __tablename__ = "entries"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    it: Mapped[str | None] = mapped_column(Text)
    pl: Mapped[str | None] = mapped_column(Text)  # NULL = no translation yet
    kind: Mapped[str] = mapped_column(String(8), default="word")
    pl_source: Mapped[str | None] = mapped_column(String(8))
    pos: Mapped[str | None] = mapped_column(String(16))
    lemma: Mapped[str | None] = mapped_column(Text)
    it_original: Mapped[str | None] = mapped_column(Text)
    it_suggestion: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str | None] = mapped_column(String(40))
    extra: Mapped[dict] = mapped_column(JsonType, default=dict)

    lesson: Mapped[Lesson] = relationship(back_populates="entries")


class Verb(Base):
    __tablename__ = "verbs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    lesson_id: Mapped[str] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    it: Mapped[str] = mapped_column(Text)
    pl: Mapped[str | None] = mapped_column(Text)
    tense: Mapped[str] = mapped_column(String(16), default="presente")
    forms: Mapped[dict | None] = mapped_column(JsonType)
    forms_source: Mapped[str | None] = mapped_column(String(8))
    confidence: Mapped[str | None] = mapped_column(String(8))
    revealed: Mapped[dict] = mapped_column(JsonType, default=dict)
    created_at: Mapped[str | None] = mapped_column(String(40))
    extra: Mapped[dict] = mapped_column(JsonType, default=dict)

    lesson: Mapped[Lesson] = relationship(back_populates="verbs")


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    week_end: Mapped[str] = mapped_column(String(10), index=True)
    level: Mapped[str] = mapped_column(String(4))
    progress: Mapped[int] = mapped_column(Integer)
    assessed_at: Mapped[str | None] = mapped_column(String(40))
    data: Mapped[dict] = mapped_column(JsonType)  # the whole assessment object as the frontend has it
    updated_at: Mapped[datetime | None] = mapped_column()
