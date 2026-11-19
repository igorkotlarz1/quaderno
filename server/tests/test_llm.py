"""M4: Claude API calls. No test talks to the real API: they use the fake client (app/llm/fake.py)
or small stubs that imitate an answer, a refusal or a network error. Made-up words only."""

import json
from types import SimpleNamespace

import anthropic
import httpx
import pytest

from app.llm import client as llm_client
from app.llm.cost import cost_usd
from app.llm.fake import FakeClient
from app.llm.schemas import LessonFix, WeekAssessment, json_schema

LESSON = {
    "id": "lesson-1",
    "entries": [
        {"id": "e1", "it": "perche", "pl": "dlaczego", "kind": "word", "pl_source": "user"},
        {"id": "e2", "it": "il cane", "pl": None, "kind": "word", "pl_source": None},
        {"id": "e3", "it": None, "pl": None, "kind": "word", "pl_source": None},  # empty row: not sent
    ],
    "verbs": [
        {
            "id": "v1",
            "it": "parlare",
            "pl": "mówić",
            "forms": {"io": "parlo"},
            "forms_source": "auto",
            "confidence": "high",
        },
        {"id": "v2", "it": "andare", "pl": None, "forms": None, "forms_source": None, "confidence": None},
    ],
}


def use(client_obj):
    from app.main import app

    app.dependency_overrides[llm_client.get_client] = lambda: client_obj


def test_cost():
    assert cost_usd("claude-haiku-5-5", 1_000_000, 0) == pytest.approx(0.10)
    assert cost_usd("claude-sonnet-5-5", 1000, 1000) == pytest.approx(0.012)
    assert cost_usd("some-new-model", 1_000_000, 0) == pytest.approx(4.0)  # unknown: costed high, never free


@pytest.mark.parametrize("model", [LessonFix, WeekAssessment])
def test_schema_is_strict_and_self_contained(model):
    schema = json_schema(model)
    text = json.dumps(schema)
    assert "$ref" not in text and "$defs" not in text

    def walk(node):
        if isinstance(node, dict):
            if node.get("type") == "object":
                assert node["additionalProperties"] is False
                assert set(node["required"]) == set(node["properties"])
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(schema)


def test_without_key_the_app_keeps_the_manual_prompt(client):
    use(None)
    s = client.get("/api/llm/status").json()
    assert s["enabled"] is False and s["spent_usd"]["total"] == 0
    r = client.post("/api/llm/lesson", json=LESSON)
    assert r.status_code == 503 and "ANTHROPIC_API_KEY" in r.json()["detail"]


def test_lesson_one_click_and_cost_logged(client):
    use(FakeClient())
    r = client.post("/api/llm/lesson", json=LESSON)
    assert r.status_code == 200, r.text
    fix = r.json()
    by = {e["id"]: e for e in fix["entries"]}
    assert set(by) == {"e1", "e2"}  # the empty row was not sent
    assert by["e1"]["it"] == "perché" and by["e1"]["pl"] is None  # accent fixed, user's translation kept
    assert by["e2"]["pl"] == "pies"
    # Only the verb the app could not conjugate goes to Claude.
    assert [v["id"] for v in fix["verbs"]] == ["v2"]
    assert fix["verbs"][0]["forms"]["loro"] == "vanno"
    assert fix["call"]["purpose"] == "lesson" and fix["call"]["cost_usd"] > 0

    s = client.get("/api/llm/status").json()
    assert s["enabled"] and len(s["calls"]) == 1
    assert s["calls"][0]["model"] == "claude-haiku-5-5" and s["calls"][0]["status"] == "ok"
    assert s["spent_usd"]["today"] == s["spent_usd"]["total"] == fix["call"]["cost_usd"]


def test_week_assessment(client):
    use(FakeClient())
    payload = {"week_start": "2026-11-13", "week_end": "2026-11-19", "totals": {}, "lessons_this_week": []}
    r = client.post("/api/llm/week", json=payload).json()
    a = r["assessment"]
    assert a["type"] == "level_assessment" and a["level"] == "A1" and a["week_end"] == "2026-11-19"
    assert r["call"]["model"] == "claude-sonnet-5-5"


class Stub:
    """Records what was sent and answers with `answer` (or raises `error`)."""

    def __init__(self, answer=None, error=None, stop="end_turn"):
        self.sent = []
        self.answer, self.error, self.stop = answer, error, stop
        self.messages = SimpleNamespace(create=self._create("messages"))
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create("beta")))

    def _create(self, path):
        def create(**params):
            self.sent.append((path, params))
            if self.error:
                raise self.error
            return SimpleNamespace(
                model=params["model"],
                _request_id="req_x",
                stop_reason=self.stop,
                stop_details=SimpleNamespace(category="cyber") if self.stop == "refusal" else None,
                content=[SimpleNamespace(type="text", text=json.dumps(self.answer or {}))],
                usage=SimpleNamespace(
                    input_tokens=1000,
                    output_tokens=200,
                    cache_read_input_tokens=0,
                    cache_creation_input_tokens=0,
                ),
            )

        return create


def test_request_shape(client):
    """Haiku: plain call with a JSON schema. Sonnet (weekly): beta call with server-side fallback."""
    stub = Stub(answer={"entries": [], "verbs": []})
    use(stub)
    client.post("/api/llm/lesson", json=LESSON)
    path, p = stub.sent[0]
    assert path == "messages" and p["model"] == "claude-haiku-5-5"
    assert p["output_config"]["format"]["type"] == "json_schema" and p["output_config"]["effort"] == "medium"
    assert "thinking" not in p and "temperature" not in p

    stub.answer = (
        FakeClient()
        .messages.create(
            model="x", messages=[{"role": "user", "content": json.dumps({"week_start": "a", "x": 1})}]
        )
        .content[0]
        .text
    )
    stub.answer = json.loads(stub.answer)
    client.post("/api/llm/week", json={"week_start": "a", "week_end": "b"})
    path, p = stub.sent[1]
    assert path == "beta" and p["model"] == "claude-sonnet-5-5"
    assert p["fallbacks"] == "default" and p["betas"] == ["server-side-fallback-2026-07-01"]


def test_made_up_ids_are_dropped(client):
    use(
        Stub(
            answer={
                "entries": [
                    {
                        "id": "zzz",
                        "it": None,
                        "it_suggestion": None,
                        "pl": "x",
                        "kind": "word",
                        "pos": None,
                        "lemma": None,
                    }
                ],
                "verbs": [],
            }
        )
    )
    assert client.post("/api/llm/lesson", json=LESSON).json()["entries"] == []


@pytest.mark.parametrize(
    ("stub", "status", "logged"),
    [
        (Stub(answer={}, stop="refusal"), 502, "refusal"),
        (Stub(answer={"entries": "nope"}), 502, "error"),
        (Stub(error=anthropic.APIConnectionError(request=httpx.Request("POST", "https://x"))), 503, "error"),
    ],
)
def test_failures_are_logged(client, stub, status, logged):
    use(stub)
    r = client.post("/api/llm/lesson", json=LESSON)
    assert r.status_code == status and r.json()["detail"]
    calls = client.get("/api/llm/status").json()["calls"]
    assert calls[0]["status"] == logged
