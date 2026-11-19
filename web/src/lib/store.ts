import { useSyncExternalStore } from "react";
import { LEGACY_STATE_KEY, loadAll, openDb, saveState, type QuadernoDB } from "./db";
import { emptyState, openToday } from "./model";
import type { Synced } from "./syncMerge";
import { nowIso } from "./text";
import type { Lesson, State } from "./types";

export const STORAGE_KEY = LEGACY_STATE_KEY; // same key and schema as the single-file app
/**
 * Emergency copy. IndexedDB saves are asynchronous and a phone may kill the page before one finishes
 * (closing the app right after typing). When the page goes away with changes not yet in IndexedDB,
 * the state is also written here, synchronously; the next start takes it and moves it to IndexedDB.
 */
export const JOURNAL_KEY = "quaderno.unsaved.v1";

function legacyStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/**
 * One mutable state object, like in the original app. Components call `store.update(s => ...)`
 * to change it; every update bumps `version`, which makes React re-render, and saves with a 250 ms debounce.
 * Since M3 the state lives in IndexedDB (lib/db.ts); localStorage is only the fallback where IndexedDB is blocked.
 */
class Store {
  state: State = emptyState();
  version = 0;
  /** Bumped when whole lessons are replaced (import, switching lessons), so text inputs are re-created. */
  rev = 0;
  storageOk = true;
  /** "indexeddb" normally, "localstorage" in browsers that block IndexedDB. */
  backend: "indexeddb" | "localstorage" = "indexeddb";
  db: QuadernoDB | null = null;
  /** Sync bookkeeping read at start (lib/sync.ts takes it over). */
  initialSynced: Synced = {};
  initialServerSeen = false;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<void> = Promise.resolve();
  /** Changes not yet confirmed as written to IndexedDB (counts edits; reset when a write that covers them ends). */
  private unsaved = 0;

  /** Load the saved state before the first render. `async` functions return a Promise; `await` waits for it. */
  async init(): Promise<void> {
    this.db = await openDb();
    let loaded: State | null = null;
    if (this.db) {
      try {
        const r = await loadAll(this.db, legacyStorage());
        loaded = readJournal() ?? r.state;
        this.initialSynced = r.synced;
        this.initialServerSeen = r.serverSeen;
      } catch {
        this.db = null;
      }
    }
    if (!this.db) {
      this.backend = "localstorage";
      try {
        const s = JSON.parse(legacyStorage()?.getItem(STORAGE_KEY) || "null");
        if (s && Array.isArray(s.lessons)) loaded = s as State;
      } catch { /* start fresh */ }
    }
    this.state = openToday(loaded ?? emptyState());
    // Ask the browser not to evict our data when the disk gets full (mobile browsers may say no).
    void navigator.storage?.persist?.().catch(() => false);
    const leaving = () => { this.writeJournal(); void this.saveNow(); };
    window.addEventListener("pagehide", leaving);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") leaving(); });
    this.version++;
    this.listeners.forEach((l) => l());
    this.unsaved++; // the first save also moves a journal copy (if any) into IndexedDB
    void this.saveNow();
  }

  get cur(): Lesson {
    return this.state.lessons.find((l) => l.id === this.state.current)!;
  }

  /** Change the state. `touch` marks the current lesson as edited; `reset` re-creates the inputs. */
  update(fn: (s: State) => void, opts: { touch?: boolean; reset?: boolean; now?: boolean } = {}) {
    fn(this.state);
    if (opts.touch !== false && this.cur) this.cur.updated_at = nowIso();
    if (opts.reset) this.rev++;
    this.version++;
    this.unsaved++;
    this.listeners.forEach((l) => l());
    if (opts.now) void this.saveNow();
    else { clearTimeout(this.timer); this.timer = setTimeout(() => void this.saveNow(), 250); }
  }

  /** Save now. Saves run one after another, so an older snapshot never overwrites a newer one. */
  saveNow(): Promise<void> {
    clearTimeout(this.timer);
    this.saving = this.saving.then(() => this.write()).catch(() => { this.storageOk = false; });
    return this.saving;
  }

  private async write() {
    if (this.db) {
      const covered = this.unsaved;
      await saveState(this.db, this.state);
      this.storageOk = true;
      if (this.unsaved === covered) {
        this.unsaved = 0;
        try { localStorage.removeItem(JOURNAL_KEY); } catch { /* ignore */ }
      }
      return;
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); this.storageOk = true; }
    catch { this.storageOk = false; }
  }

  /** Synchronous last-moment copy, only when IndexedDB is behind. */
  private writeJournal() {
    if (!this.db || this.unsaved === 0) return;
    try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(this.state)); } catch { /* full or blocked: IndexedDB may still finish */ }
  }

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
}

function readJournal(): State | null {
  try {
    const s = JSON.parse(legacyStorage()?.getItem(JOURNAL_KEY) || "null");
    return s && Array.isArray(s.lessons) ? (s as State) : null;
  } catch { return null; }
}

export const store = new Store();

/** React hook: re-render the component whenever the store changes. */
export function useStore(): Store {
  useSyncExternalStore(store.subscribe, () => store.version);
  return store;
}
