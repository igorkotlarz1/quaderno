import { lastAsm } from "../lib/level";
import { filled } from "../lib/model";
import { useStore } from "../lib/store";
import { plw } from "../lib/text";

function ItalianDate({ date }: { date: string | null }) {
  if (!date) return <h1 className="date-it" id="l-display">lezione senza data</h1>;
  const dt = new Date(date + "T12:00:00");
  // formatToParts lets us colour only the day number red: "giovedì <span>19</span> novembre"
  const parts = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).formatToParts(dt);
  return (
    <h1 className="date-it" id="l-display">
      {parts.map((p, i) => (p.type === "day" ? <span key={i}>{p.value}</span> : p.value))}
    </h1>
  );
}

export function Masthead() {
  const store = useStore();
  const l = store.cur;
  const es = filled(l);
  const nulls = es.filter((e) => e.it && !e.pl).length;
  const words = es.filter((e) => e.kind === "word").length;
  const phr = es.length - words;
  const lv = lastAsm(store.state)?.level ?? "A1";
  const datePl = l.date
    ? new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(l.date + "T12:00:00"))
    : "ustaw datę lekcji";

  return (
    <header className="mast" data-enter="1">
      <div>
        <div className="eyebrow"><b>Quaderno</b><span id="eyebrow-lvl">italiano · {lv}</span></div>
        <ItalianDate date={l.date} />
        <div className="date-pl" id="l-display-pl">{datePl}</div>
      </div>
      <div className="counts" id="stats" aria-live="polite">
        <div className="count"><b>{es.length}</b><small>{plw(words, "słowo", "słowa", "słów")} · {plw(phr, "zdanie", "zdania", "zdań")}</small></div>
        {nulls ? (
          <div className="count todo"><b>{nulls}</b><small>do przetłumaczenia</small></div>
        ) : es.length ? (
          <div className="count done"><b>✓</b><small>wszystko przetłumaczone</small></div>
        ) : null}
        {!store.storageOk && <div className="count warn"><b>!</b><small>zapis lokalny nie działa, zrób eksport</small></div>}
      </div>
    </header>
  );
}
