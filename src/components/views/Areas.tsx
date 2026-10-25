"use client";
import { useState } from "react";
import { weekOf } from "@/lib/life/dates";
import { uid } from "@/lib/life/defaults";
import { networkXp } from "@/lib/life/network";
import { areaConsistency, levelOf, MILESTONE_XP, recentWeeks, xpByArea } from "@/lib/life/scoring";
import { useApp } from "../App";
import { Check, Icon, pct, popXP, RingSvg } from "../ui";
import { SkillCard } from "./Today";
import { HistChart } from "./Week";

function AreaDetail({ id }: { id: string }) {
  const { doc, today, mutate, go, net } = useApp();
  const a = doc.areas.find((x) => x.id === id)!;
  const xp = xpByArea(doc, networkXp(net, doc, today));
  const lv = levelOf(xp[a.id] ?? 0);
  const c = areaConsistency(doc, a.id, weekOf(today), today);
  const ms = doc.milestones.filter((m) => m.areaId === a.id);
  const hist = recentWeeks(today, 8).map((k) => ({ k, v: areaConsistency(doc, a.id, k, today) }));
  const [newMs, setNewMs] = useState("");
  const edit = (k: "vision" | "practices", v: string) => mutate((d) => { d.areas.find((x) => x.id === id)![k] = v; });
  return (
    <>
      <div><button className="btn ghost sm" onClick={() => go("areas")}>← All areas</button></div>
      <section className="card">
        <div className="skill-top" style={{ gap: 14 }}>
          <div className="ring lg"><RingSvg size={58} stroke={5} frac={lv.pct} color={a.color} /><span className="ic" style={{ color: a.color }}><Icon name={a.icon} w={1.8} /></span></div>
          <div style={{ minWidth: 0 }}><div className="lvl">LEVEL {lv.L} · <span className="num">{lv.into}/{lv.need}</span> XP TO NEXT · {pct(c)} THIS WEEK</div><h1 style={{ fontSize: 26 }}>{a.name}</h1></div>
        </div>
        <div className="field"><label htmlFor="vision">What success means to me</label><textarea className="in" id="vision" rows={3} value={a.vision} onChange={(e) => edit("vision", e.target.value)} /></div>
        <div className="field"><label htmlFor="practices">What I track here</label><input className="in" id="practices" value={a.practices} onChange={(e) => edit("practices", e.target.value)} /></div>
        {a.noScore && <p className="small muted">XP here rewards consistency with practices like quiet time and prayer. It never measures spiritual maturity.</p>}
      </section>
      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2>Long-term milestones</h2><span className="xp">+{MILESTONE_XP}</span></div>
          {ms.length ? ms.map((m) => (
            <div className="row" key={m.id}>
              <Check on={m.done} label={`Mark ${m.title} done`} onClick={(e) => { if (!m.done) popXP(e.currentTarget, MILESTONE_XP); mutate((d) => { const x = d.milestones.find((y) => y.id === m.id)!; x.done = !x.done; }); }} />
              <span className={`grow${m.done ? " muted" : ""}`}>{m.title}</span>
              <button className="iconbtn" aria-label={`Remove ${m.title}`} onClick={() => mutate((d) => { d.milestones = d.milestones.filter((y) => y.id !== m.id); })}><Icon name="x" /></button>
            </div>
          )) : <div className="empty">No milestones yet.</div>}
          <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (!newMs.trim()) return; mutate((d) => { d.milestones.push({ id: uid(), areaId: id, title: newMs.trim(), done: false }); }); setNewMs(""); }}>
            <input className="in" id="ms-new" value={newMs} onChange={(e) => setNewMs(e.target.value)} placeholder="Add a milestone" /><button className="btn" type="submit">Add</button>
          </form>
        </section>
        <section className="card">
          <div className="card-head"><h2>Consistency, 8 weeks</h2></div>
          <div className="chart"><HistChart points={hist} label={`${a.name} consistency, last 8 weeks`} /></div>
          <p className="small muted">Daily quests: {doc.habits.filter((h) => h.areaId === id).map((h) => h.name).join(", ") || "none yet"}</p>
        </section>
      </div>
    </>
  );
}

export default function Areas() {
  const { doc, today, area, net } = useApp();
  if (area && doc.areas.some((a) => a.id === area)) return <AreaDetail id={area} />;
  const xp = xpByArea(doc, networkXp(net, doc, today));
  const total = Object.values(xp).reduce((a, b) => a + b, 0);
  return (
    <>
      <section className="hero single stack-s">
        <span className="eyebrow">{doc.protocol}</span>
        <h1>Seven areas, one life</h1>
        <p className="muted">Total <span className="num">{total}</span> XP earned through practice. Tap an area to define what success means.</p>
      </section>
      <div className="skills wide">{doc.areas.map((a) => <SkillCard key={a.id} doc={doc} id={a.id} xp={xp} today={today} wide />)}</div>
      <section className="card"><h2>Principles</h2>
        <ul className="principles">{doc.principles.map(([a, b], i) => <li key={i}><b>{a}</b><span className="muted">{b}</span></li>)}</ul>
        <p className="verse">{doc.scripture}</p>
      </section>
    </>
  );
}
