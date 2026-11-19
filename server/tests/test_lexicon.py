"""M3.5 dictionary: building from (tiny, hand-written) source files and the /api/lexicon endpoints.
The fixtures in tests/fixtures/lexicon imitate the real formats; the real data is downloaded on the server."""

from pathlib import Path

import pytest

from app.lexicon import build
from app.lexicon.text import accent_key, normalize

FIX = Path(__file__).parent / "fixtures" / "lexicon"


@pytest.mark.parametrize(
    ("typed", "expected"),
    [
        ("  La Finestra! ", "finestra"),
        ("l’amico", "amico"),
        ("un'amica", "amica"),
        ("po'", "po'"),
        ("la", "la"),
        ("Gli occhi", "occhi"),
        ("perché?", "perché"),
        ("essere sano di mente", "essere sano di mente"),
    ],
)
def test_normalize(typed, expected):
    assert normalize(typed) == expected


def test_accent_key():
    assert accent_key("perché") == "perche"
    assert accent_key("città") == "citta"


def test_clean_gloss():
    assert build.clean_gloss("(rysunek) plan, rzut poziomy") == {
        "gloss": "plan, rzut poziomy",
        "note": "rysunek",
    }
    assert build.clean_gloss("dziękuję [1]") == {"gloss": "dziękuję"}
    assert build.clean_gloss("zob. tavola") is None


def built():
    lines = lambda name, enc="utf-8": build.read_lines(FIX / name, enc)  # noqa: E731
    freq = build.read_frequency(lines("it_50k.txt"))
    morph = build.read_morphit(lines("morph-it_048.txt", "latin-1"))
    entries, form_of = build.read_wiktionary(lines("wiktionary.jsonl"))
    return build.merge(freq, morph, entries, form_of), entries, form_of


def test_wiktionary_reading():
    _, entries, form_of = built()
    assert "casa" not in entries  # not an Italian entry
    assert "sono" not in entries and form_of["sono"] == {"essere"}  # a form, not a meaning
    assert [s["gloss"] for s in entries["piano"][0].senses] == [
        "piętro",
        "plan, rzut poziomy",
        "fortepian",
    ]  # by sense number
    assert [s["gloss"] for s in entries["tavolo"][0].senses] == ["stół"]  # "zob." dropped


def test_merge_ranks_and_forms():
    b, _, _ = built()
    by = {(r["lemma"], r["pos"]): r for r in b.lemmas}
    # essere gets è and most of "sono" (sonare is rare on its own), so it outranks everything but "la".
    assert by[("essere", "verb")]["rank"] < by[("sonare", "verb")]["rank"]
    assert by[("essere", "verb")]["freq"] > 2559257
    forms = {f for f, _ in by[("finestra", "noun")]["forms"]}
    assert {"finestra", "finestre"} <= forms
    assert {f for f, _ in by[("parlare", "verb")]["forms"]} >= {"parlo", "parla", "parlare"}
    # "piano" is a noun and an adverb: both rows share one rank.
    assert by[("piano", "noun")]["rank"] == by[("piano", "adv")]["rank"]
    assert 0 < b.coverage[100] <= 1


@pytest.fixture()
def loaded(client):
    from app import db as dbmod
    from app.main import app

    session = next(app.dependency_overrides[dbmod.get_session]())
    meta = build.build_from(FIX, session, log=lambda *_: None)
    session.close()
    return client, meta


def test_empty_dictionary(client):
    assert client.get("/api/lexicon/meta").json() == {"loaded": False}
    assert client.get("/api/lexicon/bundle").status_code == 204
    assert client.get("/api/lexicon/lookup", params={"q": "finestra"}).json()["results"] == []


def test_lookup(loaded):
    client, _ = loaded
    r = client.get("/api/lexicon/lookup", params={"q": "Le finestre"}).json()
    assert r["query"] == "finestre"
    assert [x["lemma"] for x in r["results"]] == ["finestra"]
    assert r["results"][0]["senses"][0]["gloss"] == "okno"
    # Without the accent, and a form that belongs to two lemmas.
    assert [x["lemma"] for x in client.get("/api/lexicon/lookup", params={"q": "e"}).json()["results"]] == [
        "essere"
    ]
    sono = client.get("/api/lexicon/lookup", params={"q": "sono"}).json()["results"]
    assert [x["lemma"] for x in sono] == ["essere", "sonare"]


def test_bundle_and_meta(loaded):
    client, meta = loaded
    res = client.get("/api/lexicon/bundle", params={"top": 100})
    b = res.json()
    assert b["version"] == meta["version"]
    lemmas = [row[0] for row in b["lemmas"]]
    assert lemmas.index("essere") < lemmas.index("sonare")
    assert b["lemmas"][b["forms"]["finestre"][0]][3] == ["okno"]
    assert {s["id"] for s in b["sources"]} == {"frequencywords", "morphit", "plwiktionary"}
    assert all(s["license"] for s in b["sources"])
    # Same version again: 304, the phone keeps its copy.
    again = client.get(
        "/api/lexicon/bundle", params={"top": 100}, headers={"If-None-Match": res.headers["etag"]}
    )
    assert again.status_code == 304
    m = client.get("/api/lexicon/meta").json()
    assert (
        m["loaded"] and m["stats"]["lemmas"] == 8
    )  # finestra parlare essere sonare piano ciao tavolo grazie


def test_fetch_refuses_a_changed_file(tmp_path, monkeypatch):
    src = build.sources.FREQUENCY
    (tmp_path / build.FILES[src.id]).write_text("not the real list 1\n")
    with pytest.raises(SystemExit, match="changed"):
        build.fetch(src, tmp_path)
    assert not (tmp_path / build.FILES[src.id]).exists()
