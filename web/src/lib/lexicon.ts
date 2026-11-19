// Offline Italian→Polish dictionary (M3.5). The server builds it from open data sets
// (server/app/lexicon) and hands out the most frequent ~5000 lemmas as one "bundle"; the phone keeps
// the bundle in IndexedDB, so suggestions work in airplane mode. The dictionary only *suggests*:
// a word has several meanings, so the user picks one (or the "Uzupełnij ze słownika" button takes the first).
import { useSyncExternalStore } from "react";
import { store } from "./store";

export interface LexSource {
  id: string;
  name: string;
  authors: string;
  license: string;
  license_url: string;
  homepage: string;
}

/** What /api/lexicon/bundle returns. A tuple type `[a, b]` is a fixed-length array with typed slots. */
export interface Bundle {
  version: string;
  built_at: string;
  top: number;
  lemmas: [lemma: string, pos: string, rank: number, glosses: string[]][];
  forms: Record<string, number[]>; // form → indexes into `lemmas`
  sources: LexSource[];
}

export interface Hit {
  lemma: string;
  pos: string;
  glosses: string[];
}

const ARTICLE = /^(?:(?:il|lo|la|i|gli|le|un|uno|una)\s+|(?:l|un|dell|nell|all|sull|dall)')/i;
const EDGE_PUNCT = /^[\s"'«»“”„.,;:!?¿¡()[\]-]+|[\s"«»“”„.,;:!?¿¡()[\]-]+$/g;

/** Same as normalize() in server/app/lexicon/text.py: "  La Finestra! " → "finestra", "l’amico" → "amico". */
export function normalize(text: string): string {
  const t = text.replace(/[’`]/g, "'").trim().toLowerCase().replace(EDGE_PUNCT, "").replace(/\s+/g, " ");
  const stripped = t.replace(ARTICLE, "").trim();
  return stripped || t;
}

/** "perché" → "perche": a word typed without accents still matches. */
export const accentKey = (text: string): string => text.normalize("NFD").replace(/\p{Mn}/gu, "");

export class Lexicon {
  private byKey = new Map<string, number[]>();
  /** Number of different words (a word that is a noun and an adverb has two rows but counts once). */
  readonly size: number;
  constructor(readonly bundle: Bundle) {
    this.size = new Set(bundle.lemmas.map((r) => r[0])).size;
    for (const [form, ids] of Object.entries(bundle.forms)) {
      const k = accentKey(form);
      const list = this.byKey.get(k);
      if (list) { for (const i of ids) if (!list.includes(i)) list.push(i); }
      else this.byKey.set(k, [...ids]);
    }
  }

  /** Lemmas the typed text can belong to, most frequent first. Exact spelling first, then without accents. */
  lookup(typed: string | null | undefined): Hit[] {
    if (!typed) return [];
    const w = normalize(typed);
    const ids = this.bundle.forms[w] ?? this.byKey.get(accentKey(w)) ?? [];
    return [...ids].sort((a, b) => a - b).map((i) => {
      const [lemma, pos, , glosses] = this.bundle.lemmas[i];
      return { lemma, pos, glosses };
    });
  }

  /** Up to `max` different Polish meanings for the chips under a row. */
  suggest(typed: string | null | undefined, max = 3): string[] {
    const out: string[] = [];
    for (const h of this.lookup(typed)) for (const g of h.glosses) {
      if (out.length >= max) return out;
      if (!out.includes(g)) out.push(g);
    }
    return out;
  }
}

/* ---------- keeping the bundle on the device ---------- */

const META_KEY = "lexicon";
export const BUNDLE_TOP = 5000;

class LexiconStore {
  lex: Lexicon | null = null;
  private version = 0;
  private listeners = new Set<() => void>();

  private set(b: Bundle | null) {
    this.lex = b ? new Lexicon(b) : null;
    this.version++;
    this.listeners.forEach((l) => l());
  }

  /** Read the saved copy, then ask the server for a newer one (304 = ours is current). Never throws. */
  async start(): Promise<void> {
    try {
      const saved = (await store.db?.meta.get(META_KEY))?.value as Bundle | undefined;
      if (saved?.lemmas) this.set(saved);
    } catch { /* no IndexedDB: online only */ }
    await this.refresh();
    window.addEventListener("online", () => void this.refresh());
  }

  async refresh(): Promise<void> {
    try {
      const have = this.lex?.bundle;
      const res = await fetch(`/api/lexicon/bundle?top=${BUNDLE_TOP}`, {
        headers: have ? { "If-None-Match": `"${have.version}-${have.top}"` } : {},
      });
      if (res.status !== 200 || !(res.headers.get("content-type") || "").includes("json")) return;
      const b = (await res.json()) as Bundle;
      this.set(b);
      await store.db?.meta.put({ key: META_KEY, value: b }).catch(() => {});
    } catch { /* offline or no server: keep what we have */ }
  }

  subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  snapshot = () => this.version;
}

export const lexicon = new LexiconStore();

/** React hook: the dictionary, or null while none is loaded on this device. */
export function useLexicon(): Lexicon | null {
  useSyncExternalStore(lexicon.subscribe, lexicon.snapshot);
  return lexicon.lex;
}
