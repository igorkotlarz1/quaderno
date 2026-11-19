// Keeps this device in step with the Quadernote server (M2). Without a server (vite preview, the old
// single-file app), it stays quiet and the app works on local storage alone, as in M1.
// Offline (M3): edits keep landing in IndexedDB; what the server has not seen yet is worked out from
// `synced` (also in IndexedDB), so after a reload or a day offline the next successful push sends it all.
import { useSyncExternalStore } from "react";
import { LEGACY_SYNC_KEY, saveServerSeen, saveSynced } from "./db";
import { store } from "./store";
import { deletedLocally, dirtyLessons, mergeRemote, type RemoteState, type Synced } from "./syncMerge";

const META_KEY = LEGACY_SYNC_KEY;
const PULL_EVERY_MS = 30_000;
const PUSH_DELAY_MS = 800;

/** "local" = no server found; the status line is hidden then. */
export type SyncStatus = "local" | "syncing" | "ok" | "offline";

class Sync {
  status: SyncStatus = "local";
  lastOk: Date | null = null;
  private synced: Synced = {};
  private serverSeen = false;
  private seenBefore = false; // a server answered on an earlier start (kept in IndexedDB)
  private pushTimer: ReturnType<typeof setTimeout> | undefined;
  private busy = false;
  private listeners = new Set<() => void>();
  private version = 0;

  /** Call after `store.init()`. */
  start() {
    this.synced = store.initialSynced;
    this.seenBefore = store.initialServerSeen;
    void this.pull();
    setInterval(() => { if (document.visibilityState === "visible") void this.pull(); }, PULL_EVERY_MS);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void this.pull(); });
    window.addEventListener("online", () => void this.pull());
    window.addEventListener("offline", () => { if (this.serverSeen) this.set("offline"); });
    // Every local change schedules a push (the store calls this listener after each update).
    store.subscribe(() => {
      if (!this.serverSeen) return;
      // Show "Synchronizuję…" right away, so "Zapisane" never shows while a change is still waiting.
      if (this.status === "ok" && dirtyLessons(store.state, this.synced).length) this.set("syncing");
      clearTimeout(this.pushTimer);
      this.pushTimer = setTimeout(() => void this.push(), PUSH_DELAY_MS);
    });
  }

  private set(status: SyncStatus) {
    this.status = status;
    if (status === "ok") this.lastOk = new Date();
    this.version++;
    this.listeners.forEach((l) => l());
  }

  private saveMeta() {
    if (store.db) { void saveSynced(store.db, this.synced).catch(() => {}); return; }
    try { localStorage.setItem(META_KEY, JSON.stringify({ synced: this.synced })); } catch { /* ignore */ }
  }

  private async api(path: string, init?: RequestInit) {
    const res = await fetch(`/api${path}`, { headers: { "Content-Type": "application/json" }, ...init });
    if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) throw new Error(`${res.status}`);
    return res.json();
  }

  async pull() {
    if (this.busy) return;
    this.busy = true;
    try {
      if (this.serverSeen) this.set("syncing");
      const remote = (await this.api("/state")) as RemoteState;
      this.serverSeen = true;
      if (!this.seenBefore && store.db) { this.seenBefore = true; void saveServerSeen(store.db).catch(() => {}); }
      let pushAsm: RemoteState["assessments"] = [];
      store.update((s) => {
        const r = mergeRemote(s, remote, this.synced);
        pushAsm = r.pushAssessments;
        if (r.currentReplaced) store.rev++;
      }, { touch: false });
      this.saveMeta();
      for (const a of pushAsm) await this.api(`/assessments/${encodeURIComponent(a.id)}`, { method: "PUT", body: JSON.stringify(a) });
      this.busy = false;
      await this.push();
    } catch {
      this.busy = false;
      // A server we saw before (in this session, or on an earlier start: app opened offline) is unreachable
      // now (airplane mode, Tailscale off, Optiplex down): say so, keep working locally.
      this.set(this.serverSeen || this.seenBefore ? "offline" : "local");
    }
  }

  async push() {
    if (this.busy || !this.serverSeen) return;
    this.busy = true;
    try {
      const s = store.state;
      let replaced = false;
      for (const l of dirtyLessons(s, this.synced)) {
        const res = await this.api(`/lessons/${encodeURIComponent(l.id)}`, { method: "PUT", body: JSON.stringify(l) });
        if (res.applied) this.synced[l.id] = l.updated_at;
        else if (res.lesson) {
          // The server has a newer copy (edited on the other device): take it.
          const i = s.lessons.findIndex((x) => x.id === l.id);
          if (i >= 0) { s.lessons[i] = res.lesson; replaced ||= s.current === l.id; }
          this.synced[l.id] = res.lesson.updated_at;
        } else {
          delete this.synced[l.id]; // deleted on the server meanwhile
        }
      }
      for (const id of deletedLocally(s, this.synced)) {
        await this.api(`/lessons/${encodeURIComponent(id)}`, { method: "DELETE" });
        delete this.synced[id];
      }
      this.saveMeta();
      if (replaced) store.update(() => {}, { touch: false, reset: true });
      this.set("ok");
    } catch {
      this.set("offline");
    } finally {
      this.busy = false;
    }
  }

  /** Lessons changed or deleted here that the server has not got yet. */
  pending(): number {
    return dirtyLessons(store.state, this.synced).length + deletedLocally(store.state, this.synced).length;
  }

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getVersion = () => this.version;
}

export const sync = new Sync();

/** React hook: re-render when the sync status changes. */
export function useSync(): Sync {
  useSyncExternalStore(sync.subscribe, sync.getVersion);
  return sync;
}
