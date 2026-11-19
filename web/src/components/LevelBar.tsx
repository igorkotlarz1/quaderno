import { useEffect, useState } from "react";
import { assessmentDue, CONF, lastAsm, LEVELS, LVL_NEXT, sortedAsm } from "../lib/level";
import { useStore } from "../lib/store";
import { fmtDay } from "../lib/text";

/** CEFR bar A1 → B1 at the very top; the current level fills up to `progress` %. */
export function LevelBar({ openWeek, forceOpen }: { openWeek: () => void; forceOpen: number }) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [fill, setFill] = useState(0); // starts at 0 and animates to the real value
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);

  const la = lastAsm(state);
  const lv = la ? la.level : "A1";
  const pr = la ? la.progress : 0;
  const idx = LEVELS.indexOf(lv);
  const due = assessmentDue(state);
  const total = (idx * 100 + fill) / LEVELS.length; // % of the whole scale
  useEffect(() => { const t = requestAnimationFrame(() => setFill(pr)); return () => cancelAnimationFrame(t); }, [pr, lv]);

  const sub = la
    ? lv === "B1" ? `B1 · ${pr}% drogi przez B1` : `${pr}% drogi do ${LVL_NEXT[lv]} · ${CONF[la.confidence]}`
    : "start · pierwsza ocena po tygodniu lekcji";
  const list = (title: string, items: string[]) =>
    items.length ? <div><h3>{title}</h3><ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null;

  return (
    <section className="lvl" id="lvl" aria-label="Poziom włoskiego" data-enter="1">
      <div className="lvl-top">
        <div className="lvl-now"><b id="lvl-name">{lv}</b><span id="lvl-sub">{sub}</span></div>
        <div className="lvl-side">
          <span id="lvl-date">
            {la ? `ocena z ${fmtDay(la.week_end)}` : ""}
            {due && <>{la ? " · " : ""}<span className="lvl-due">czas na ocenę tygodnia</span></>}
          </span>
          <button type="button" id="lvl-toggle" aria-expanded={open} aria-controls="lvl-more" onClick={() => setOpen(!open)}>
            {open ? "Zwiń" : "Szczegóły"}
          </button>
        </div>
      </div>
      <div className="lvl-track" id="lvl-track" role="meter" aria-label="Postęp poziomu" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.round((idx * 100 + pr) / LEVELS.length)} aria-valuetext={`${lv}, ${pr}% do kolejnego poziomu`}>
        {/* one "vial": red liquid fills the whole A1 → B1 scale, ticks mark each level */}
        <div className="vial">
          <i className="vial-fill" style={{ width: `max(20px, calc(${total}% - 6px))` }} />
          {[1, 2, 3, 4].map((k) => <span className="vial-tick" key={k} style={{ left: `${k * 20}%` }} />)}
        </div>
        <div className="vial-lbl">
          {LEVELS.map((L, i) => <span key={L} className={i < idx ? "done" : i === idx ? "now" : ""}>{L}</span>)}
        </div>
      </div>
      <div className="lvl-more" id="lvl-more" hidden={!open}>
        {!la ? (
          <>
            <p>Pasek pokazuje szacunek Claude według skali CEFR (A1 → B1), robiony raz w tygodniu na podstawie Twoich lekcji. Pierwszą ocenę zrobisz w zakładce <b>Ocena tygodnia</b> na dole strony.</p>
            <div className="btns"><button type="button" className="primary" id="lvl-go" onClick={openWeek}>Przejdź do oceny tygodnia</button></div>
          </>
        ) : (
          <>
            {la.summary_pl && <p>{la.summary_pl}</p>}
            <div className="lvl-cols">
              {list("Umiesz już", la.can_do.length ? la.can_do : la.strengths)}
              {list("Do poprawy", la.gaps)}
              {list("Plan na tydzień", la.next_week)}
            </div>
            <div className="lvl-hist">Historia: {sortedAsm(state).slice(-8).map((a) => (
              <span key={a.id} title={a.summary_pl}>{fmtDay(a.week_end)} · {a.level} {a.progress}%</span>
            ))}</div>
            <div className="btns">
              <button type="button" id="lvl-go" onClick={openWeek}>{due ? "Zrób ocenę tego tygodnia" : "Otwórz ocenę tygodnia"}</button>
              <span className="keys">To szacunek z notatek, nie egzamin.</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
