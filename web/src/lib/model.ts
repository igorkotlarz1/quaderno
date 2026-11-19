import { conjugate, PERS } from "./conjugate";
import { importAssessments } from "./level";
import { clean, kindOf, nowIso, today, uid } from "./text";
import type { Entry, Forms, Lesson, Person, State, Verb } from "./types";

// `Record<string, any>` = "an object from outside (JSON) whose shape we do not trust yet".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

export const filled = (l: Lesson): Entry[] => l.entries.filter((e) => e.it || e.pl);
export const verbsOf = (l: Lesson): Verb[] => (l.verbs ||= []);
const allClosed = (): Record<Person, boolean> => Object.fromEntries(PERS.map((p) => [p, false])) as Record<Person, boolean>;

export function newLesson(date?: string | null): Lesson {
  return { id: uid(), date: date || today(), title: "", source: "live", created_at: nowIso(), updated_at: nowIso(), entries: [], verbs: [] };
}

export function newEntry(it?: string | null, pl?: string | null, src?: "user" | "llm"): Entry {
  return { id: uid(), it: it ?? null, pl: pl ?? null, kind: kindOf(it ?? null), kind_locked: false, pl_source: pl ? src || "user" : null, created_at: nowIso() };
}

export function newVerb(inf: string): Verb {
  const it = clean(inf) ?? "";
  const c = conjugate(it);
  return {
    id: uid(), it, pl: null, tense: "presente",
    forms: c ? c.forms : null, forms_source: c ? "auto" : null, confidence: c ? c.confidence : null,
    revealed: allClosed(), created_at: nowIso(),
  };
}

export function emptyState(): State {
  return { schema_version: 1, current: null, lessons: [], assessments: [] };
}

/** Open today's lesson (reuse an empty one, else create one). Mutates and returns the state. */
export function openToday(state: State): State {
  if (!Array.isArray(state.assessments)) state.assessments = [];
  let todays = state.lessons.find((l) => l.date === today());
  if (!todays) {
    const last = state.lessons[state.lessons.length - 1];
    if (last && filled(last).length === 0) { last.date = today(); todays = last; }
    else { todays = newLesson(); state.lessons.push(todays); }
  }
  state.current = todays.id;
  if (todays.entries.length === 0) todays.entries.push(newEntry());
  return state;
}

/* ---------- normalize data coming from JSON (export or LLM answer) ---------- */

export function normEntry(x: Raw): Entry {
  const it = clean(x.it ?? x.italian ?? x.wloski);
  const pl = clean(x.pl ?? x.polish ?? x.polski);
  return {
    ...x, id: x.id || uid(), it, pl,
    kind: x.kind === "phrase" || x.kind === "word" ? x.kind : kindOf(it),
    kind_locked: !!x.kind, pl_source: pl ? x.pl_source || "user" : null, created_at: x.created_at || nowIso(),
  };
}

export function normVerb(x: Raw): Verb | null {
  const it = clean(x.it ?? x.infinitive ?? x.verb);
  if (!it) return null;
  const base = newVerb(it);
  const fromJson = x.forms && PERS.every((p) => clean(x.forms[p]));
  const forms: Forms | null = fromJson ? (Object.fromEntries(PERS.map((p) => [p, clean(x.forms[p])])) as Forms) : base.forms;
  const source = fromJson ? x.forms_source || "llm" : base.forms_source;
  // Forms checked by the LLM or fixed by hand are certain; app-made forms keep their own flag,
  // so a "do sprawdzenia" verb stays marked after an export → import round trip.
  const confidence = source === "llm" || source === "user" ? "high"
    : x.confidence === "check" || x.confidence === "high" ? x.confidence : base.confidence;
  return {
    ...x, id: x.id || base.id, it, pl: clean(x.pl ?? x.meaning_pl), tense: "presente", forms,
    forms_source: source,
    confidence,
    revealed: Object.fromEntries(PERS.map((p) => [p, !!(x.revealed && x.revealed[p])])) as Record<Person, boolean>,
    created_at: x.created_at || nowIso(),
  };
}

