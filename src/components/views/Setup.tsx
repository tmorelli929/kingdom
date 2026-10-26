"use client";
import { useEffect, useState } from "react";
import { uid } from "@/lib/life/defaults";
import { METRIC_LABEL } from "@/lib/life/network";
import type { NetworkMetric } from "@/lib/life/types";
import { api } from "../api";
import { useApp } from "../App";
import { Icon } from "../ui";
import { ImportCard } from "./Onboarding";

const CAL_RESULT: Record<string, string> = {
  connected: "Google Calendar connected.",
  denied: "Calendar wasn't connected: Kingdom needs the read-only calendar permission. Try again and leave it checked.",
  cancelled: "Calendar connection was cancelled.",
  failed: "Google didn't finish connecting the calendar. Try again.",
};

const CONNECTIONS = [
  { name: "Gmail", icon: "chat", status: "Phase 4", text: "Coming later. Read-only, limited to labels and senders you choose. Never sends email." },
  { name: "LinkedIn", icon: "people", status: "Manual", text: "LinkedIn doesn't let personal apps read connections, messages or analytics. Save profile URLs on each person now; a Connections.csv import from LinkedIn's own data export comes in Phase 5." },
];

type CalConn = {
  email: string; status: string; lastSyncedAt: string | null; canList: boolean;
  calendars: { id: string; name: string; color: string; primary: boolean; selected: boolean }[];
};

