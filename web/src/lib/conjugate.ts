import type { Forms, Person } from "./types";

export const PERS: Person[] = ["io", "tu", "lui", "noi", "voi", "loro"];
export const PERS_LABEL: Record<Person, string> = { io: "io", tu: "tu", lui: "lui / lei", noi: "noi", voi: "voi", loro: "loro" };

// ~40 irregular verbs, presente indicativo, forms in PERS order.
const IRR: Record<string, string> = {
  essere:"sono sei è siamo siete sono", avere:"ho hai ha abbiamo avete hanno",
  andare:"vado vai va andiamo andate vanno", fare:"faccio fai fa facciamo fate fanno",
  stare:"sto stai sta stiamo state stanno", dare:"do dai dà diamo date danno",
  dire:"dico dici dice diciamo dite dicono", venire:"vengo vieni viene veniamo venite vengono",
  volere:"voglio vuoi vuole vogliamo volete vogliono", potere:"posso puoi può possiamo potete possono",
  dovere:"devo devi deve dobbiamo dovete devono", sapere:"so sai sa sappiamo sapete sanno",
  bere:"bevo bevi beve beviamo bevete bevono", uscire:"esco esci esce usciamo uscite escono",
  rimanere:"rimango rimani rimane rimaniamo rimanete rimangono", tenere:"tengo tieni tiene teniamo tenete tengono",
  piacere:"piaccio piaci piace piacciamo piacete piacciono", salire:"salgo sali sale saliamo salite salgono",
  morire:"muoio muori muore moriamo morite muoiono", scegliere:"scelgo scegli sceglie scegliamo scegliete scelgono",
  sedere:"siedo siedi siede sediamo sedete siedono", porre:"pongo poni pone poniamo ponete pongono",
  tradurre:"traduco traduci traduce traduciamo traducete traducono", produrre:"produco produci produce produciamo producete producono",
  ridurre:"riduco riduci riduce riduciamo riducete riducono", condurre:"conduco conduci conduce conduciamo conducete conducono",
  cucire:"cucio cuci cuce cuciamo cucite cuciono", udire:"odo odi ode udiamo udite odono",
  apparire:"appaio appari appare appariamo apparite appaiono", spegnere:"spengo spegni spegne spegniamo spegnete spengono",
  cogliere:"colgo cogli coglie cogliamo cogliete colgono", togliere:"tolgo togli toglie togliamo togliete tolgono",
  trarre:"traggo trai trae traiamo traete traggono", ottenere:"ottengo ottieni ottiene otteniamo ottenete ottengono",
  mantenere:"mantengo mantieni mantiene manteniamo mantenete mantengono", divenire:"divengo divieni diviene diveniamo divenite divengono",
  riuscire:"riesco riesci riesce riusciamo riuscite riescono", proporre:"propongo proponi propone proponiamo proponete propongono"
};

const ISC = new Set("capire finire preferire pulire spedire costruire restituire suggerire colpire gestire sparire unire impedire inserire obbedire proibire tradire ferire fornire garantire guarire punire reagire riferire stupire trasferire definire diminuire distribuire contribuire agire chiarire condire arrossire dimagrire ingrandire sostituire".split(" "));
const NON_ISC = new Set("dormire partire aprire sentire offrire seguire servire soffrire vestire coprire scoprire fuggire bollire mentire divertire avvertire consentire convertire investire riaprire ripartire".split(" "));
const II_TU = new Set(["sciare", "inviare", "spiare", "avviare", "rinviare"]);
const REFL: Record<Person, string> = { io: "mi", tu: "ti", lui: "si", noi: "ci", voi: "vi", loro: "si" };
const mk = (a: string[]): Forms => Object.fromEntries(PERS.map((p, i) => [p, a[i]])) as Forms;

export interface Conjugation {
  forms: Forms;
  /** "check" = the app is not sure (unknown -ire verb); only these go to the LLM. */
  confidence: "high" | "check";
}

/** Presente indicativo without any API: regular -are/-ere/-ire, -isc, -care/-gare, -iare, -rsi and IRR. */
export function conjugate(raw: string | null): Conjugation | null {
  let inf = (raw || "").trim().toLowerCase();
  if (!inf) return null;
  let refl = false;
  if (/rsi$/.test(inf)) {
    refl = true;
    inf = inf.slice(0, -2) + "e"; // chiamarsi -> chiamare
  }
  let forms: Forms | null = null;
  let confidence: "high" | "check" = "high";
  if (IRR[inf]) forms = mk(IRR[inf].split(" "));
  else if (/are$/.test(inf)) {
    const st = inf.slice(0, -3);
    let stTu = st, stNoi = st;
    if (/[cg]$/.test(st)) { stTu = st + "h"; stNoi = st + "h"; } // cercare: cerchi, cerchiamo
    else if (/i$/.test(st)) { stNoi = st.slice(0, -1); stTu = II_TU.has(inf) ? st : st.slice(0, -1); } // mangiare, studiare
    forms = { io: st + "o", tu: stTu + "i", lui: st + "a", noi: stNoi + "iamo", voi: st + "ate", loro: st + "ano" };
  } else if (/ere$/.test(inf)) {
    const st = inf.slice(0, -3);
    forms = { io: st + "o", tu: st + "i", lui: st + "e", noi: st + "iamo", voi: st + "ete", loro: st + "ono" };
  } else if (/ire$/.test(inf)) {
    const st = inf.slice(0, -3);
    const isc = ISC.has(inf);
    if (!isc && !NON_ISC.has(inf)) confidence = "check";
    forms = isc
      ? { io: st + "isco", tu: st + "isci", lui: st + "isce", noi: st + "iamo", voi: st + "ite", loro: st + "iscono" }
      : { io: st + "o", tu: st + "i", lui: st + "e", noi: st + "iamo", voi: st + "ite", loro: st + "ono" };
  }
  if (!forms) return null;
  if (refl) { const f = forms; forms = mk(PERS.map((p) => REFL[p] + " " + f[p])); }
  return { forms, confidence };
}
