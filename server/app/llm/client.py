"""One Claude API call: request with a JSON schema, checks, cost,
and a row in llm_calls (also when it fails)."""

import time
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any

import anthropic
from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from ..models import LlmCall
from ..settings import settings
from .cost import cost_usd
from .schemas import json_schema

# Models whose refusals the API can hand over to another model by itself (server-side fallback, beta).
# Haiku has no server-side fallback; a refusal there just ends as an error.
FALLBACK_BETA = "server-side-fallback-2026-07-01"
WITH_FALLBACK = ("claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5")


class LlmError(Exception):
    """A failed call, with a message for the app (Polish) and the HTTP status the API answers with."""

    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


@lru_cache(maxsize=1)
def _real_client(key: str) -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=key, timeout=180.0, max_retries=2)


def get_client() -> Any | None:
    """FastAPI dependency: the API client, the fake one (LLM_FAKE=1), or None when no key is set."""
    if settings.llm_fake:
        from .fake import FakeClient

        return FakeClient()
    if not settings.anthropic_api_key:
        return None
    return _real_client(settings.anthropic_api_key)


def _usage(u: Any) -> dict[str, int]:
    return {
        "input_tokens": getattr(u, "input_tokens", 0) or 0,
        "output_tokens": getattr(u, "output_tokens", 0) or 0,
        "cache_read_tokens": getattr(u, "cache_read_input_tokens", 0) or 0,
        "cache_write_tokens": getattr(u, "cache_creation_input_tokens", 0) or 0,
    }


def call[T: BaseModel](
    client: Any,
    db: Session,
    *,
    purpose: str,
    model: str,
    system: str,
    message: str,
    out: type[T],
    effort: str,
    lesson_id: str | None = None,
) -> T:
    """Ask Claude for an answer shaped like `out`. Every call is logged, successful or not."""
    row = LlmCall(
        created_at=datetime.now(UTC).isoformat(timespec="seconds"),
        purpose=purpose,
        model=model,
        lesson_id=lesson_id,
        status="error",
    )
    started = time.monotonic()
    params: dict[str, Any] = {
        "model": model,
        "max_tokens": 16000,
        "system": system,
        "messages": [{"role": "user", "content": message}],
        "output_config": {"effort": effort, "format": {"type": "json_schema", "schema": json_schema(out)}},
    }
    try:
        if model in WITH_FALLBACK:
            resp = client.beta.messages.create(**params, betas=[FALLBACK_BETA], fallbacks="default")
        else:
            resp = client.messages.create(**params)
    except anthropic.APIStatusError as e:
        row.error = f"{e.status_code}: {e.message}"[:2000]
        _save(db, row, started)
        if e.status_code == 401:
            raise LlmError(502, "Serwer ma zły klucz ANTHROPIC_API_KEY") from e
        if e.status_code == 429:
            raise LlmError(503, "Limit zapytań Claude API, spróbuj za minutę") from e
        raise LlmError(502, f"Claude API odpowiedziało błędem {e.status_code}") from e
    except anthropic.APIConnectionError as e:
        row.error = str(e)[:2000]
        _save(db, row, started)
        raise LlmError(503, "Serwer nie może połączyć się z Claude API") from e

    row.model = getattr(resp, "model", model) or model
    row.request_id = getattr(resp, "_request_id", None)
    for k, v in _usage(resp.usage).items():
        setattr(row, k, v)
    row.cost_usd = cost_usd(
        row.model, row.input_tokens, row.output_tokens, row.cache_read_tokens, row.cache_write_tokens
    )

    if resp.stop_reason == "refusal":
        row.status = "refusal"
        details = getattr(resp, "stop_details", None)
        row.error = f"refusal: {getattr(details, 'category', None)}"
        _save(db, row, started)
        raise LlmError(502, "Claude odmówił odpowiedzi na tę lekcję")
    if resp.stop_reason == "max_tokens":
        row.error = "max_tokens"
        _save(db, row, started)
        raise LlmError(502, "Odpowiedź Claude była za długa i została ucięta")

    text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
    try:
        result = out.model_validate_json(text)
    except ValidationError as e:
        row.error = f"invalid answer: {e.error_count()} errors"
        _save(db, row, started)
        raise LlmError(502, "Claude zwrócił odpowiedź w złym formacie") from e
    row.status = "ok"
    _save(db, row, started)
    return result


def _save(db: Session, row: LlmCall, started: float) -> None:
    row.duration_ms = int((time.monotonic() - started) * 1000)
    db.add(row)
    db.commit()
