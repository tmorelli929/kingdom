"use client";
import { useState } from "react";
import { uid } from "@/lib/life/defaults";
import { METRIC_LABEL } from "@/lib/life/network";
import type { CoachAccess, NetworkMetric } from "@/lib/life/types";
import { api } from "../api";
import { useApp } from "../App";
import { Icon, ICON_CHOICES } from "../ui";
import { ImportCard } from "./Onboarding";

const CONNECTIONS = [
  { name: "Google Calendar", icon: "cal", status: "Phase 2", text: "Read-only. Shows your real week, finds free evenings and overloaded days, links meetings to people in your network after you confirm." },
  { name: "Gmail", icon: "chat", status: "Phase 4", text: "Read-only, limited to labels and senders you choose. You approve each summary before the coach sees it. Never sends email." },
  { name: "LinkedIn", icon: "people", status: "Manual", text: "LinkedIn doesn't let personal apps read connections, messages or analytics. Save profile URLs on each person now; a Connections.csv import from LinkedIn's own data export comes in Phase 5." },
  { name: "Health, finance, tasks, notes", icon: "pulse", status: "Later", text: "Each would be its own connector, added only if it earns its place." },
];

export default function Setup() {
  const { doc, mutate, replaceDoc, toast, email } = useApp();
  const [newArea, setNewArea] = useState("");
  const [newHabit, setNewHabit] = useState({ name: "", areaId: doc.areas[0]?.id ?? "" });
  const [newCat, setNewCat] = useState("");
  const [newGoal, setNewGoal] = useState<{ title: string; metric: NetworkMetric; target: number; period: "week" | "month"; areaId: string }>({ title: "", metric: "conversations", target: 1, period: "month", areaId: "career" });
  const [delStep, setDelStep] = useState(0);
  const [delText, setDelText] = useState("");
  const access = doc.coachAccess ?? { reflections: true, network: true, profile: true };
  const setAccess = (k: keyof CoachAccess, v: boolean) => mutate((d) => { d.coachAccess = { ...access, [k]: v }; });

  return (
    <>
      <section className="hero single stack-s"><span className="eyebrow">Setup</span><h1>Make it yours</h1><p className="muted small">Signed in as {email}</p></section>

      <section className="card">
        <h2>About you</h2>
        <div className="field"><label htmlFor="s-name">Name</label><input className="in" id="s-name" value={doc.name} onChange={(e) => mutate((d) => { d.name = e.target.value; })} /></div>
        <div className="field"><label htmlFor="s-about">Context the coach should know</label><textarea className="in" id="s-about" rows={4} value={doc.about} onChange={(e) => mutate((d) => { d.about = e.target.value; })} /></div>
        <div className="field"><label htmlFor="s-verse">Anchor verse</label><input className="in" id="s-verse" value={doc.scripture} onChange={(e) => mutate((d) => { d.scripture = e.target.value; })} /></div>
      </section>

      <section className="card">
        <h2>What the coach can see</h2>
        <p className="small muted">Your goals, quests and missions are always shared, since coaching needs them. Everything else is your call. You can also hide individual people from their profile.</p>
        <label className="toggle"><input type="checkbox" checked={access.profile} onChange={(e) => setAccess("profile", e.target.checked)} />About you, principles and anchor verse</label>
        <label className="toggle"><input type="checkbox" checked={access.reflections} onChange={(e) => setAccess("reflections", e.target.checked)} />Weekly reflections (last three weeks)</label>
        <label className="toggle"><input type="checkbox" checked={access.network} onChange={(e) => setAccess("network", e.target.checked)} />Network: people, conversation notes and commitments</label>
      </section>

      <section className="card">
        <div className="card-head"><h2>Connections</h2><span className="small muted">Nothing is connected yet</span></div>
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
        <h2>Life areas</h2>
        {doc.areas.map((a) => (
          <div className="row" key={a.id} style={{ flexWrap: "wrap" }}>
            <select className="in" style={{ width: "auto" }} aria-label="Icon" value={a.icon} onChange={(e) => mutate((d) => { d.areas.find((x) => x.id === a.id)!.icon = e.target.value; })}>{ICON_CHOICES.map((i) => <option key={i}>{i}</option>)}</select>
            <input type="color" aria-label="Color" value={a.color} onChange={(e) => mutate((d) => { d.areas.find((x) => x.id === a.id)!.color = e.target.value; })} style={{ width: 36, height: 34, border: 0, background: "none", padding: 0 }} />
            <div className="grow" style={{ minWidth: 160 }}><input className="in" id={`an-${a.id}`} aria-label="Area name" value={a.name} onChange={(e) => mutate((d) => { d.areas.find((x) => x.id === a.id)!.name = e.target.value; })} /></div>
            <label className="toggle small"><input type="checkbox" checked={!!a.noScore} onChange={(e) => mutate((d) => { d.areas.find((x) => x.id === a.id)!.noScore = e.target.checked; })} />No rating</label>
            <button className="iconbtn" aria-label={`Remove ${a.name}`} disabled={doc.areas.length <= 1} onClick={() => mutate((d) => { d.areas = d.areas.filter((x) => x.id !== a.id); d.habits = d.habits.filter((h) => h.areaId !== a.id); })}><Icon name="x" /></button>
          </div>
        ))}
        <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (!newArea.trim()) return; mutate((d) => { d.areas.push({ id: uid(), name: newArea.trim(), icon: "star", color: "#8fa3b8", vision: "", practices: "" }); }); setNewArea(""); }}>
          <input className="in" id="area-new" value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="Add a life area" /><button className="btn" type="submit">Add</button>
        </form>
        <p className="small muted">&quot;No rating&quot; keeps an area out of 1 to 5 self-scores in the weekly reflection. Faith uses it by default.</p>
      </section>

      <section className="card">
        <h2>Daily quests</h2>
        {doc.habits.map((h) => (
          <div className="row" key={h.id}>
            <div className="grow"><input className="in" id={`hn-${h.id}`} aria-label="Quest name" value={h.name} onChange={(e) => mutate((d) => { d.habits.find((x) => x.id === h.id)!.name = e.target.value; })} /></div>
            <select className="in" style={{ width: "auto", maxWidth: "40%" }} aria-label="Area" value={h.areaId} onChange={(e) => mutate((d) => { d.habits.find((x) => x.id === h.id)!.areaId = e.target.value; })}>{doc.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <button className="iconbtn" aria-label={`Remove ${h.name}`} onClick={() => mutate((d) => { d.habits = d.habits.filter((x) => x.id !== h.id); })}><Icon name="x" /></button>
          </div>
        ))}
        <form style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (!newHabit.name.trim()) return; mutate((d) => { d.habits.push({ id: uid(), name: newHabit.name.trim(), areaId: newHabit.areaId, xp: 10 }); }); setNewHabit({ ...newHabit, name: "" }); }}>
          <input className="in" id="habit-new" value={newHabit.name} onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })} placeholder="Add a daily quest" />
          <select className="in" aria-label="Area" value={newHabit.areaId} onChange={(e) => setNewHabit({ ...newHabit, areaId: e.target.value })}>{doc.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <button className="btn" type="submit">Add</button>
        </form>
      </section>

      <section className="card">
        <h2>Principles</h2>
        {doc.principles.map((p, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
            <input className="in" id={`pa-${i}`} aria-label="Principle" value={p[0]} onChange={(e) => mutate((d) => { d.principles[i][0] = e.target.value; })} />
            <input className="in" id={`pb-${i}`} aria-label="Over what" value={p[1]} onChange={(e) => mutate((d) => { d.principles[i][1] = e.target.value; })} />
          </div>
        ))}
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
              <span className="grow"><b>{g.title}</b><br /><span className="small muted">{METRIC_LABEL[g.metric]} · {g.target} per {g.period} · {doc.areas.find((a) => a.id === g.areaId)?.name}</span></span>
              <button className="iconbtn" aria-label={`Remove ${g.title}`} onClick={() => mutate((d) => { d.networkGoals = d.networkGoals.filter((x) => x.id !== g.id); })}><Icon name="x" /></button>
            </div>
          ))}
          <form className="stack-s" onSubmit={(e) => { e.preventDefault(); if (!newGoal.title.trim()) return; mutate((d) => { d.networkGoals.push({ id: uid(), ...newGoal, title: newGoal.title.trim() }); }); setNewGoal({ ...newGoal, title: "" }); }}>
            <input className="in" id="ng-title" value={newGoal.title} onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })} placeholder="e.g. Schedule a mentor conversation" />
            <div style={{ display: "grid", gridTemplateColumns: "2fr 70px 1fr 1fr auto", gap: 8 }} className="ng-row">
              <select className="in" aria-label="Counts" value={newGoal.metric} onChange={(e) => setNewGoal({ ...newGoal, metric: e.target.value as NetworkMetric })}>{Object.entries(METRIC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <input className="in num" type="number" min={1} max={50} aria-label="Target" value={newGoal.target} onChange={(e) => setNewGoal({ ...newGoal, target: +e.target.value || 1 })} />
              <select className="in" aria-label="Per" value={newGoal.period} onChange={(e) => setNewGoal({ ...newGoal, period: e.target.value as "week" | "month" })}><option value="week">per week</option><option value="month">per month</option></select>
              <select className="in" aria-label="Area" value={newGoal.areaId} onChange={(e) => setNewGoal({ ...newGoal, areaId: e.target.value })}>{doc.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              <button className="btn" type="submit">Add</button>
            </div>
          </form>
        </div>
      </section>

      <ImportCard hasExisting onDone={(d, v) => { replaceDoc(d, v); toast("V1 data imported."); }} />

      <section className="card">
        <h2>Your data</h2>
        <p className="small muted">Everything is stored in your private database. Relationship notes are treated as sensitive: they&apos;re only sent to the AI when you ask the coach something and the Network setting above is on.</p>
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
