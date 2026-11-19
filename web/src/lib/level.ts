import { PERS } from "./conjugate";
import { filled, verbsOf } from "./model";
import { addDays, nowIso, today, uid } from "./text";
import type { Assessment, Confidence, Level, State } from "./types";

export const LEVELS: Level[] = ["A1", "A1+", "A2", "A2+", "B1"];
export const LVL_NEXT: Record<Level, string> = { A1: "A1+", "A1+": "A2", A2: "A2+", "A2+": "B1", B1: "B1+" };
export const CONF: Record<Confidence, string> = { low: "niska pewność", medium: "średnia pewność", high: "wysoka pewność" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

export function normAsm(x: unknown): Assessment | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Raw;
  const lv = String(r.level || r.cefr || "").toUpperCase().replace(/\s/g, "") as Level;
  if (!LEVELS.includes(lv)) return null;
  let pr = Number(r.progress ?? r.progress_pct ?? 0);
  if (!isFinite(pr)) pr = 0;
  pr = Math.max(0, Math.min(100, Math.round(pr)));
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 8) : []);
  return {
    id: r.id || uid(), type: "level_assessment", week_start: r.week_start || null, week_end: r.week_end || today(),
    assessed_at: r.assessed_at || nowIso(), level: lv, progress: pr,
    confidence: r.confidence in CONF ? r.confidence : "medium",
    summary_pl: String(r.summary_pl || r.summary || ""),
    strengths: arr(r.strengths), gaps: arr(r.gaps), next_week: arr(r.next_week || r.goals), can_do: arr(r.can_do),
    evidence: r.evidence || null, model: r.model || null,
  };
}

/** Finds assessments in {assessment}, {assessments:[]} or a bare assessment object. Returns how many were stored. */
export function importAssessments(state: State, data: Raw): number {
  if (!Array.isArray(state.assessments)) state.assessments = [];
  const raw = [
    ...(data?.assessment ? [data.assessment] : []),
    ...(Array.isArray(data?.assessments) ? data.assessments : []),
    ...(data?.type === "level_assessment" ? [data] : []),
  ];
  let n = 0;
  raw.map(normAsm).forEach((a) => {
    if (!a) return;
    const i = state.assessments.findIndex((x) => x.id === a.id || (x.week_end === a.week_end && x.level === a.level && x.progress === a.progress));
    if (i >= 0) state.assessments[i] = a; else state.assessments.push(a);
    n++;
  });
  return n;
}

export const sortedAsm = (state: State): Assessment[] =>
  state.assessments.slice().sort((a, b) => (a.week_end || "").localeCompare(b.week_end || "") || (a.assessed_at || "").localeCompare(b.assessed_at || ""));
export const lastAsm = (state: State): Assessment | undefined => sortedAsm(state).pop();

/** Last 7 days, or since the last assessment; the first assessment covers everything so far. */
export function weekWindow(state: State, end = today()): { start: string; end: string } {
  const la = lastAsm(state);
  let start = addDays(end, -6);
  if (!la) {
    const first = state.lessons.map((l) => l.date || "").filter(Boolean).sort()[0];
    if (first && first < start) start = first;
  } else if (la.week_end && la.week_end >= start && la.week_end < end) start = addDays(la.week_end, 1);
  return { start, end };
}

export function assessmentDue(state: State, now = today()): boolean {
  const la = lastAsm(state);
  if (!state.lessons.some((l) => filled(l).length || verbsOf(l).length)) return false;
  if (!la) {
    const first = state.lessons.filter((l) => filled(l).length).map((l) => l.date || "").sort()[0];
    return !!first && first <= addDays(now, -6);
  }
  return la.week_end <= addDays(now, -7);
}

export function weekPayload(state: State, notes: string | null) {
  const { start, end } = weekWindow(state);
  const all = state.lessons;
  const inWeek = all.filter((l) => (l.date || "") >= start && (l.date || "") <= end);
  const ent = all.flatMap(filled);
  const vb = all.flatMap(verbsOf);
  const rev = vb.reduce((n, v) => n + PERS.filter((p) => v.revealed && v.revealed[p]).length, 0);
  const la = lastAsm(state);
  return {
    week_start: start, week_end: end,
    totals: {
      lessons: all.filter((l) => filled(l).length || verbsOf(l).length).length,
      words: ent.filter((e) => e.kind !== "phrase").length,
      phrases: ent.filter((e) => e.kind === "phrase").length,
      verbs: vb.length,
      verb_forms_revealed: `${rev}/${vb.length * 6}`,
      missing_pl: ent.filter((e) => e.it && !e.pl).length,
      first_lesson: all.map((l) => l.date || "").filter(Boolean).sort()[0] || null,
    },
    previous_assessment: la ? { week_end: la.week_end, level: la.level, progress: la.progress, gaps: la.gaps, next_week: la.next_week } : null,
    learner_notes: notes || null,
    lessons_this_week: inWeek.map((l) => ({
      date: l.date, title: l.title || null,
      entries: filled(l).map((e) => ({ it: e.it, pl: e.pl, kind: e.kind, ...(e.pos ? { pos: e.pos } : {}) })),
      verbs: verbsOf(l).map((v) => ({ it: v.it, pl: v.pl, revealed: PERS.filter((p) => v.revealed && v.revealed[p]).length })),
    })),
  };
}