export function normLesson(x: Raw): Lesson {
  return {
    id: x.id || uid(), date: x.date || today(), title: x.title || "", source: x.source || "import",
    created_at: x.created_at || nowIso(), updated_at: nowIso(),
    entries: (x.entries || []).map(normEntry).filter((e: Entry) => e.it || e.pl),
    verbs: (x.verbs || []).map(normVerb).filter(Boolean) as Verb[],
    summary: x.summary, notes: x.notes,
  };
}

/** Keep what was already revealed and the verbs the LLM did not send back. */
export function mergeVerbs(l: Lesson, old: Lesson): void {
  const ov = verbsOf(old);
  l.verbs.forEach((v) => {
    const o = ov.find((x) => x.id === v.id || x.it.toLowerCase() === v.it.toLowerCase());
    if (o) {
      PERS.forEach((p) => { if (o.revealed && o.revealed[p]) v.revealed[p] = true; });
      v.id = o.id;
    }
  });
  ov.forEach((o) => { if (!l.verbs.some((v) => v.id === o.id)) l.verbs.push(o); });
}

/* ---------- export ---------- */

export function lessonOut(l: Lesson) {
  return {
    id: l.id, date: l.date, title: l.title || null, source: l.source || "live", created_at: l.created_at, updated_at: l.updated_at,
    // drop the UI-only flag kind_locked
    entries: filled(l).map(({ kind_locked: _k, ...rest }) => rest),
    verbs: verbsOf(l).map((v) => ({ ...v })),
  };
}

export function exportAll(state: State) {
  return { app: "quaderno", schema_version: 1, exported_at: nowIso(), lessons: state.lessons.map(lessonOut), assessments: state.assessments };
}

/* ---------- import ---------- */

export type ImportResult =
  | { ok: true; added: number; replaced: number; assessments: number; lastId: string | null }
  | { ok: false; error: string };

/** Accepts a full export, one lesson, an LLM answer with ```json fences, or a level assessment. Mutates state. */
export function importJson(state: State, text: string): ImportResult {
  let data: Raw;
  try { data = JSON.parse(text.trim().replace(/^```(?:json)?\s*|```\s*$/g, "")); }
  catch { return { ok: false, error: "To nie jest poprawny JSON" }; }
  const assessments = importAssessments(state, data);
  const lessons: Raw[] = Array.isArray(data) ? data : data.lessons || (data.lesson ? [data.lesson] : data.entries || data.verbs ? [data] : []);
  let added = 0, replaced = 0;
  let lastId: string | null = null;
  lessons.forEach((raw) => {
    if (!raw || !(raw.entries || raw.verbs)) return;
    const l = normLesson(raw);
    const i = state.lessons.findIndex((x) => x.id === l.id);
    if (i >= 0) { mergeVerbs(l, state.lessons[i]); state.lessons[i] = l; replaced++; }
    else { state.lessons.push(l); added++; }
    lastId = l.id;
  });
  if (!lastId && !assessments) return { ok: false, error: "Nie znalazłem lekcji ani oceny poziomu" };
  if (lastId) {
    state.current = lastId;
    const cur = state.lessons.find((l) => l.id === lastId)!;
    if (!cur.entries.length) cur.entries.push(newEntry());
  }
  return { ok: true, added, replaced, assessments, lastId };
}

/** Lines like "la casa - dom"; a line without a separator becomes Italian with Polish NULL. */
export function parseNotes(text: string): Entry[] {
  return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((line) => {
    const m = line.match(/^(.+?)\s*(?:\t|\s[-–—=:|]\s|\s?[|=]\s?)\s*(.+)$/);
    return m ? newEntry(clean(m[1]), clean(m[2]), "user") : newEntry(clean(line), null);
  });
}
