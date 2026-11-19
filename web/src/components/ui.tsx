import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

/* ---------- toast ---------- */

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m); setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), 2200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className={"toast" + (on ? " on" : "")} id="toast" role="status" aria-live="polite">{msg}</div>
    </ToastCtx.Provider>
  );
}

/* ---------- clipboard ---------- */

/** Copy to clipboard; if the browser refuses, show the text in a textarea and select it. */
export async function copyText(text: string, toast: (m: string) => void, fallback?: HTMLTextAreaElement | null) {
  try { await navigator.clipboard.writeText(text); toast("Skopiowano do schowka"); }
  catch {
    if (fallback) { fallback.hidden = false; fallback.value = text; fallback.focus(); fallback.select(); }
    toast("Zaznaczone – skopiuj Ctrl+C");
  }
}

/** Set an input's value so that React's onChange still fires (used by the accent palette). */
export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
