// Pure merge logic for syncing with the server (no DOM, no fetch), so Vitest can test it.
// Rule: last write wins per lesson, compared by `updated_at` (ISO strings compare correctly as text).
import { filled, newEntry, normLesson, verbsOf } from "./model";
import type { Assessment, Lesson, State } from "./types";

export interface RemoteState {
  lessons: Lesson[];
  assessments: Assessment[];
  deleted: string[]; // lessons deleted on another device
}

/** What this device knows the server has: lesson id → `updated_at` of the server copy. Kept in localStorage. */
export type Synced = Record<string, string>;

export const hasContent = (l: Lesson): boolean => filled(l).length > 0 || verbsOf(l).length > 0 || !!l.title;

export interface MergeResult {
  changed: boolean; // local state was changed
  currentReplaced: boolean; // the open lesson was swapped, so the inputs must be re-created
  pushAssessments: Assessment[]; // local assessments the server does not have yet
}

export function mergeRemote(state: State, remote: RemoteState, synced: Synced): MergeResult {
  let changed = false;
  let currentReplaced = false;
  const byId = new Map(state.lessons.map((l) => [l.id, l] as const));

  for (const id of remote.deleted) {
    delete synced[id];
    if (byId.has(id)) {
      state.lessons = state.lessons.filter((l) => l.id !== id);
      byId.delete(id);
      changed = true;
      if (state.current === id) currentReplaced = true;
    }
  }

  for (const raw of remote.lessons) {
    const rl = normLesson(raw);
    rl.updated_at = raw.updated_at; // normLesson may fill defaults; the server time is what we compare against
    synced[rl.id] = rl.updated_at;
    const local = byId.get(rl.id);
    if (!local) {
      state.lessons.push(rl);
      byId.set(rl.id, rl);
      changed = true;
    } else if (rl.updated_at > local.updated_at) {
      state.lessons[state.lessons.indexOf(local)] = rl;
      byId.set(rl.id, rl);
      changed = true;
      if (state.current === rl.id) currentReplaced = true;
    }
    // A newer local copy is left as it is; the push loop sends it.
  }

  // A new device opens with an empty lesson for today. If the server already has today's lesson, open that one.
  const cur = state.lessons.find((l) => l.id === state.current);
  if (cur && !hasContent(cur) && !(cur.id in synced)) {
    const same = state.lessons.find((l) => l !== cur && l.date === cur.date && l.id in synced && hasContent(l));
    if (same) {
      state.lessons = state.lessons.filter((l) => l !== cur);
      state.current = same.id;
      changed = currentReplaced = true;
    }
  }

  if (!state.lessons.some((l) => l.id === state.current)) {
    state.current = state.lessons.length ? state.lessons[state.lessons.length - 1].id : null;
    currentReplaced = true;
  }
  const open = state.lessons.find((l) => l.id === state.current);
  if (open && open.entries.length === 0) open.entries.push(newEntry());

  const remoteAsm = new Set(remote.assessments.map((a) => a.id));
  const localAsm = new Set(state.assessments.map((a) => a.id));
  for (const a of remote.assessments) {
    if (!localAsm.has(a.id)) {
      state.assessments.push(a);
      changed = true;
    }
  }
  const pushAssessments = state.assessments.filter((a) => !remoteAsm.has(a.id));

  return { changed, currentReplaced, pushAssessments };
}

/** Lessons to send: changed since the last sync, and either not empty or already on the server. */
export function dirtyLessons(state: State, synced: Synced): Lesson[] {
  return state.lessons.filter((l) => synced[l.id] !== l.updated_at && (hasContent(l) || l.id in synced));
}

/** Lessons the server has but this device deleted. */
export function deletedLocally(state: State, synced: Synced): string[] {
  const ids = new Set(state.lessons.map((l) => l.id));
  return Object.keys(synced).filter((id) => !ids.has(id));
}
