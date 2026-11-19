import { useSyncExternalStore } from "react";
import { emptyState, openToday } from "./model";
import { nowIso } from "./text";
import type { Lesson, State } from "./types";

export const STORAGE_KEY = "quaderno.v1"; // same key and schema as the single-file app

function load(): State | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.lessons)) return s as State;
    }
  } catch { /* private mode or broken JSON: start fresh */ }
  return null;
}

/**
 * One mutable state object, like in the original app. Components call `store.update(s => ...)`
 * to change it; every update bumps `version`, which makes React re-render, and saves with a 250 ms debounce.
 */
class Store {
  state: State;
  version = 0;
  /** Bumped when whole lessons are replaced (import, switching lessons), so text inputs are re-created. */
  rev = 0;
  storageOk = true;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.state = openToday(load() ?? emptyState());
    window.addEventListener("beforeunload", () => this.saveNow());
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
    this.listeners.forEach((l) => l());
    if (opts.now) this.saveNow();
    else { clearTimeout(this.timer); this.timer = setTimeout(() => this.saveNow(), 250); }
  }

  saveNow() {
    clearTimeout(this.timer);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); this.storageOk = true; }
    catch { this.storageOk = false; }
  }

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
}

export const store = new Store();

/** React hook: re-render the component whenever the store changes. */
export function useStore(): Store {
  useSyncExternalStore(store.subscribe, () => store.version);
  return store;
}
