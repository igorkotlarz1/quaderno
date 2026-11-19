import type { Kind } from "./types";

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

/** Local date as YYYY-MM-DD (not UTC, so a lesson at 23:30 keeps its day). */
export const today = (): string => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
};
export const nowIso = (): string => new Date().toISOString();

/** Trim and collapse spaces; an empty string becomes null. */
export const clean = (s: unknown): string | null => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
};

const ART = /^(il|lo|la|i|gli|le|un|uno|una|l'|un')$/i;
/** "la casa" is a word, "Non sono stanco." is a phrase. */
export const kindOf = (it: string | null): Kind => {
  if (!it) return "word";
  const t = it.trim();
  if (/[.?!]$/.test(t)) return "phrase";
  const w = t.replace(/^(l'|un')/i, "$1 ").split(/\s+/);
  return w.length === 1 || (w.length === 2 && ART.test(w[0])) ? "word" : "phrase";
};

const GRAVE: Record<string, string> = { a: "à", e: "è", i: "ì", o: "ò", u: "ù", A: "À", E: "È", I: "Ì", O: "Ò", U: "Ù" };
/** e` → è while typing. Returns the new value and caret, or null when nothing changed. */
export function fixBacktick(value: string, caret: number): { value: string; caret: number } | null {
  if (!value.includes("`")) return null;
  const f = (s: string) => s.replace(/([aeiouAEIOU])`/g, (_m, v: string) => GRAVE[v]);
  const before = f(value.slice(0, caret));
  return { value: before + f(value.slice(caret)), caret: before.length };
}

/** Polish plural: plw(1,"słowo","słowa","słów") → "1 słowo", 3 → "3 słowa", 5 → "5 słów". */
export const plw = (n: number, a: string, b: string, c: string): string =>
  `${n} ${n === 1 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c}`;

export const addDays = (d: string, n: number): string => {
  const x = new Date(d + "T12:00:00");
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

export const fmtDay = (d: string): string => {
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  } catch {
    return d;
  }
};

/** Polish plural: 1 lekcja czeka, 2–4 lekcje czekają, 5+ lekcji czeka (12–14 too). */
export function waiting(n: number): string {
  if (n === 1) return "1 lekcja czeka";
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  return few ? `${n} lekcje czekają` : `${n} lekcji czeka`;
}