export default function Setup() {
  const { doc, mutate, replaceDoc, toast, email } = useApp();
  const [newCat, setNewCat] = useState("");
  const [newGoal, setNewGoal] = useState<{ title: string; metric: NetworkMetric; target: number; period: "week" | "month"; areaId: string }>({ title: "", metric: "conversations", target: 1, period: "month", areaId: "career" });
  const [delStep, setDelStep] = useState(0);
  const [delText, setDelText] = useState("");
  const [calConn, setCalConn] = useState<CalConn | null | undefined>(undefined);
  const loadConn = () => api<{ calendar: CalConn | null }>("/api/connections").then((r) => setCalConn(r.calendar)).catch(() => setCalConn(null));
  const toggleCal = async (id: string, on: boolean) => {
    setCalConn((c) => c && { ...c, calendars: c.calendars.map((x) => (x.id === id ? { ...x, selected: on } : x)) });
    try { await api("/api/connections", "PATCH", { calendars: { [id]: on } }); } catch (e) { toast(e instanceof Error ? e.message : "Not saved."); loadConn(); }
  };
  useEffect(() => {
    loadConn();
    const q = new URLSearchParams(location.search).get("calendar");
    if (q) {
      toast(CAL_RESULT[q] ?? "Calendar connection finished.");
      history.replaceState(null, "", "/#setup");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const disconnectCal = async () => {
    try { await api("/api/connections", "DELETE", { provider: "calendar" }); setCalConn(null); toast("Google Calendar disconnected and access revoked."); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't disconnect."); }
  };

  return (
    <>
      <section className="hero single stack-s"><span className="eyebrow">Setup</span><h1>Settings</h1><p className="muted small">Signed in as {email}</p></section>

      <section className="card">
        <div className="card-head"><h2>Connections</h2></div>
        <div className="conn">
          <span className="avatar"><Icon name="cal" /></span>
          <div style={{ minWidth: 0 }}>
            <b>Google Calendar</b>
            <p className="small muted">
              {calConn?.status === "ok" ? `Connected${calConn.email ? ` as ${calConn.email}` : ""}${calConn.lastSyncedAt ? `, last synced ${new Date(calConn.lastSyncedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}. Read-only: Kingdom reads event titles, times and attendees from the calendars you include, never descriptions, and never changes anything.`
                : calConn?.status === "expired" ? "Google stopped Kingdom's access. Reconnect to keep your week up to date."
                : "Read-only. Shows your real week next to your workouts, finds open evenings, and suggests linking meetings to people in your network (you confirm each one). Use your personal Google account."}
            </p>
            {calConn?.status === "ok" && !calConn.canList && (
              <p className="small caution">Kingdom can only read your main calendar right now. <a href="/api/connections/calendar/start">Reconnect once</a> and allow &quot;see the list of your calendars&quot; to include holidays, birthdays and shared calendars.</p>
            )}
            {calConn?.status === "ok" && calConn.calendars.length > 0 && (
              <div className="cal-pick" role="group" aria-label="Calendars to include">
                <span className="lab">Calendars to include</span>
                {calConn.calendars.map((c) => (
                  <label key={c.id} className="toggle small">
                    <input type="checkbox" checked={c.selected} onChange={(e) => toggleCal(c.id, e.target.checked)} />
                    <i className="dot" style={{ background: c.color }} />{c.name}{c.primary ? <span className="faint"> (main)</span> : null}
                  </label>
                ))}
              </div>
            )}
            {calConn !== undefined && (
              <div className="btns" style={{ marginTop: 6 }}>
                {calConn?.status !== "ok" && <a className="btn primary" href="/api/connections/calendar/start">{calConn ? "Reconnect" : "Connect Google Calendar"}</a>}
                {calConn && <button className="btn ghost" onClick={disconnectCal}>Disconnect</button>}
              </div>
            )}
          </div>
          <span className={`pill ${calConn?.status === "ok" ? "good" : calConn ? "warn" : "info"}`}>{calConn?.status === "ok" ? "CONNECTED" : calConn ? "EXPIRED" : "OFF"}</span>
        </div>
        {CONNECTIONS.map((c) => (
          <div className="conn" key={c.name}>
            <span className="avatar"><Icon name={c.icon} /></span>
            <div style={{ minWidth: 0 }}><b>{c.name}</b><p className="small muted">{c.text}</p></div>
            <span className="pill info">{c.status.toUpperCase()}</span>
          </div>
        ))}
        <p className="small muted">Kingdom is personal. It will never connect to Cisco accounts, work email, customer data or internal systems.</p>
      </section>

      <section className="card">
        <h2>Network</h2>
        <div className="field"><span className="lab">Relationship categories</span>
          <div className="chips">{doc.networkCategories.map((c) => <span key={c} className="chip">{c} <button className="iconbtn" style={{ padding: 0, display: "inline" }} aria-label={`Remove ${c}`} onClick={() => mutate((d) => { d.networkCategories = d.networkCategories.filter((x) => x !== c); })}>×</button></span>)}</div>
          <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); const c = newCat.trim(); if (!c || doc.networkCategories.includes(c)) return; mutate((d) => { d.networkCategories.push(c); }); setNewCat(""); }}>
            <input className="in" id="cat-new" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Add a category" /><button className="btn" type="submit">Add</button>
          </form>
        </div>
        <div className="field"><span className="lab">Relationship goals</span>
          {doc.networkGoals.map((g) => (
            <div className="row" key={g.id}>
              <span className="grow"><b>{g.title}</b><br /><span className="small muted">{METRIC_LABEL[g.metric]} · {g.target} per {g.period}</span></span>
              <button className="iconbtn" aria-label={`Remove ${g.title}`} onClick={() => mutate((d) => { d.networkGoals = d.networkGoals.filter((x) => x.id !== g.id); })}><Icon name="x" /></button>
            </div>
          ))}
          <form className="stack-s" onSubmit={(e) => { e.preventDefault(); if (!newGoal.title.trim()) return; mutate((d) => { d.networkGoals.push({ id: uid(), ...newGoal, title: newGoal.title.trim() }); }); setNewGoal({ ...newGoal, title: "" }); }}>
            <input className="in" id="ng-title" value={newGoal.title} onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })} placeholder="e.g. Schedule a mentor conversation" />
            <div style={{ display: "grid", gridTemplateColumns: "2fr 70px 1fr auto", gap: 8 }} className="ng-row">
              <select className="in" aria-label="Counts" value={newGoal.metric} onChange={(e) => setNewGoal({ ...newGoal, metric: e.target.value as NetworkMetric })}>{Object.entries(METRIC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <input className="in num" type="number" min={1} max={50} aria-label="Target" value={newGoal.target} onChange={(e) => setNewGoal({ ...newGoal, target: +e.target.value || 1 })} />
              <select className="in" aria-label="Per" value={newGoal.period} onChange={(e) => setNewGoal({ ...newGoal, period: e.target.value as "week" | "month" })}><option value="week">per week</option><option value="month">per month</option></select>
              <button className="btn" type="submit">Add</button>
            </div>
          </form>
        </div>
      </section>

      <ImportCard hasExisting onDone={(d, v) => { replaceDoc(d, v); toast("V1 data imported."); }} />

      <section className="card">
        <h2>Your data</h2>
        <p className="small muted">Everything is stored in your private database. Relationship notes are treated as sensitive and never leave Kingdom.</p>
        <div className="btns">
          <a className="btn" href="/api/export">Download everything (JSON)</a>
          <button className="btn" onClick={async () => { await api("/api/auth/logout", "POST"); location.href = "/login"; }}>Sign out</button>
        </div>
        {delStep === 0 && <div><button className="btn danger sm" onClick={() => setDelStep(1)}>Delete my account…</button></div>}
        {delStep === 1 && (
          <div className="stack-s">
            <p style={{ color: "var(--danger)" }}>This permanently erases your dashboard, network, conversations and coach history. Download a copy first if you might want it. Type DELETE to confirm.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="in" id="del-confirm" value={delText} onChange={(e) => setDelText(e.target.value)} placeholder="DELETE" />
              <button className="btn danger" disabled={delText !== "DELETE"} onClick={async () => { await api("/api/account", "DELETE", { confirm: "DELETE" }); location.href = "/login"; }}>Delete forever</button>
              <button className="btn ghost" onClick={() => { setDelStep(0); setDelText(""); }}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
