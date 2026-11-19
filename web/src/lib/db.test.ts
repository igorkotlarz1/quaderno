// IndexedDB layer (M3). fake-indexeddb gives Node an in-memory IndexedDB, so Dexie runs as in a browser.
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LEGACY_STATE_KEY, LEGACY_SYNC_KEY, loadAll, QuadernoDB, saveServerSeen, saveState, saveSynced } from "./db";
import { emptyState, newEntry, newLesson } from "./model";
import type { State } from "./types";

let n = 0;
let db: QuadernoDB;
const fresh = () => (db = new QuadernoDB(`test-${n++}`));
afterEach(async () => { await db.delete(); });

const legacy = (items: Record<string, string>) => ({ getItem: (k: string) => items[k] ?? null });

function sample(): State {
  const s = emptyState();
  const a = newLesson("2026-11-12");
  a.entries.push(newEntry("la finestra", "okno"));
  const b = newLesson("2026-11-19");
  b.entries.push(newEntry("il tavolo", null));
  s.lessons.push(a, b);
  s.current = b.id;
  return s;
}

describe("IndexedDB storage", () => {
  it("starts empty", async () => {
    expect(await loadAll(fresh(), legacy({}))).toEqual({ state: null, synced: {}, serverSeen: false, migrated: false });
  });

  it("saves and loads the whole state, keeping lesson order", async () => {
    const s = sample();
    await saveState(fresh(), s);
    const r = await loadAll(db, null);
    expect(r.state).toEqual(s);
    expect(r.state!.lessons.map((l) => l.date)).toEqual(["2026-11-12", "2026-11-19"]);
  });

  it("drops lessons deleted since the last save", async () => {
    const s = sample();
    await saveState(fresh(), s);
    s.lessons.shift();
    await saveState(db, s);
    expect((await loadAll(db, null)).state!.lessons).toHaveLength(1);
    expect(await db.lessons.count()).toBe(1);
  });

  it("migrates the M1/M2 localStorage data once and leaves it as a backup", async () => {
    const s = sample();
    const old = legacy({ [LEGACY_STATE_KEY]: JSON.stringify(s), [LEGACY_SYNC_KEY]: JSON.stringify({ synced: { [s.lessons[0].id]: "x" } }) });
    const first = await loadAll(fresh(), old);
    expect(first.migrated).toBe(true);
    expect(first.state).toEqual(s);
    expect(first.synced).toEqual({ [s.lessons[0].id]: "x" });
    // Second start reads IndexedDB, even if localStorage still has (older) data.
    const second = await loadAll(db, legacy({ [LEGACY_STATE_KEY]: JSON.stringify(emptyState()) }));
    expect(second.migrated).toBe(false);
    expect(second.state!.lessons).toHaveLength(2);
  });

  it("ignores broken localStorage JSON", async () => {
    expect((await loadAll(fresh(), legacy({ [LEGACY_STATE_KEY]: "{not json" }))).state).toBeNull();
  });

  it("keeps the sync bookkeeping", async () => {
    await saveState(fresh(), sample());
    await saveSynced(db, { a: "2026-11-19T10:00:00Z" });
    expect((await loadAll(db, null)).serverSeen).toBe(false);
    await saveServerSeen(db);
    const r = await loadAll(db, null);
    expect(r.synced).toEqual({ a: "2026-11-19T10:00:00Z" });
    expect(r.serverSeen).toBe(true);
  });
});
