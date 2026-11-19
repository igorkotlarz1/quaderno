import { describe, expect, it } from "vitest";
import { newEntry, newLesson } from "./model";
import { deletedLocally, dirtyLessons, mergeRemote, type Synced } from "./syncMerge";
import type { Lesson, State } from "./types";

const at = (h: number) => `2026-11-19T${String(h).padStart(2, "0")}:00:00.000Z`;

function lesson(id: string, updated: number, words: [string, string | null][] = [["la casa", "dom"]]): Lesson {
  const l = newLesson("2026-11-19");
  l.id = id;
  l.created_at = at(8);
  l.updated_at = at(updated);
  l.entries = words.map(([it, pl]) => newEntry(it, pl));
  return l;
}
const state = (...lessons: Lesson[]): State => ({ schema_version: 1, current: lessons[0]?.id ?? null, lessons, assessments: [] });
const remote = (lessons: Lesson[] = [], deleted: string[] = []) => ({ lessons: structuredClone(lessons), assessments: [], deleted });

describe("mergeRemote", () => {
  it("adds lessons from the other device", () => {
    const s = state(lesson("a", 10));
    const synced: Synced = {};
    mergeRemote(s, remote([lesson("b", 9, [["il gatto", "kot"]])]), synced);
    expect(s.lessons.map((l) => l.id)).toEqual(["a", "b"]);
    expect(synced).toEqual({ b: at(9) });
  });

  it("newer server copy wins, older one is ignored", () => {
    const s = state(lesson("a", 10), lesson("b", 10));
    const r = mergeRemote(s, remote([lesson("a", 11, [["nuovo", null]]), lesson("b", 9, [["vecchio", null]])]), {});
    expect(s.lessons[0].entries[0].it).toBe("nuovo");
    expect(s.lessons[1].entries[0].it).toBe("la casa");
    expect(r.currentReplaced).toBe(true);
  });

  it("drops lessons deleted elsewhere", () => {
    const s = state(lesson("a", 10), lesson("b", 10));
    const synced: Synced = { a: at(10), b: at(10) };
    mergeRemote(s, remote([lesson("b", 10)], ["a"]), synced);
    expect(s.lessons.map((l) => l.id)).toEqual(["b"]);
    expect(s.current).toBe("b");
    expect(synced).toEqual({ b: at(10) });
  });

  it("a new device's empty lesson gives way to today's lesson from the server", () => {
    const empty = lesson("phone", 12, []);
    const s = state(empty);
    mergeRemote(s, remote([lesson("laptop", 11)]), {});
    expect(s.current).toBe("laptop");
    expect(s.lessons.map((l) => l.id)).toEqual(["laptop"]);
  });

  it("keeps assessments from both sides", () => {
    const s = state(lesson("a", 10));
    const mine = { id: "x" } as State["assessments"][number];
    const theirs = { id: "y" } as State["assessments"][number];
    s.assessments.push(mine);
    const r = mergeRemote(s, { lessons: [], assessments: [theirs], deleted: [] }, {});
    expect(s.assessments.map((a) => a.id)).toEqual(["x", "y"]);
    expect(r.pushAssessments.map((a) => a.id)).toEqual(["x"]);
  });
});

describe("dirtyLessons / deletedLocally", () => {
  it("sends changed lessons with content, skips empty new ones", () => {
    const s = state(lesson("a", 10), lesson("b", 10), lesson("empty", 10, []));
    expect(dirtyLessons(s, { a: at(10) }).map((l) => l.id)).toEqual(["b"]);
  });
  it("finds lessons deleted on this device", () => {
    expect(deletedLocally(state(lesson("a", 10)), { a: at(10), gone: at(9) })).toEqual(["gone"]);
  });
});
