import { lessonOut } from "./model";
import type { weekPayload } from "./level";
import type { Lesson } from "./types";

// Prompts copied 1:1 from the single-file app. From M4 they are sent by the server instead of by hand.

/** Lesson JSON for the manual "Uzupełnij z Claude" step. Only verbs the app cannot conjugate for sure are sent. */
export function lessonPrompt(lesson: Lesson): string {
  const l = lessonOut(lesson);
  const nulls = l.entries.filter((e) => e.it && !e.pl).length;
  l.verbs = l.verbs.filter((v) => !v.forms || (v.confidence === "check" && v.forms_source !== "llm" && v.forms_source !== "user"));
  const vcheck = l.verbs.length;
  return `Jesteś moim asystentem do nauki włoskiego (poziom A1, uczę się ok. miesiąca).
Poniżej JSON z jednej lekcji. Zadania:
1. Akcenty: na lekcji piszę bez włoskiej klawiatury. Popraw bezpośrednio w polu "it" brakujące lub zastępcze akcenty (np. caffe' → caffè, citta → città, perche → perché, piu → più, puo → può, gia → già, e\` → è, "e" jako czasownik być → "è"). Zostaw prawdziwe apostrofy elizji (po', l'amico, un'amica). Gdy coś zmieniasz, zapisz poprzednią wersję w "it_original". Inne literówki niż akcenty: nie zmieniaj "it", tylko dodaj "it_suggestion".
2. Dla każdej pozycji z "pl": null wpisz polskie tłumaczenie i ustaw "pl_source": "llm".
3. Popraw "kind" ("word" albo "phrase"), a dla słów dodaj "pos" (noun, verb, adj, adv, other) i "lemma" (forma słownikowa; dla rzeczowników z rodzajnikiem, np. "la casa").
4. W tablicy "verbs" są tylko czasowniki, których aplikacja nie odmieniła na pewno (pozostałe zostają w aplikacji, nie dopisuj ich). Dla każdego wpisz "forms" w czasie presente indicativo dla osób io, tu, lui (lui/lei), noi, voi, loro, z poprawnymi akcentami, uzupełnij "pl" (znaczenie), jeśli jest null, i ustaw "forms_source": "llm". Pola "revealed" nie zmieniaj.
5. Nie zmieniaj pól "id", "date", nie usuwaj pozycji.
Zwróć WYŁĄCZNIE poprawny JSON lekcji (bez komentarza), żebym mógł go wkleić z powrotem do aplikacji.
Pozycji bez tłumaczenia: ${nulls}. Czasowników do sprawdzenia: ${vcheck}.

${JSON.stringify(l,null,2)}`;
}

/** Weekly CEFR estimate prompt. */
export function weekPrompt(d: ReturnType<typeof weekPayload>): string {
  return `Jesteś egzaminatorem języka włoskiego i oceniasz mój postęp według skali CEFR.
Uczę się od ${d.totals.first_lesson||"niedawna"}, mam 1 lekcję konwersacji tygodniowo i notuję słówka w aplikacji. Poniżej dane z tego tygodnia (${d.week_start} – ${d.week_end}), statystyki całości i Twoja poprzednia ocena.

Oszacuj mój obecny poziom na skali: A1, A1+, A2, A2+, B1.
Zasady:
- Oceniaj ostrożnie i tylko na podstawie danych: zakres słownictwa, rodzaj tematów, czy notuję całe zdania (np. przeczenia, pytania), ile czasowników i form znam, poprawność włoskiego w notatkach, moje uwagi.
- Liczba słówek sama w sobie nie podnosi poziomu; liczy się, co potrafię z nimi zrobić (deskryptory CEFR „potrafię…”).
- Zmiana o więcej niż jeden stopień w tydzień tylko przy bardzo mocnych dowodach.
- "progress" to procent drogi od obecnego poziomu do następnego (0–100), może też spaść, jeśli dane tego wymagają.
- Pisz po polsku, konkretnie, z przykładami z moich słówek.

Zwróć WYŁĄCZNIE poprawny JSON w tym kształcie (bez komentarza):
{"assessment":{"type":"level_assessment","week_start":"${d.week_start}","week_end":"${d.week_end}","level":"A1","progress":0,"confidence":"low|medium|high","summary_pl":"2–3 zdania","can_do":["co już potrafię, 3–5 punktów"],"gaps":["czego brakuje do następnego poziomu, 2–4 punkty"],"next_week":["konkretne zadania na przyszły tydzień, 2–4 punkty"],"evidence":{"words":0,"phrases":0,"verbs":0}}}

${JSON.stringify(d,null,2)}`;
}
