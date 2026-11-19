import { useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { newEntry } from "../lib/model";
import { useStore } from "../lib/store";
import { clean, fixBacktick, kindOf } from "../lib/text";
import type { Entry } from "../lib/types";
import { setNativeValue, useToast } from "./ui";

const ACCENTS = ["à", "è", "é", "ì", "ò", "ù", "È", "À"];
type Col = "it" | "pl";

/** Remember the last text field the user was in, so the accent palette can type into it. */
let lastField: HTMLInputElement | HTMLTextAreaElement | null = null;
if (typeof document !== "undefined") {
  document.addEventListener("focusin", (ev) => {
    const t = ev.target as HTMLElement;
    if (t.matches?.('input[type="text"], .row input, #v-new, .vpl, .vinput, textarea:not([readonly])')) lastField = t as HTMLInputElement;
  });
}

/** Apply e` → è in place; used by every Italian text field. */
export function applyBacktick(el: HTMLInputElement) {
  const r = fixBacktick(el.value, el.selectionStart ?? el.value.length);
  if (r) { el.value = r.value; el.setSelectionRange(r.caret, r.caret); }
}

export function Sheet() {
  const s = useStore();
  const toast = useToast();
  const l = s.cur;
  const focus = useRef<{ id: string; col: Col } | null>(null);
  const fresh = useRef<string | null>(null);

  // After React has drawn the rows, move the caret where the keyboard logic asked for.
  useLayoutEffect(() => {
    const f = focus.current;
    if (!f) return;
    focus.current = null;
    const el = document.getElementById(`${f.col}-${f.id}`) as HTMLInputElement | null;
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });

  const idx = (id: string) => l.entries.findIndex((e) => e.id === id);
  const focusField = (id: string, col: Col) => (document.getElementById(`${col}-${id}`) as HTMLInputElement | null)?.focus();

  function addRowAfter(id?: string) {
    const e = newEntry();
    fresh.current = e.id;
    focus.current = { id: e.id, col: "it" };
    s.update(() => { const i = id ? idx(id) : l.entries.length - 1; l.entries.splice(i + 1, 0, e); });
  }
  function removeRow(id: string) {
    const i = idx(id);
    if (i < 0) return;
    s.update(() => {
      l.entries.splice(i, 1);
      if (l.entries.length === 0) l.entries.push(newEntry());
      focus.current = { id: l.entries[Math.max(0, i - 1)].id, col: i === 0 ? "it" : "pl" };
    });
  }

  function onInput(e: Entry, col: Col, el: HTMLInputElement) {
    applyBacktick(el);
    s.update(() => {
      if (col === "it") { e.it = clean(el.value); if (!e.kind_locked) e.kind = kindOf(e.it); }
      else { e.pl = clean(el.value); e.pl_source = e.pl ? "user" : null; }
    });
  }

  function onKey(ev: KeyboardEvent<HTMLInputElement>, e: Entry, col: Col) {
    const i = idx(e.id);
    const list = l.entries;
    if (ev.key === "Enter" && !ev.nativeEvent.isComposing) {
      ev.preventDefault();
      if (ev.ctrlKey || ev.metaKey) return addRowAfter(e.id);
      if (col === "it") return focusField(e.id, "pl");
      const next = list[i + 1];
      if (next) return focusField(next.id, "it");
      if (!e.it && !e.pl) return;
      addRowAfter(e.id);
    } else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      const t = list[i + (ev.key === "ArrowDown" ? 1 : -1)];
      if (!t) return;
      ev.preventDefault();
      focusField(t.id, col);
    } else if (ev.key === "Backspace" && ev.currentTarget.value === "") {
      if (col === "pl") { ev.preventDefault(); return focusField(e.id, "it"); }
      if (!e.it && !e.pl && list.length > 1) { ev.preventDefault(); removeRow(e.id); }
    }
  }

  function onAdd() {
    const last = l.entries[l.entries.length - 1];
    if (last && !last.it && !last.pl) return focusField(last.id, "it");
    addRowAfter(last?.id);
  }

  function onAccent(ev: MouseEvent<HTMLButtonElement>, ch: string) {
    const f = lastField;
    if (f && f.isConnected) {
      const a = f.selectionStart ?? f.value.length, z = f.selectionEnd ?? a;
      setNativeValue(f, f.value.slice(0, a) + ch + f.value.slice(z));
      f.focus();
      f.setSelectionRange(a + ch.length, a + ch.length);
    }
    const b = ev.currentTarget;
    b.classList.add("hit");
    setTimeout(() => b.classList.remove("hit"), 220);
    navigator.clipboard?.writeText(ch).then(() => toast(`${ch} wstawione i skopiowane`), () => toast(`${ch} wstawione`));
  }

  return (
    <section className="sheet" aria-label="Słówka" data-enter="3">
      <div className="head"><span>nr</span><span>italiano</span><span>polski</span><span style={{ textAlign: "center" }}>typ</span><span></span></div>
      <div id="rows">
        {l.entries.map((e, i) => (
          <div className={"row" + (e.id === fresh.current ? " fresh" : "")} data-id={e.id} key={`${s.rev}-${e.id}`}>
            <span className="n">{i + 1}</span>
            <input className={"it" + (e.it_original ? " fixed" : "")} id={`it-${e.id}`} lang="it" autoComplete="off" autoCapitalize="off" spellCheck={false}
              placeholder="po włosku" aria-label={`Włoski, wiersz ${i + 1}`} defaultValue={e.it ?? ""}
              title={e.it_original ? `Claude poprawił z: ${e.it_original}` : undefined}
              onChange={(ev) => onInput(e, "it", ev.currentTarget)} onKeyDown={(ev) => onKey(ev, e, "it")} />
            <input className={"pl" + (e.it && !e.pl ? " isnull" : "")} id={`pl-${e.id}`} lang="pl" autoComplete="off" spellCheck={false}
              placeholder="brak tłumaczenia" aria-label={`Polski, wiersz ${i + 1}`} defaultValue={e.pl ?? ""}
              onChange={(ev) => onInput(e, "pl", ev.currentTarget)} onKeyDown={(ev) => onKey(ev, e, "pl")} />
            <button className="kind" type="button" data-k={e.kind} title="Słowo czy zdanie? Kliknij, żeby zmienić"
              onClick={() => s.update(() => { e.kind = e.kind === "word" ? "phrase" : "word"; e.kind_locked = true; })}>
              {e.kind === "phrase" ? "zdanie" : "słowo"}
            </button>
            <button className="del" type="button" aria-label={`Usuń wiersz ${i + 1}`} onClick={() => removeRow(e.id)}>✕</button>
          </div>
        ))}
      </div>
      <div className="add">
        <button className="primary" id="add" type="button" onClick={onAdd}>+ Dodaj wiersz</button>
        <span className="keys"><span><kbd>Enter</kbd> nowy wiersz</span><span><kbd>↑</kbd><kbd>↓</kbd></span><span><kbd>Backspace</kbd> usuwa</span></span>
      </div>
      <div className="accents" aria-label="Akcenty">
        <span title="Kliknij: wstawia w pole i kopiuje">Akcenty</span>
        {/* mousedown preventDefault keeps the caret in the text field */}
        <div className="acc" id="acc" onMouseDown={(ev) => { if ((ev.target as HTMLElement).closest("button")) ev.preventDefault(); }}>
          {ACCENTS.map((ch) => <button type="button" key={ch} onClick={(ev) => onAccent(ev, ch)}>{ch}</button>)}
        </div>
        <span><kbd>e`</kbd> → è</span>
      </div>
    </section>
  );
}

