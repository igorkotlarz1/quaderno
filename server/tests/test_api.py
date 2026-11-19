"""Made-up data only (public repo)."""


def lesson(id="l1", updated="2026-11-19T10:00:00.000Z", **kw):
    base = {
        "id": id,
        "date": "2026-11-19",
        "title": "",
        "source": "live",
        "created_at": "2026-11-19T09:00:00.000Z",
        "updated_at": updated,
        "entries": [
            {"id": "e1", "it": "la casa", "pl": "dom", "kind": "word", "pl_source": "user"},
            {"id": "e2", "it": "il gatto", "pl": None, "kind": "word", "pl_source": None, "pos": "noun"},
        ],
        "verbs": [
            {
                "id": "v1",
                "it": "parlare",
                "pl": "mówić",
                "tense": "presente",
                "forms": {"io": "parlo"},
                "forms_source": "auto",
                "confidence": "high",
                "revealed": {"io": True},
            }
        ],
    }
    base.update(kw)
    return base


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_put_and_get_roundtrip(client):
    r = client.put("/api/lessons/l1", json=lesson())
    assert r.json()["applied"] is True
    state = client.get("/api/state").json()
    assert len(state["lessons"]) == 1
    got = state["lessons"][0]
    assert [e["it"] for e in got["entries"]] == ["la casa", "il gatto"]
    assert got["entries"][1]["pl"] is None  # NULL stays NULL
    assert got["entries"][1]["pos"] == "noun"
    assert "lemma" not in got["entries"][0]  # empty optional fields are left out
    assert got["verbs"][0]["revealed"] == {"io": True}


def test_unknown_fields_are_kept(client):
    body = lesson()
    body["entries"][0]["gender"] = "f"
    client.put("/api/lessons/l1", json=body)
    got = client.get("/api/state").json()["lessons"][0]
    assert got["entries"][0]["gender"] == "f"


def test_last_write_wins(client):
    client.put("/api/lessons/l1", json=lesson(updated="2026-11-19T10:00:00.000Z", title="nuovo"))
    r = client.put("/api/lessons/l1", json=lesson(updated="2026-11-19T09:30:00.000Z", title="vecchio"))
    assert r.json()["applied"] is False
    assert r.json()["lesson"]["title"] == "nuovo"
    assert client.get("/api/state").json()["lessons"][0]["title"] == "nuovo"


def test_update_replaces_rows(client):
    client.put("/api/lessons/l1", json=lesson())
    body = lesson(updated="2026-11-19T11:00:00.000Z")
    body["entries"] = [{"id": "e2", "it": "il gatto", "pl": "kot", "pl_source": "user"}]
    client.put("/api/lessons/l1", json=body)
    got = client.get("/api/state").json()["lessons"][0]
    assert [(e["id"], e["pl"]) for e in got["entries"]] == [("e2", "kot")]


def test_delete_is_a_tombstone(client):
    client.put("/api/lessons/l1", json=lesson())
    client.delete("/api/lessons/l1")
    state = client.get("/api/state").json()
    assert state["lessons"] == [] and state["deleted"] == ["l1"]
    # an old device pushing the deleted lesson does not bring it back
    r = client.put("/api/lessons/l1", json=lesson(updated="2099-01-01T00:00:00.000Z"))
    assert r.json()["applied"] is False


def test_assessments(client):
    a = {"id": "a1", "week_end": "2026-11-22", "level": "A1", "progress": 40, "summary_pl": "Dobrze."}
    client.put("/api/assessments/a1", json=a)
    client.put("/api/assessments/a1", json={**a, "progress": 45})
    got = client.get("/api/state").json()["assessments"]
    assert len(got) == 1 and got[0]["progress"] == 45 and got[0]["summary_pl"] == "Dobrze."
