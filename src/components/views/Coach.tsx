"use client";
import { useEffect, useRef, useState } from "react";
import { signals } from "@/lib/life/scoring";
import { api, streamCoach } from "../api";
import { useApp } from "../App";
import { Md } from "../ui";

type Msg = { role: "user" | "assistant"; content: string };
const QUICK = [
  "Help me plan my week.",
  "What am I neglecting?",
  "What should I focus on tonight?",
  "How am I doing compared to last month?",
  "Who should I reconnect with this week?",
  "Which mentors haven't I spoken to recently?",
];
const TONE: Record<string, string> = { warn: "var(--warn)", info: "var(--blue)", gold: "var(--gold)", good: "var(--green)" };

export default function Coach() {
  const { doc, today, pendingAsk, clearAsk, go } = useApp();
  const [chat, setChat] = useState<Msg[]>([]);
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ chat: Msg[]; configured: boolean }>("/api/coach").then((r) => { setChat(r.chat); setConfigured(r.configured); }).catch(() => {});
  }, []);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [chat]);

  const ask = async (q: string) => {
    if (busy || !q.trim()) return;
    setBusy(true);
    setInput("");
    setChat((c) => [...c, { role: "user", content: q.trim() }, { role: "assistant", content: "…" }]);
    const setLast = (t: string) => setChat((c) => [...c.slice(0, -1), { role: "assistant", content: t }]);
    try { await streamCoach({ mode: "chat", message: q.trim() }, setLast); }
    catch (e) { setLast(e instanceof Error ? e.message : "The coach couldn't answer."); }
    setBusy(false);
  };

  // A question handed over from another tab (e.g. "Prepare me for my coffee with Sam").
  useEffect(() => {
    if (pendingAsk) { clearAsk(); ask(pendingAsk); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAsk]);

  return (
    <>
      <section className="hero single stack-s">
        <span className="eyebrow">Coach</span>
        <h1>Honest counsel, grounded in your week</h1>
        <p className="muted small">The coach sees your areas, quests, missions, reflections, calendar note and the people you&apos;ve shared with it. It labels what comes from your entries, your reflections and its own read. Control what it sees in <button className="btn ghost sm" onClick={() => go("setup")}>Setup</button></p>
      </section>
      {!configured && <section className="card"><p style={{ color: "var(--warn)" }}>The coach isn&apos;t set up yet. Add an Anthropic API key as <code>ANTHROPIC_API_KEY</code> in your hosting settings. Everything else works without it.</p></section>}
      <section className="card">
        <div className="chat" ref={box} aria-live="polite">
          {chat.length ? chat.map((m, i) => <div key={i} className={`msg ${m.role === "user" ? "user" : "coach"}`}>{m.role === "user" ? m.content : <Md text={m.content} />}</div>)
            : <div className="empty">Ask anything, or start with one of the questions below.</div>}
        </div>
        <div className="btns">{QUICK.map((q) => <button key={q} className="btn ghost sm" disabled={busy} onClick={() => ask(q)}>{q}</button>)}</div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
          <textarea className="in" id="ask-in" rows={2} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask your coach…"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }} />
          <button className="btn primary" type="submit" disabled={busy || !input.trim()}>Send</button>
        </form>
        {chat.length > 0 && <div><button className="btn ghost sm" onClick={async () => { await api("/api/account", "PATCH", { clear: "coach" }); setChat([]); }}>Clear conversation</button></div>}
      </section>
      <section className="card"><h2>Signals</h2>
        {signals(doc, today).map((s, i) => <div className="signal" key={i}><i className="dot" style={{ background: TONE[s.tone] }} /><span>{s.text}</span></div>)}
      </section>
    </>
  );
}
