// M4: "Opracuj lekcję" and "Oceń tydzień" in one click. The server calls the Claude API (the key never
// reaches the browser) and logs the cost of every call; the app only sends data and applies the answer.
import { lessonOut } from "./model";
import type { Forms, Lesson } from "./types";

export interface LlmCall {
  at: string;
  purpose: "lesson" | "week";
  model: string;
  status: "ok" | "error" | "refusal";
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  duration_ms: number;
}

export interface LlmStatus {
  enabled: boolean;
  fake: boolean;
  models: { lesson: string; week: string };
  spent_usd: { today: number; month: number; total: number };
  calls: LlmCall[];
}

export interface EntryFix {
  id: string;
  it: string | null;
  it_suggestion: string | null;
  pl: string | null;
  kind: "word" | "phrase";
  pos: string | null;
  lemma: string | null;
}
export interface VerbFix { id: string; pl: string | null; forms: Forms }
export interface LessonFix { entries: EntryFix[]; verbs: VerbFix[]; call: LlmCall | null }

/** POST JSON, and turn the server's {detail} into a readable error. */
async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/llm/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("Brak połączenia z serwerem");
  }
  if (!res.ok) {
    const detail = await res.json().then((j) => j?.detail, () => null);
    throw new Error(typeof detail === "string" ? detail : `Błąd serwera (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** null when there is no server (or it is unreachable): the app then shows only the manual prompt. */
export async function llmStatus(): Promise<LlmStatus | null> {
  try {
    const res = await fetch("/api/llm/status");
    if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) return null;
    return (await res.json()) as LlmStatus;
  } catch { return null; }
}

/** What was sent, so the answer can be applied only where the user has not changed anything meanwhile. */
export type Sent = Map<string, { it: string | null; pl: string | null }>;

export async function requestLessonFix(lesson: Lesson): Promise<{ fix: LessonFix; sent: Sent }> {
  const body = lessonOut(lesson);
  const sent: Sent = new Map(body.entries.map((e) => [e.id, { it: e.it, pl: e.pl }]));
  return { fix: await post<LessonFix>("lesson", body), sent };
}

export async function requestWeek(payload: unknown): Promise<{ assessment: Record<string, unknown>; call: LlmCall | null }> {
  return post("week", payload);
}

export interface Applied { translated: number; accents: number; verbs: number; suggestions: number }

/**
 * Apply Claude's patch to the lesson as it is *now* (the user may have typed while waiting):
 * - an accent fix only if the Italian is still what was sent; the old spelling goes to `it_original`,
 * - a translation only where "polski" is still empty (or still the dictionary's guess Claude disagrees with),
 * - kind / part of speech / lemma unless the user set the kind by hand,
 * - verb forms for the verbs that were sent; what the user has revealed stays revealed.
 */
export function applyLessonFix(lesson: Lesson, fix: LessonFix, sent: Sent): Applied {
  const n: Applied = { translated: 0, accents: 0, verbs: 0, suggestions: 0 };
  const entries = new Map(lesson.entries.map((e) => [e.id, e]));
  for (const f of fix.entries) {
    const e = entries.get(f.id);
    const was = sent.get(f.id);
    if (!e || !was) continue;
    if (f.it && f.it !== e.it && e.it === was.it) {
      e.it_original = e.it ?? undefined;
      e.it = f.it;
      n.accents++;
    }
    if (f.it_suggestion && f.it_suggestion !== e.it) { e.it_suggestion = f.it_suggestion; n.suggestions++; }
    const replaceDict = e.pl_source === "dict" && e.pl === was.pl;
    if (f.pl && (!e.pl || replaceDict) && f.pl !== e.pl) {
      e.pl = f.pl;
      e.pl_source = "llm";
      n.translated++;
    }
    if (!e.kind_locked) e.kind = f.kind;
    if (f.pos) e.pos = f.pos;
    if (f.lemma) e.lemma = f.lemma;
  }
  const verbs = new Map((lesson.verbs || []).map((v) => [v.id, v]));
  for (const f of fix.verbs) {
    const v = verbs.get(f.id);
    if (!v) continue;
    v.forms = { ...f.forms };
    v.forms_source = "llm";
    v.confidence = "high";
    if (f.pl && !v.pl) v.pl = f.pl;
    n.verbs++;
  }
  return n;
}

/** "0,21 gr" for tiny amounts, "0,34 zł" for bigger ones; the server counts in USD. */
export function fmtCost(usd: number, rate = 4.0): string {
  const pln = usd * rate;
  if (pln < 0.01) return `${(pln * 100).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} gr`;
  return `${pln.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}
