import { useRef, useState } from "react";
import { PERS, PERS_LABEL } from "../lib/conjugate";
import { newVerb, verbsOf } from "../lib/model";
import { useStore } from "../lib/store";
import { clean } from "../lib/text";
import type { Person, Verb } from "../lib/types";
import { applyBacktick } from "./Sheet";
import { useToast } from "./ui";

function Badge({ v }: { v: Verb }) {
  if (!v.forms) return <span className="vbadge wait">czeka na Claude</span>;
  if (v.forms_source === "llm") return <span className="vbadge ok">Claude ✓</span>;
  if (v.forms_source === "user") return <span className="vbadge ok">poprawione</span>;
  if (v.confidence === "check") return <span className="vbadge warn">do sprawdzenia</span>;
  return <span className="vbadge">automat</span>;
}

function VerbCard({ v }: { v: Verb }) {
  const s = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [armed, setArmed] = useState(false);
  const [flipped, setFlipped] = useState<Person | null>(null);
  const shown = PERS.filter((p) => v.revealed?.[p]).length;

  const cell = (p: Person) => {
    const open = v.revealed?.[p];
    const f = v.forms?.[p];
    return (
      <div className={"vcell" + (open && f ? " open" : "") + (flipped === p ? " flip" : "")} data-p={p} key={p}>
        <span className="vpron" lang="it">{PERS_LABEL[p]}</span>
        {open && f ? (
          editing ? (
            <input className="vinput" lang="it" defaultValue={f} aria-label={`Forma dla ${PERS_LABEL[p]}`}
              onChange={(ev) => { applyBacktick(ev.currentTarget); const val = clean(ev.currentTarget.value); if (val) s.update(() => { v.forms![p] = val; v.forms_source = "user"; }); }} />
          ) : <span className="vform" lang="it">{f}</span>
        ) : f ? (
          <button className="vcover" type="button" data-p={p} aria-label={`Odkryj formę dla ${PERS_LABEL[p]}`}
            onClick={() => { setFlipped(p); s.update(() => { v.revealed[p] = true; }); }}>odkryj</button>
        ) : <span className="vempty">—</span>}
      </div>
    );
  };

  function onDelete() {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return; }
    s.update(() => { s.cur.verbs = verbsOf(s.cur).filter((x) => x.id !== v.id); });
    toast("Czasownik usunięty");
  }

  return (
    <article className={"verb" + (editing ? " editing" : "")} data-id={v.id}>
      <header className="vhead">
        <div className="vname">
          <b lang="it">{v.it}</b>
          <input className="vpl" lang="pl" placeholder="znaczenie po polsku" aria-label="Znaczenie po polsku" autoComplete="off"
            defaultValue={v.pl ?? ""} onChange={(ev) => { const val = clean(ev.currentTarget.value); s.update(() => { v.pl = val; }); }} />
        </div>
        <div className="vmeta">
          <Badge v={v} />
          <span className="vprog">{shown}/6 odkryte</span>
          <button className="quiet vedit" type="button" aria-pressed={editing} onClick={() => setEditing(!editing)}>{editing ? "Gotowe" : "Popraw"}</button>
          <button className={"quiet vdel" + (armed ? " danger" : "")} type="button" aria-label="Usuń czasownik" onClick={onDelete}>
            {armed ? "Na pewno usunąć?" : "Usuń"}
          </button>
        </div>
      </header>
      <div className="vgrid">
        <div className="vcol"><h3>liczba pojedyncza</h3>{(["io", "tu", "lui"] as Person[]).map(cell)}</div>
        <div className="vcol"><h3>liczba mnoga</h3>{(["noi", "voi", "loro"] as Person[]).map(cell)}</div>
      </div>
    </article>
  );
}

export function Verbs() {
  const s = useStore();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const vs = verbsOf(s.cur);

  function addVerb() {
    const el = input.current!;
    const val = clean(el.value);
    if (!val) { el.focus(); return; }
    if (vs.some((v) => v.it.toLowerCase() === val.toLowerCase())) { toast("Ten czasownik już jest w tej lekcji"); return; }
    const v = newVerb(val);
    s.update(() => { verbsOf(s.cur).push(v); });
    el.value = "";
    el.focus();
    toast(v.forms ? (v.confidence === "check" ? "Dodano. Odmiana do sprawdzenia przez Claude" : "Dodano. Odkrywaj formy kliknięciem") : "Dodano. Odmianę uzupełni Claude z promptu");
  }

  return (
    <section className="verbsec" aria-labelledby="v-title">
      <div className="vtop">
        <div><h2 id="v-title">Czasowniki</h2><p>Wpisz bezokolicznik. Formy są zakryte, klikasz, żeby je odkryć.</p></div>
        <div className="vadd">
          <label className="field"><span>Bezokolicznik</span>
            <input id="v-new" ref={input} lang="it" placeholder="np. bere, parlare, capire" autoComplete="off" autoCapitalize="off" spellCheck={false}
              onChange={(ev) => applyBacktick(ev.currentTarget)}
              onKeyDown={(ev) => { if (ev.key === "Enter" && !ev.nativeEvent.isComposing) { ev.preventDefault(); addVerb(); } }} />
          </label>
          <button className="primary" id="v-add" type="button" onClick={addVerb}>Dodaj</button>
        </div>
      </div>
      <p id="verbs-empty" className="vempty-state" hidden={vs.length > 0}>
        W tej lekcji nie ma jeszcze czasowników. Spróbuj <code>bere</code>, <code>parlare</code> albo <code>capire</code>.
      </p>
      <div id="verbs" className="verbs">
        {vs.slice().reverse().map((v) => <VerbCard v={v} key={`${s.rev}-${v.id}`} />)}
      </div>
    </section>
  );
}
