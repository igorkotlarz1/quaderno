import { useState } from "react";
import { filled, newEntry, newLesson } from "../lib/model";
import { useStore } from "../lib/store";
import { useToast } from "./ui";

/** Lesson title and date under the masthead. */
export function LessonBar() {
  const s = useStore();
  const toast = useToast();
  const l = s.cur;
  return (
    <section className="bar" aria-label="Lekcja" data-enter="2">
      <label className="field f-title"><span>Temat lekcji</span>
        <input type="text" id="l-title" key={`t-${s.rev}-${l.id}`} placeholder="np. Przymiotniki i przeczenie" defaultValue={l.title}
          onChange={(ev) => { const v = ev.currentTarget.value.trim(); s.update(() => { l.title = v; }); }}
          onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); const f = l.entries[0]; if (f) document.getElementById("it-" + f.id)?.focus(); } }} />
      </label>
      <label className="field f-date"><span>Data</span>
        <input type="date" id="l-date" value={l.date ?? ""} onChange={(ev) => { const v = ev.currentTarget.value || null; s.update(() => { l.date = v; }); }} />
      </label>
      <button className="primary" id="new-lesson" type="button" onClick={() => {
        const nl = newLesson(); nl.entries.push(newEntry());
        s.update((st) => { st.lessons.push(nl); st.current = nl.id; }, { reset: true });
        document.getElementById("l-title")?.focus();
        toast("Nowa lekcja z dzisiejszą datą");
      }}>Nowa lekcja</button>
    </section>
  );
}

/** Lesson picker and delete with a confirm step. */
export function Footer() {
  const s = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const sorted = [...s.state.lessons].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return (
    <footer className="bar foot">
      <label className="field f-all"><span>Wszystkie lekcje</span>
        <select id="l-select" value={s.state.current ?? ""} onChange={(ev) => {
          const id = ev.currentTarget.value;
          s.update((st) => { st.current = id; if (!s.cur.entries.length) s.cur.entries.push(newEntry()); }, { reset: true, touch: false });
          setConfirm(false);
        }}>
          {sorted.map((x) => <option key={x.id} value={x.id}>{`${x.date || "bez daty"} · ${x.title || "bez nazwy"} (${filled(x).length})`}</option>)}
        </select>
      </label>
      <span id="del-wrap">
        {!confirm ? (
          <button className="quiet" id="del-lesson" type="button" onClick={() => setConfirm(true)}>Usuń lekcję</button>
        ) : (
          <span className="confirm">Usunąć tę lekcję ({filled(s.cur).length} pozycji)?{" "}
            <button className="danger" id="del-yes" type="button" onClick={() => {
              s.update((st) => {
                st.lessons = st.lessons.filter((x) => x.id !== st.current);
                if (!st.lessons.length) st.lessons.push(newLesson());
                st.current = st.lessons[st.lessons.length - 1].id;
                if (!s.cur.entries.length) s.cur.entries.push(newEntry());
              }, { reset: true, now: true, touch: false });
              setConfirm(false);
              toast("Lekcja usunięta");
            }}>Tak, usuń</button>
            <button id="del-no" type="button" onClick={() => setConfirm(false)}>Nie</button>
          </span>
        )}
      </span>
    </footer>
  );
}
