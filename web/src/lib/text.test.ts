import { describe, expect, it } from "vitest";
import { clean, fixBacktick, kindOf, plw, waiting } from "./text";

describe("text helpers", () => {
  it("clean collapses spaces and turns empty into null", () => {
    expect(clean("  la   casa ")).toBe("la casa");
    expect(clean("   ")).toBeNull();
  });
  it("kindOf: article + noun is a word, a sentence is a phrase", () => {
    expect(kindOf("la casa")).toBe("word");
    expect(kindOf("l'amico")).toBe("word");
    expect(kindOf("Non sono stanco.")).toBe("phrase");
    expect(kindOf("molto bene grazie")).toBe("phrase");
  });
  it("fixBacktick turns e` into è and keeps the caret", () => {
    expect(fixBacktick("caffe`", 6)).toEqual({ value: "caffè", caret: 5 });
    expect(fixBacktick("casa", 4)).toBeNull();
  });
  it("plw picks the Polish plural", () => {
    expect(plw(1, "słowo", "słowa", "słów")).toBe("1 słowo");
    expect(plw(3, "słowo", "słowa", "słów")).toBe("3 słowa");
    expect(plw(12, "słowo", "słowa", "słów")).toBe("12 słów");
    expect(plw(22, "słowo", "słowa", "słów")).toBe("22 słowa");
  });
});

describe("waiting (Polish plural)", () => {
  it("picks the right form", () => {
    expect([1, 2, 4, 5, 12, 22, 25].map(waiting)).toEqual([
      "1 lekcja czeka", "2 lekcje czekają", "4 lekcje czekają", "5 lekcji czeka", "12 lekcji czeka", "22 lekcje czekają", "25 lekcji czeka",
    ]);
  });
});
