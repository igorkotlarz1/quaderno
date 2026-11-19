import { describe, expect, it } from "vitest";
import fixture from "../../e2e/fixtures/export_v1.json";
import { lastAsm, weekWindow } from "./level";
import { emptyState, exportAll, importJson, lessonOut, newEntry, newVerb, parseNotes } from "./model";
import { lessonPrompt } from "./prompts";

const fresh = () => importJson(emptyState(), "") && emptyState();

describe("import / export (schema_version 1)", () => {
  it("imports the export of the single-file app", () => {
    const s = emptyState();
    const r = importJson(s, JSON.stringify(fixture));
    expect(r).toMatchObject({ ok: true, added: 2, replaced: 0, assessments: 1 });
    expect(s.lessons).toHaveLength(2);
    expect(s.current).toBe("fixture-lesson-2");
    expect(lastAsm(s)?.level).toBe("A1");
  });

  it("keeps LLM fields (pos, lemma, it_original) and round-trips", () => {
    const s = emptyState();
    importJson(s, JSON.stringify(fixture));
    const out = exportAll(s);
    const e = out.lessons[0].entries.find((x) => x.id === "f-e1")!;
    expect(e).toMatchObject({ pos: "noun", lemma: "la casa" });
    expect(out.lessons[0].entries.find((x) => x.id === "f-e4")!.it_original).toBe("caffe'");
    expect(out.lessons[0].entries.some((x) => "kind_locked" in x)).toBe(false);
    const again = emptyState();
    importJson(again, JSON.stringify(out));
    expect(exportAll(again).lessons).toEqual(out.lessons.map((l) => ({ ...l, updated_at: expect.any(String) })));
  });

  it("accepts an LLM answer in ```json fences and keeps revealed forms and dropped verbs", () => {
    const s = emptyState();
    importJson(s, JSON.stringify(fixture));
    const l = lessonOut(s.lessons[0]);
    // the LLM gets only "tossire" and sends back fixed forms; "bere" is not in its answer
    const answer = { ...l, verbs: [{ ...l.verbs[1], forms: { io: "tossisco", tu: "tossisci", lui: "tossisce", noi: "tossiamo", voi: "tossite", loro: "tossiscono" }, forms_source: "llm" }] };
    importJson(s, "```json\n" + JSON.stringify(answer) + "\n```");
    const verbs = s.lessons[0].verbs;
    expect(verbs.map((v) => v.it).sort()).toEqual(["bere", "tossire"]);
    expect(verbs.find((v) => v.it === "bere")!.revealed.io).toBe(true);
    expect(verbs.find((v) => v.it === "tossire")).toMatchObject({ forms_source: "llm", confidence: "high" });
  });

  it("rejects broken JSON and JSON without lessons", () => {
    expect(importJson(emptyState(), "{nope").ok).toBe(false);
    expect(importJson(emptyState(), '{"hello":1}').ok).toBe(false);
    expect(fresh().lessons).toEqual([]);
  });

  it("imports a bare weekly assessment", () => {
    const s = emptyState();
    const r = importJson(s, JSON.stringify({ assessment: { level: "a1+", progress: 130, week_end: "2026-11-26" } }));
    expect(r).toMatchObject({ ok: true, assessments: 1, lastId: null });
    expect(lastAsm(s)).toMatchObject({ level: "A1+", progress: 100, confidence: "medium" });
  });
});

describe("prompts", () => {
  it("sends only verbs the app is unsure about", () => {
    const s = emptyState();
    importJson(s, JSON.stringify(fixture));
    const p = lessonPrompt(s.lessons[0]);
    const json = JSON.parse(p.slice(p.indexOf("\n{") + 1));
    expect(json.verbs.map((v: { it: string }) => v.it)).toEqual(["tossire"]);
    expect(p).toContain("Pozycji bez tłumaczenia: 1. Czasowników do sprawdzenia: 1.");
  });
});

describe("helpers", () => {
  it("parseNotes splits on the usual separators", () => {
    const rows = parseNotes("la casa - dom\nvecchio – stary\nNon sono stanco.  = Nie jestem zmęczony.\ndolce");
    expect(rows.map((r) => [r.it, r.pl])).toEqual([["la casa", "dom"], ["vecchio", "stary"], ["Non sono stanco.", "Nie jestem zmęczony."], ["dolce", null]]);
  });
  it("newVerb conjugates locally", () => {
    expect(newVerb("parlare")).toMatchObject({ forms_source: "auto", confidence: "high" });
    expect(newVerb("xyz")).toMatchObject({ forms: null, forms_source: null });
  });
  it("first weekly window covers everything since the first lesson", () => {
    const s = emptyState();
    s.lessons.push({ ...newLessonOn("2026-11-01") });
    expect(weekWindow(s, "2026-11-19")).toEqual({ start: "2026-11-01", end: "2026-11-19" });
  });
});

function newLessonOn(date: string) {
  return { id: "x", date, title: "", source: "live", created_at: "", updated_at: "", entries: [newEntry("la casa", "dom")], verbs: [] };
}
