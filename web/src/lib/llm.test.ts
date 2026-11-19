import { describe, expect, it } from "vitest";
import { applyLessonFix, fmtCost, type LessonFix, type Sent } from "./llm";
import { newEntry, newLesson, newVerb } from "./model";

function lesson() {
  const l = newLesson("2026-11-19");
  const a = newEntry("perche", "dlaczego", "user");
  const b = newEntry("il cane", null);
  const c = newEntry("la finestra", "okno");
  c.pl_source = "dict";
  const d = newEntry("caffe'", null);
  d.kind = "phrase"; d.kind_locked = true;
  l.entries = [a, b, c, d];
  const v = newVerb("andare");
  v.revealed = { io: true, tu: false, lui: false, noi: false, voi: false, loro: false };
  l.verbs = [v];
  return { l, a, b, c, d, v };
}

const sentOf = (es: { id: string; it: string | null; pl: string | null }[]): Sent => new Map(es.map((e) => [e.id, { it: e.it, pl: e.pl }]));
const fixFor = (id: string, over: Partial<LessonFix["entries"][0]> = {}) =>
  ({ id, it: null, it_suggestion: null, pl: null, kind: "word", pos: "noun", lemma: null, ...over }) as LessonFix["entries"][0];

describe("applyLessonFix", () => {
  it("fills NULLs, fixes accents, keeps what the user wrote", () => {
    const { l, a, b, c } = lesson();
    const sent = sentOf(l.entries);
    const fix: LessonFix = {
      entries: [fixFor(a.id, { it: "perché", pl: "czemu" }), fixFor(b.id, { pl: "pies", lemma: "il cane" }), fixFor(c.id)],
      verbs: [],
      call: null,
    };
    const n = applyLessonFix(l, fix, sent);
    expect(a).toMatchObject({ it: "perché", it_original: "perche", pl: "dlaczego", pl_source: "user" });
    expect(b).toMatchObject({ pl: "pies", pl_source: "llm", pos: "noun", lemma: "il cane" });
    expect(c).toMatchObject({ pl: "okno", pl_source: "dict" }); // no opinion from Claude: the dictionary's word stays
    expect(n).toEqual({ translated: 1, accents: 1, verbs: 0, suggestions: 0 });
  });

  it("does not overwrite what was typed while Claude was working", () => {
    const { l, a, b } = lesson();
    const sent = sentOf(l.entries);
    a.it = "perché?"; // changed meanwhile
    b.pl = "piesek";
    applyLessonFix(l, { entries: [fixFor(a.id, { it: "perché" }), fixFor(b.id, { pl: "pies" })], verbs: [], call: null }, sent);
    expect(a.it).toBe("perché?");
    expect(b.pl).toBe("piesek");
  });

  it("replaces a dictionary guess Claude disagrees with, and respects a kind set by hand", () => {
    const { l, c, d } = lesson();
    const sent = sentOf(l.entries);
    applyLessonFix(l, { entries: [fixFor(c.id, { pl: "okienko" }), fixFor(d.id, { it: "caffè", pl: "kawa", kind: "word" })], verbs: [], call: null }, sent);
    expect(c).toMatchObject({ pl: "okienko", pl_source: "llm" });
    expect(d).toMatchObject({ it: "caffè", pl: "kawa", kind: "phrase" });
  });

  it("writes verb forms and keeps what was revealed", () => {
    const { l, v } = lesson();
    const forms = { io: "vado", tu: "vai", lui: "va", noi: "andiamo", voi: "andate", loro: "vanno" };
    const n = applyLessonFix(l, { entries: [], verbs: [{ id: v.id, pl: "iść", forms }], call: null }, new Map());
    expect(v).toMatchObject({ forms, forms_source: "llm", confidence: "high" });
    expect(v.revealed.io).toBe(true);
    expect(n.verbs).toBe(1);
  });

  it("ignores ids it did not send", () => {
    const { l } = lesson();
    const before = JSON.stringify(l);
    applyLessonFix(l, { entries: [fixFor("nope", { pl: "x" })], verbs: [], call: null }, sentOf(l.entries));
    expect(JSON.stringify(l)).toBe(before);
  });
});

describe("fmtCost", () => {
  it("shows tiny amounts in grosze and bigger ones in złoty", () => {
    expect(fmtCost(0.0005)).toBe("0,2 gr");
    expect(fmtCost(0.25)).toBe("1,00 zł");
    expect(fmtCost(0)).toBe("0 gr");
  });
});
