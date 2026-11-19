import { forwardRef, useRef, useState } from "react";
import { weekPayload, weekWindow } from "../lib/level";
import { exportAll, filled, importJson, newEntry, parseNotes, verbsOf } from "../lib/model";
import { lessonPrompt, weekPrompt } from "../lib/prompts";
import { useStore } from "../lib/store";
import { clean, fmtDay, plw, today } from "../lib/text";
import { copyText, useToast } from "./ui";

/** Four folded "index tabs": LLM prompt, weekly level, paste old notes, export/import. */
export const Tools = forwardRef<HTMLDetailsElement, { onLevelImported: () => void }>(function Tools({ onLevelImported }, weekRef) {
  const s = useStore();
  const toast = useToast();
  const promptOut = useRef<HTMLTextAreaElement>(null);
  const weekOut = useRef<HTMLTextAreaElement>(null);
  const expOut = useRef<HTMLTextAreaElement>(null);
  const [notes, setNotes] = useState("");
  const pasteIn = useRef<HTMLTextAreaElement>(null);
  const impIn = useRef<HTMLTextAreaElement>(null);
  const [expText, setExpText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const { start, end } = weekWindow(s.state);
  const weekLessons = s.state.lessons.filter((l) => (l.date || "") >= start && (l.date || "") <= end && (filled(l).length || verbsOf(l).length)).length;
  const refreshExport = () => { const t = JSON.stringify(exportAll(s.state), null, 2); setExpText(t); return t; };

  function doImport(text: string) {
    const r = importJson(s.state, text);
    if (!r.ok) { toast(r.error); return; }
    s.update(() => {}, { reset: true, now: true, touch: false });
    if (!r.lastId) {
      onLevelImported();
      toast(r.assessments === 1 ? "Nowa ocena poziomu zapisana" : `Zapisano ${r.assessments} ocen poziomu`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else toast(`Import: ${r.added} nowych, ${r.replaced} zaktualizowanych lekcji`);
  }

  // Downloads do not work inside an embedded frame (e.g. a preview), so the button hides there.
  const framed = (() => { try { return window.self !== window.top; } catch { return true; } })();

  return (
    <section className="tools" aria-label="Narzędzia">
      <details className="tool" id="t-llm">
        <summary><b>Uzupełnij z Claude</b><small>Prompt z tą lekcją, po zajęciach</small></summary>
        <div className="body">
          <p>Kopiuje gotowy prompt z tą lekcją w JSON. Wklej go do Claude, a odpowiedź (sam JSON) wklej w „Eksport i import”. Pozycje uzupełnione przez model dostaną znacznik <code>pl_source: "llm"</code>.</p>
          <div className="btns"><button className="primary" id="copy-prompt" type="button" onClick={() => copyText(lessonPrompt(s.cur), toast, promptOut.current)}>Kopiuj prompt</button></div>
          <textarea id="prompt-out" ref={promptOut} readOnly aria-label="Prompt dla LLM" hidden />
        </div>
      </details>

      <details className="tool" id="t-week" ref={weekRef}>
        <summary><b>Ocena tygodnia</b><small>Claude szacuje Twój poziom A1 → B1</small></summary>
        <div className="body">
          <p>Na koniec tygodnia skopiuj prompt: zawiera słówka, zdania i czasowniki z ostatnich 7 dni, statystyki całości i poprzednią ocenę. Odpowiedź Claude (sam JSON) wklej w „Eksport i import”, a pasek na górze się zaktualizuje.</p>
          <label className="field"><span>Co jeszcze robiłeś w tym tygodniu (opcjonalnie)</span>
            <textarea className="wk" id="wk-notes" value={notes} onChange={(ev) => setNotes(ev.currentTarget.value)}
              placeholder="np. zadanie domowe z przeczeniem zrobione bez błędów, rozmowa 10 min o rodzinie, trudność: rodzajniki" />
          </label>
          <div className="btns">
            <button className="primary" id="wk-prompt" type="button" onClick={() => copyText(weekPrompt(weekPayload(s.state, clean(notes))), toast, weekOut.current)}>Kopiuj prompt oceny</button>
            <span className="keys" id="wk-info">Okres: {fmtDay(start)} – {fmtDay(end)} · lekcji: {weekLessons}</span>
          </div>
          <textarea id="wk-out" ref={weekOut} readOnly aria-label="Prompt oceny tygodnia" hidden />
        </div>
      </details>

      <details className="tool" id="t-paste">
        <summary><b>Wklej stare notatki</b><small>Tekst z zeszytu, po linii na słowo</small></summary>
        <div className="body">
          <p>Jedna pozycja na linię. Separator: <code>-</code>, <code>–</code>, <code>=</code>, <code>|</code>, <code>:</code> albo tabulator. Linia bez separatora trafia jako włoski z polskim NULL. Dodaje do bieżącej lekcji.</p>
          <textarea id="paste-in" aria-label="Notatki do wklejenia" ref={pasteIn}
            placeholder={"la casa - dom\nvecchio – stary\nNon sono stanco.  = Nie jestem zmęczony.\ndolce"} />
          <div className="btns"><button className="primary" id="paste-go" type="button" onClick={() => {
            const rows = parseNotes(pasteIn.current!.value);
            if (!rows.length) { toast("Najpierw wklej notatki"); return; }
            s.update(() => {
              const list = s.cur.entries, last = list[list.length - 1];
              if (last && !last.it && !last.pl) list.pop();
              list.push(...rows, newEntry());
            }, { reset: true });
            pasteIn.current!.value = "";
            toast(`Dodano ${plw(rows.length, "pozycję", "pozycje", "pozycji")}`);
          }}>Dodaj do lekcji</button></div>
        </div>
      </details>

      <details className="tool" id="t-export" onToggle={refreshExport}>
        <summary><b>Eksport i import</b><small>Kopia JSON po każdej lekcji</small></summary>
        <div className="body">
          <p>Dane są w pamięci tej przeglądarki (localStorage). Po każdej lekcji skopiuj albo pobierz eksport. Import przyjmuje cały eksport albo pojedynczą lekcję; lekcja o tym samym <code>id</code> zostaje podmieniona.</p>
          <div className="btns">
            <button className="primary" id="exp-copy" type="button" onClick={() => copyText(refreshExport(), toast, expOut.current)}>Kopiuj JSON</button>
            {!framed && <button id="exp-dl" type="button" onClick={() => {
              const blob = new Blob([refreshExport()], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob); a.download = `quaderno_${today()}.json`;
              document.body.appendChild(a); a.click(); a.remove();
            }}>Pobierz .json</button>}
            <button id="imp-file-btn" type="button" onClick={() => fileInput.current?.click()}>Import z pliku</button>
            <input type="file" id="imp-file" ref={fileInput} accept="application/json,.json" hidden onChange={(ev) => {
              const f = ev.currentTarget.files?.[0]; if (!f) return;
              const r = new FileReader(); r.onload = () => doImport(String(r.result)); r.readAsText(f); ev.currentTarget.value = "";
            }} />
          </div>
          <textarea id="exp-out" ref={expOut} readOnly aria-label="Eksport JSON" value={expText} />
          {/* uncontrolled on purpose: the click reads the field directly, so paste + immediate click never sees a stale value */}
          <textarea id="imp-in" ref={impIn} aria-label="JSON do importu" placeholder="Wklej tu JSON (eksport albo odpowiedź Claude)" />
          <div className="btns"><button className="primary" id="imp-go" type="button" onClick={() => { const el = impIn.current!; doImport(el.value); el.value = ""; }}>Importuj wklejony JSON</button></div>
        </div>
      </details>
    </section>
  );
});
