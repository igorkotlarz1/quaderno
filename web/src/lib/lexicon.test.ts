import { describe, expect, it } from "vitest";
import { accentKey, Lexicon, normalize, type Bundle } from "./lexicon";

describe("normalize (same cases as server/tests/test_lexicon.py)", () => {
  it.each([
    ["  La Finestra! ", "finestra"],
    ["l’amico", "amico"],
    ["un'amica", "amica"],
    ["po'", "po'"],
    ["la", "la"],
    ["Gli occhi", "occhi"],
    ["perché?", "perché"],
    ["essere sano di mente", "essere sano di mente"],
  ])("%s → %s", (typed, expected) => expect(normalize(typed)).toBe(expected));

  it("drops accents for the fallback key", () => {
    expect(accentKey("perché")).toBe("perche");
    expect(accentKey("città")).toBe("citta");
  });
});

// Made-up, tiny bundle in the shape /api/lexicon/bundle returns.
const bundle: Bundle = {
  version: "test", built_at: "2026-11-19T00:00:00Z", top: 100, sources: [],
  lemmas: [
    ["essere", "verb", 1, ["być", "istnieć"]],
    ["finestra", "noun", 2, ["okno"]],
    ["sonare", "verb", 3, ["dzwonić", "grać"]],
    ["città", "noun", 4, ["miasto"]],
  ],
  forms: { "è": [0], sono: [0, 2], essere: [0], finestra: [1], finestre: [1], "città": [3] },
};
const lex = new Lexicon(bundle);

describe("Lexicon", () => {
  it("finds the lemma of an inflected form with its article", () => {
    expect(lex.lookup("Le finestre").map((h) => h.lemma)).toEqual(["finestra"]);
    expect(lex.suggest("le finestre")).toEqual(["okno"]);
  });
  it("matches words typed without accents", () => {
    expect(lex.suggest("citta")).toEqual(["miasto"]);
    expect(lex.lookup("e").map((h) => h.lemma)).toEqual(["essere"]);
  });
  it("orders ambiguous forms by frequency and caps the chips at three", () => {
    expect(lex.lookup("sono").map((h) => h.lemma)).toEqual(["essere", "sonare"]);
    expect(lex.suggest("sono")).toEqual(["być", "istnieć", "dzwonić"]);
  });
  it("knows nothing about unknown or empty input", () => {
    expect(lex.suggest("xyzzy")).toEqual([]);
    expect(lex.suggest("")).toEqual([]);
    expect(lex.suggest(null)).toEqual([]);
  });
});
