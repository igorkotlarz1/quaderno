// Data model, identical to the JSON export of the original single-file app (schema_version 1).
// A `type` in TypeScript only describes the shape of an object; it disappears at runtime.

export type Kind = "word" | "phrase";
export type Person = "io" | "tu" | "lui" | "noi" | "voi" | "loro";
export type Forms = Record<Person, string>;
export type Level = "A1" | "A1+" | "A2" | "A2+" | "B1";
export type Confidence = "low" | "medium" | "high";

export interface Entry {
  id: string;
  it: string | null;
  pl: string | null; // null = no translation yet (the LLM fills it after the lesson)
  kind: Kind;
  kind_locked?: boolean; // true when the user picked word/phrase by hand
  pl_source: "user" | "llm" | "dict" | null; // "dict" = picked from the offline dictionary (M3.5)
  created_at: string;
  pos?: string;
  lemma?: string;
  it_original?: string; // spelling before the LLM fixed the accents
  it_suggestion?: string;
  [extra: string]: unknown; // keep any other field the LLM adds
}

export interface Verb {
  id: string;
  it: string;
  pl: string | null;
  tense: "presente";
  forms: Forms | null;
  forms_source: "auto" | "llm" | "user" | null;
  confidence: "high" | "check" | null;
  revealed: Record<Person, boolean>;
  created_at: string;
  [extra: string]: unknown;
}

export interface Lesson {
  id: string;
  date: string | null;
  title: string;
  source: string;
  created_at: string;
  updated_at: string;
  entries: Entry[];
  verbs: Verb[];
  summary?: unknown;
  notes?: unknown;
}

export interface Assessment {
  id: string;
  type: "level_assessment";
  week_start: string | null;
  week_end: string;
  assessed_at: string;
  level: Level;
  progress: number; // 0–100, way from `level` to the next one
  confidence: Confidence;
  summary_pl: string;
  strengths: string[];
  gaps: string[];
  next_week: string[];
  can_do: string[];
  evidence: unknown;
  model: string | null;
}

export interface State {
  schema_version: 1;
  current: string | null;
  lessons: Lesson[];
  assessments: Assessment[];
}
