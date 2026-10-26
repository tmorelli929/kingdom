"use client";
import { useEffect, useRef, useState } from "react";
import { api, streamCoach } from "../api";
import { useApp } from "../App";
import { Md } from "../ui";

type Msg = { role: "user" | "assistant"; content: string };
const QUICK = ["What does today look like?", "When can I fit in time this week?", "Who should I reach out to?", "How is my training going?"];

// Ask questions about your own data. Answers use only what's in the dashboard and say when something isn't there.
export default function Assistant() {
  const { pendingAsk, clearAsk, go } = useApp();
  const [chat, setChat] = useState<Msg[]>([]);
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ chat: Msg[]; configured: boolean }>("/api/coach").then((r) => { setChat(r.chat.slice(-6)); setConfigured(r.configured); }).catch(() => {});
  }, []);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [chat]);

  const ask = async (q: string) => {
    if (busy || !q.trim()) return;
    setBusy(true);
    setInput("");
    setChat((c) => [...c, { role: "user", content: q.trim() }, { role: "assistant", content: "…" }]);
    const setLast = (t: string) => setChat((c) => [...c.slice(0, -1), { role: "assistant", content: t }]);
    try { await streamCoach({ mode: "chat", message: q.trim() }, setLast); }
    catch (e) { setLast(e instanceof Error ? e.message : "The assistant couldn't answer."); }
    setBusy(false);
  };

  useEffect(() => {
    if (pendingAsk) { clearAsk(); ask(pendingAsk); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAsk]);

  return (
    <section className="card stack-s">
      <div className="card-head"><h2>Ask</h2>{chat.length > 0 && <button className="btn ghost sm" onClick={async () => { await api("/api/account", "PATCH", { clear: "coach" }); setChat([]); }}>Clear</button>}</div>
      {!configured ? (
        <p className="small muted">The assistant needs an Anthropic API key before it can answer. Everything else works without it.</p>
      ) : (
        <>
          {chat.length > 0 && (
            <div className="chat" ref={box} aria-live="polite">
              {chat.map((m, i) => <div key={i} className={`msg ${m.role === "user" ? "user" : "coach"}`}>{m.role === "user" ? m.content : <Md text={m.content} />}</div>)}
            </div>
          )}
          <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <textarea className="in" id="ask-in" rows={1} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your schedule, training, habits or people…"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }} />
            <button className="btn primary" type="submit" disabled={busy || !input.trim()}>Ask</button>
          </form>
          {chat.length === 0 && <div className="chips">{QUICK.map((q) => <button key={q} className="chip" disabled={busy} onClick={() => ask(q)}>{q}</button>)}</div>}
          <p className="small faint">Answers use only your dashboard data and say when something isn&apos;t there. Choose what it can see in <button className="linkish" onClick={() => go("setup")}>Settings</button>.</p>
        </>
      )}
    </section>
  );
}
