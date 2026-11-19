"""Instructions for Claude, in Polish like the rest of the learner-facing text. Ported from
web/src/lib/prompts.ts (the manual flow keeps those). The system prompts never change between calls;
the lesson or week data goes in the user message."""

import json
from typing import Any

LESSON_SYSTEM = """Jesteś asystentem do nauki włoskiego. Uczeń jest na poziomie A1 i notuje słówka na żywo podczas lekcji konwersacji, \
bez włoskiej klawiatury. Dostajesz JSON jednej lekcji: pozycje ("entries") i czasowniki do sprawdzenia ("verbs").

Dla KAŻDEJ pozycji z "entries" zwróć jeden obiekt z tym samym "id":
- "it": poprawiony włoski TYLKO gdy brakuje akcentu albo jest akcent zastępczy (caffe' → caffè, citta → città, perche → perché, \
piu → più, puo → può, gia → già, e` → è, "e" jako czasownik być → "è"). Zostaw prawdziwe apostrofy elizji (po', l'amico, un'amica). \
Gdy nic nie zmieniasz, wpisz null.
- "it_suggestion": inna literówka niż akcent (np. "finestar" → "finestra"); nie poprawiaj jej w "it". Gdy brak, null.
- "pl": polskie tłumaczenie TYLKO dla pozycji, które mają "pl": null. Dla pozostałych null (nie zmieniamy tego, co uczeń wpisał). \
Pozycje z "pl_source": "dict" mają tłumaczenie z automatycznego słownika: zwróć dla nich poprawione "pl" tylko wtedy, \
gdy wyraźnie nie pasuje do włoskiego, inaczej null.
- "kind": "word" (słowo lub krótkie wyrażenie) albo "phrase" (zdanie).
- "pos" i "lemma" dla słów: część mowy (noun, verb, adj, adv, other) i forma słownikowa; rzeczowniki z rodzajnikiem \
(np. "la casa"). Dla zdań oba null.

Dla KAŻDEGO czasownika z "verbs" zwróć "forms" w czasie presente indicativo (io, tu, lui/lei, noi, voi, loro) z poprawnymi akcentami \
i "pl" (znaczenie po polsku) tylko wtedy, gdy było null; inaczej null.

Nie dodawaj i nie pomijaj pozycji ani czasowników."""

WEEK_SYSTEM = """Jesteś egzaminatorem języka włoskiego i oceniasz postęp ucznia według skali CEFR. Uczeń ma jedną lekcję konwersacji \
tygodniowo i notuje słówka w aplikacji. Dostajesz dane z ostatniego tygodnia, statystyki całości i poprzednią ocenę.

Oszacuj obecny poziom na skali: A1, A1+, A2, A2+, B1.
Zasady:
- Oceniaj ostrożnie i tylko na podstawie danych: zakres słownictwa, rodzaj tematów, czy uczeń notuje całe zdania \
(np. przeczenia, pytania), ile czasowników i form zna, poprawność włoskiego w notatkach, jego uwagi.
- Liczba słówek sama w sobie nie podnosi poziomu; liczy się, co uczeń potrafi z nimi zrobić (deskryptory CEFR „potrafię…”).
- Zmiana o więcej niż jeden stopień w tydzień tylko przy bardzo mocnych dowodach.
- "progress" to procent drogi od obecnego poziomu do następnego (0–100); może też spaść, jeśli dane tego wymagają.
- Pisz po polsku, do ucznia (na „ty”), konkretnie, z przykładami z jego słówek. "summary_pl": 2–3 zdania; "can_do": 3–5 punktów; \
"gaps": 2–4 punkty; "next_week": 2–4 konkretne zadania; "evidence": ile słów, zdań i czasowników z tego tygodnia wziąłeś pod uwagę."""


def needs_check(verb: dict[str, Any]) -> bool:
    """Same rule as the manual prompt: the app conjugates regular verbs and ~40 irregular ones itself."""
    if not verb.get("forms"):
        return True
    return verb.get("confidence") == "check" and verb.get("forms_source") not in ("llm", "user")


def lesson_input(lesson: dict[str, Any]) -> dict[str, Any]:
    """Only what Claude needs: no ids of other lessons, no dates, no reveal state."""
    return {
        "entries": [
            {k: e.get(k) for k in ("id", "it", "pl", "kind", "pl_source")}
            for e in lesson.get("entries", [])
            if e.get("it") or e.get("pl")
        ],
        "verbs": [
            {"id": v["id"], "it": v["it"], "pl": v.get("pl")}
            for v in lesson.get("verbs", [])
            if needs_check(v)
        ],
    }


def lesson_message(data: dict[str, Any]) -> str:
    nulls = sum(1 for e in data["entries"] if e["it"] and not e["pl"])
    return (
        f"Pozycji bez tłumaczenia: {nulls}. Czasowników do sprawdzenia: {len(data['verbs'])}.\n\n"
        + json.dumps(data, ensure_ascii=False, indent=1)
    )


def week_message(payload: dict[str, Any]) -> str:
    since = (payload.get("totals") or {}).get("first_lesson") or "niedawna"
    return (
        f"Uczę się od {since}. Dane z tygodnia {payload.get('week_start')} – {payload.get('week_end')}:\n\n"
        + json.dumps(payload, ensure_ascii=False, indent=1)
    )
