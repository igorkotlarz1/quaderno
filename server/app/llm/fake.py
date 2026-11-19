"""A stand-in for the Claude API with the same call shape, for the gate test and CI (LLM_FAKE=1).
It answers from a few hard-coded rules, so a test knows exactly what to expect.
It never runs with a real key."""

import json
import re
from types import SimpleNamespace
from typing import Any

ACCENTS = {"perche": "perché", "citta": "città", "caffe'": "caffè", "piu": "più", "e": "è"}
WORDS = {"il cane": "pies", "la casa": "dom", "grazie": "dziękuję", "il capibara": "kapibara"}
VERBS = {"andare": ["vado", "vai", "va", "andiamo", "andate", "vanno"]}
PEOPLE = ("io", "tu", "lui", "noi", "voi", "loro")


def _regular(inf: str) -> list[str]:
    stem, end = inf[:-3], inf[-3:]
    table = {
        "are": ["o", "i", "a", "iamo", "ate", "ano"],
        "ere": ["o", "i", "e", "iamo", "ete", "ono"],
        "ire": ["o", "i", "e", "iamo", "ite", "ono"],
    }
    return [stem + s for s in table.get(end, ["?"] * 6)]


def _lesson(data: dict[str, Any]) -> dict[str, Any]:
    entries = []
    for e in data["entries"]:
        it = e.get("it") or ""
        fixed = ACCENTS.get(it)
        phrase = " " in it.strip() and it not in WORDS
        entries.append(
            {
                "id": e["id"],
                "it": fixed,
                "it_suggestion": None,
                "pl": None if e.get("pl") else WORDS.get(it, f"[{it}]"),
                "kind": "phrase" if phrase else "word",
                "pos": None if phrase else "noun",
                "lemma": None if phrase else it,
            }
        )
    verbs = [
        {
            "id": v["id"],
            "pl": None if v.get("pl") else "(znaczenie)",
            "forms": dict(zip(PEOPLE, VERBS.get(v["it"], _regular(v["it"])), strict=True)),
        }
        for v in data["verbs"]
    ]
    return {"entries": entries, "verbs": verbs}


def _week(_: dict[str, Any]) -> dict[str, Any]:
    return {
        "level": "A1",
        "progress": 40,
        "confidence": "low",
        "summary_pl": "Ocena testowa (LLM_FAKE).",
        "can_do": ["test"],
        "gaps": ["test"],
        "next_week": ["test"],
        "evidence": {"words": 0, "phrases": 0, "verbs": 0},
    }


class _Messages:
    def create(self, **params: Any) -> SimpleNamespace:
        text = params["messages"][0]["content"]
        data = json.loads(re.search(r"\{.*\}", text, re.S).group(0))
        answer = _lesson(data) if "entries" in data and "week_start" not in data else _week(data)
        return SimpleNamespace(
            model=params["model"],
            _request_id="req_fake",
            stop_reason="end_turn",
            stop_details=None,
            content=[SimpleNamespace(type="text", text=json.dumps(answer, ensure_ascii=False))],
            usage=SimpleNamespace(
                input_tokens=len(text) // 3 + 900,
                output_tokens=len(json.dumps(answer)) // 3,
                cache_read_input_tokens=0,
                cache_creation_input_tokens=0,
            ),
        )


class FakeClient:
    def __init__(self) -> None:
        self.messages = _Messages()
        self.beta = SimpleNamespace(messages=_Messages())
