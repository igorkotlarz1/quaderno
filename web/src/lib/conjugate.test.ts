import { describe, expect, it } from "vitest";
import { conjugate } from "./conjugate";

const f = (v: string) => Object.values(conjugate(v)!.forms).join(" ");

describe("conjugate (presente indicativo)", () => {
  it.each([
    ["parlare", "parlo parli parla parliamo parlate parlano"],
    ["cercare", "cerco cerchi cerca cerchiamo cercate cercano"],
    ["pagare", "pago paghi paga paghiamo pagate pagano"],
    ["mangiare", "mangio mangi mangia mangiamo mangiate mangiano"],
    ["studiare", "studio studi studia studiamo studiate studiano"],
    ["sciare", "scio scii scia sciamo sciate sciano"],
    ["prendere", "prendo prendi prende prendiamo prendete prendono"],
    ["dormire", "dormo dormi dorme dormiamo dormite dormono"],
    ["aprire", "apro apri apre apriamo aprite aprono"],
    ["capire", "capisco capisci capisce capiamo capite capiscono"],
    ["costruire", "costruisco costruisci costruisce costruiamo costruite costruiscono"],
    ["bere", "bevo bevi beve beviamo bevete bevono"],
    ["essere", "sono sei è siamo siete sono"],
    ["porre", "pongo poni pone poniamo ponete pongono"],
    ["chiamarsi", "mi chiamo ti chiami si chiama ci chiamiamo vi chiamate si chiamano"],
  ])("%s", (inf, forms) => {
    expect(f(inf)).toBe(forms);
    expect(conjugate(inf)!.confidence).toBe("high");
  });

  it("marks an unknown -ire verb for checking", () => {
    expect(conjugate("tossire")!.confidence).toBe("check");
  });

  it("returns null for something that is not an infinitive", () => {
    expect(conjugate("casa")).toBeNull();
    expect(conjugate("")).toBeNull();
  });
});
