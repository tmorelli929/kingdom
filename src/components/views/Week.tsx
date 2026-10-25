"use client";
import { useState } from "react";
import { DOW, fmtShort, weekDays, weekOf } from "@/lib/life/dates";
import { alignment, recentWeeks, REFLECT_XP } from "@/lib/life/scoring";
import type { Reflection } from "@/lib/life/types";
import { uid } from "@/lib/life/defaults";
import { useApp } from "../App";
import { pct } from "../ui";
import { Missions } from "./Today";

export function HistChart({ points, label }: { points: { k: string; v: number | null }[]; label: string }) {
  const W = 320, H = 130, L = 30, R = 8, T = 10, B = 22, iw = W - L - R, ih = H - T - B, bw = iw / points.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, 0.5, 1].map((v) => {
        const y = T + ih * (1 - v);
        return <g key={v}><line x1={L} x2={W - R} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
          <text x={L - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--faint)" fontFamily="var(--mono)">{v * 100}%</text></g>;
      })}
      {points.map((h, i) => {
        const x = L + i * bw + bw * 0.22, w = bw * 0.56, last = i === points.length - 1;
        const bh = h.v === null ? 0 : Math.max(2, ih * h.v);
        return <g key={h.k}>
          {h.v !== null && <rect x={x} y={T + ih - bh} width={w} height={bh} rx={3} fill={last ? "var(--gold)" : "var(--blue)"} opacity={last ? 1 : 0.55} />}
          {(i % 2 === 1 || last) && <text x={x + w / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="var(--faint)" fontFamily="var(--mono)">{fmtShort(h.k)}</text>}
        </g>;
      })}
    </svg>
  );
}

export default function Week() {
  const { doc, today, mutate } = useApp();
  const wk = weekOf(today);
  const days = weekDays(wk);
  const r: Reflection = doc.reflections[wk] ?? { areas: {} };
  const hist = recentWeeks(today, 8).map((k) => ({ k, v: alignment(doc, k, today) }));
  const [title, setTitle] = useState("");
  const [areaId, setAreaId] = useState(doc.areas[0]?.id ?? "");
  const [target, setTarget] = useState(1);
  const refl = (fn: (r: Reflection) => void) => mutate((d) => { fn((d.reflections[wk] ??= { areas: {} })); });

  return (
    <>
      <section className="hero single stack-s">
        <span className="eyebrow">Week of {fmtShort(wk)}</span>
        <h1>Am I living according to what I say matters most?</h1>
      </section>
      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2>Weekly missions</h2></div>
          <Missions editable />
          <form className="stack-s" onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            mutate((d) => { d.goals.push({ id: uid(), week: wk, title: title.trim(), areaId, target: Math.max(1, target), count: 0 }); });
            setTitle(""); setTarget(1);
          }}>
            <div className="field"><label htmlFor="g-title">New mission</label><input className="in" id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Call Mom" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px auto", gap: 8 }}>
              <select className="in" aria-label="Area" value={areaId} onChange={(e) => setAreaId(e.target.value)}>{doc.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              <input className="in num" type="number" min={1} max={50} value={target} aria-label="Times this week" onChange={(e) => setTarget(+e.target.value || 1)} />
              <button className="btn primary" type="submit">Add</button>
            </div>
          </form>
        </section>
        <section className="card">
          <div className="card-head"><h2>Alignment over 8 weeks</h2><span className="num muted small">{pct(alignment(doc, wk, today))} now</span></div>
          <div className="chart"><HistChart points={hist} label="Weekly alignment, last 8 weeks" /></div>
          <p className="small muted">Alignment weighs your average with your weakest area, so 30 career tasks can&apos;t cover for a neglected marriage. Missed days never take XP away.</p>
        </section>
      </div>
      <section className="card">
        <div className="card-head"><h2>Daily quests this week</h2></div>
        <div className="wk"><table>
          <thead><tr><th />{days.map((k, i) => <th key={k} className={k === today ? "today" : ""}>{DOW[i]}</th>)}</tr></thead>
          <tbody>{doc.habits.map((h) => <tr key={h.id}><td>{h.name}</td>{days.map((k) => <td key={k}><span className={`cell${doc.days[k]?.done?.[h.id] ? " on" : ""}${k > today ? " off" : ""}`} /></td>)}</tr>)}</tbody>
        </table></div>
      </section>
      <section className="card">
        <div className="card-head"><h2>What&apos;s on the calendar</h2><span className="pill info">CALENDAR SYNC: PHASE 2</span></div>
        <textarea className="in" id="schedule" rows={3} value={doc.schedule[wk] ?? ""} placeholder="e.g. Tue and Wed late customer dinners, Thursday travel, Saturday free"
          onChange={(e) => mutate((d) => { d.schedule[wk] = e.target.value; })} />
        <p className="small muted">Until Google Calendar is connected, the coach reads this note to compare your priorities with how your week is shaped.</p>
      </section>
      <section className="card">
        <div className="card-head"><h2>Weekly reflection</h2>{r.done ? <span className="pill good">REFLECTED</span> : <span className="xp">+{REFLECT_XP} per area</span>}</div>
        <div className="field"><label htmlFor="refl-wins">Where did I live what matters most?</label>
          <textarea className="in" id="refl-wins" rows={2} value={r.wins ?? ""} onChange={(e) => refl((x) => { x.wins = e.target.value; })} /></div>
        <div className="field"><label htmlFor="refl-next">What one thing will I protect next week?</label>
          <textarea className="in" id="refl-next" rows={2} value={r.next ?? ""} onChange={(e) => refl((x) => { x.next = e.target.value; })} /></div>
        <div>
          {doc.areas.map((a) => {
            const e = r.areas?.[a.id] ?? {};
            return (
              <div className="refl-area" key={a.id}>
                <div className="tag" style={{ fontSize: 14, color: "var(--fg)", fontWeight: 600 }}><i className="dot" style={{ background: a.color }} />{a.name}</div>
                {a.noScore ? <p className="small muted">No score here. Growth in this area is for reflection, not measurement.</p> : (
                  <div className="rate" role="group" aria-label={`How aligned did ${a.name} feel`}>
                    {[1, 2, 3, 4, 5].map((n) => <button key={n} aria-pressed={e.rating === n} onClick={() => refl((x) => { const y = (x.areas[a.id] ??= {}); y.rating = y.rating === n ? null : n; })}>{n}</button>)}
                    <span className="small muted">1 drifting · 5 living it</span>
                  </div>
                )}
                <textarea className="in" id={`refl-${a.id}`} rows={2} value={e.note ?? ""} placeholder={a.noScore ? "Where did you see God at work? Where did you fall short?" : "What went well, what drifted?"}
                  onChange={(ev) => refl((x) => { (x.areas[a.id] ??= {}).note = ev.target.value; })} />
              </div>
            );
          })}
        </div>
        <div className="btns"><button className="btn primary" onClick={() => refl((x) => { x.done = true; })}>{r.done ? "Update reflection" : "Complete reflection"}</button></div>
      </section>
    </>
  );
}
