"use client";
import { useEffect, useState } from "react";
import { weekOf } from "@/lib/life/dates";
import { needsTakeaways, networkXp, reconnectList, upcomingMeetings } from "@/lib/life/network";
import { alignment, areaConsistency, canFlag, GOAL_XP, levelOf, signals, xpByArea } from "@/lib/life/scoring";
import type { LifeDoc } from "@/lib/life/types";
import { api, streamCoach } from "../api";
import { useApp } from "../App";
import { Bar, Check, Icon, Md, pct, popXP, RingSvg } from "../ui";

const TONE: Record<string, string> = { warn: "var(--warn)", info: "var(--blue)", gold: "var(--gold)", good: "var(--green)" };

export function SkillCard({ doc, id, xp, today, wide }: { doc: LifeDoc; id: string; xp: Record<string, number>; today: string; wide?: boolean }) {
  const { go } = useApp();
  const a = doc.areas.find((x) => x.id === id)!;
  const wk = weekOf(today);
  const lv = levelOf(xp[a.id] ?? 0);
  const c = areaConsistency(doc, a.id, wk, today);
  const flag = c !== null && c < 0.34 && canFlag(doc, wk, today);
  return (
    <button className={`skill${flag ? " flag" : ""}`} onClick={() => go("areas", { area: a.id })} style={wide ? { padding: 16 } : undefined}>
      <div className="skill-top">
        <div className="ring"><RingSvg size={44} stroke={4} frac={c ?? 0} color={a.color} /><span className="ic" style={{ color: a.color }}><Icon name={a.icon} w={1.8} /></span></div>
        <div style={{ minWidth: 0 }}><div className="lvl">LV {lv.L} · {pct(c)}</div><div className="skill-name">{a.name}</div></div>
      </div>
      <Bar frac={lv.pct} gold />
      {flag ? <div className="flagtxt">Needs attention this week</div> : <div className="small muted num">{lv.into} / {lv.need} XP</div>}
    </button>
  );
}

export function Missions({ editable }: { editable?: boolean }) {
  const { doc, today, mutate } = useApp();
  const wk = weekOf(today);
  const gs = doc.goals.filter((g) => g.week === wk);
  if (!gs.length) return <div className="empty">No missions yet. Add one or two for this week.</div>;
  return (
    <div>
      {gs.map((g) => {
        const a = doc.areas.find((x) => x.id === g.areaId);
        const done = g.count >= g.target;
        return (
          <div className="mission" key={g.id}>
            <div style={{ minWidth: 0 }}>
              <div className="quest-name">{g.title} <span className="num muted small">{g.count}/{g.target}</span> {done && <span className="pill good">COMPLETE</span>}</div>
              <span className="tag"><i className="dot" style={{ background: a?.color }} />{a?.name} · <span className="xp">+{GOAL_XP}</span></span>
            </div>
            <div className="stepper">
              <button aria-label={`One less ${g.title}`} onClick={() => mutate((d) => { const x = d.goals.find((y) => y.id === g.id)!; x.count = Math.max(0, x.count - 1); })}>−</button>
              <button aria-label={`One more ${g.title}`} onClick={(e) => {
                if (g.count + 1 === g.target) popXP(e.currentTarget, GOAL_XP);
                mutate((d) => { d.goals.find((y) => y.id === g.id)!.count++; });
              }}>+</button>
              {editable && <button className="iconbtn" aria-label={`Remove ${g.title}`} onClick={() => mutate((d) => { d.goals = d.goals.filter((y) => y.id !== g.id); })}><Icon name="x" /></button>}
            </div>
            <Bar frac={g.count / g.target} color={a?.color} />
          </div>
        );
      })}
    </div>
  );
}

function Brief() {
  const { doc, today } = useApp();
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ brief: { content: string; at: string } | null }>("/api/coach").then((r) => {
      if (r.brief && new Date(r.brief.at).toDateString() === new Date().toDateString()) setText(r.brief.content);
    }).catch(() => {});
  }, []);
  const run = async () => {
    setBusy(true); setErr("");
    try { await streamCoach({ mode: "brief" }, setText); } catch (e) { setErr(e instanceof Error ? e.message : "The coach couldn't answer."); }
    setBusy(false);
  };
  return (
    <section className="card coach-card" aria-live="polite">
      <div className="card-head"><span className="eyebrow">Coach</span>
        <button className="btn ghost sm" onClick={run} disabled={busy}>{busy ? "Reading your week…" : text ? "Refresh" : "Get today's read"}</button></div>
      <div className="coach-text">
        {text ? <Md text={text} /> : (
          <div className="stack-s">{signals(doc, today).map((s, i) => <div className="signal" key={i}><i className="dot" style={{ background: TONE[s.tone] }} /><span>{s.text}</span></div>)}</div>
        )}
        {err && <p className="small" style={{ color: "var(--warn)", marginTop: 8 }}>{err}</p>}
      </div>
    </section>
  );
}

function PeopleToday() {
  const { net, today, go } = useApp();
  const up = upcomingMeetings(net, today).filter((i) => i.occurredOn <= today);
  const nt = needsTakeaways(net, today).slice(0, 2);
  const rec = reconnectList(net, today).slice(0, 2);
  if (!up.length && !nt.length && !rec.length) return null;
  const name = (id: string) => net.people.find((p) => p.id === id)?.name ?? "";
  return (
    <section className="card">
      <div className="card-head"><h2>People</h2><button className="btn ghost sm" onClick={() => go("network")}>Open Network</button></div>
      <div className="list">
        {up.map((i) => <button key={i.id} className="person-row" onClick={() => go("network", { person: i.personId })}><span className="pill info">TODAY</span><span className="grow">{i.kind} with <b>{name(i.personId)}</b></span></button>)}
        {nt.map((i) => <button key={i.id} className="person-row" onClick={() => go("network", { person: i.personId })}><span className="pill warn">NOTES</span><span className="grow">Write down what you learned from <b>{name(i.personId)}</b></span></button>)}
        {rec.map((r) => <button key={r.person.id} className="person-row" onClick={() => go("network", { person: r.person.id })}><span className="pill good">REACH OUT</span><span className="grow"><b>{r.person.name}</b> <span className="muted small">{r.why}</span></span></button>)}
      </div>
    </section>
  );
}

export default function Today() {
  const { doc, today, mutate, net } = useApp();
  const d = doc.days[today] ?? { intention: "", priorities: [{ t: "", d: false }, { t: "", d: false }, { t: "", d: false }], done: {} };
  const wk = weekOf(today);
  const al = alignment(doc, wk, today);
  const xp = xpByArea(doc, networkXp(net, doc, today));
  const ensureDay = (x: LifeDoc) => (x.days[today] ??= { intention: "", priorities: [{ t: "", d: false }, { t: "", d: false }, { t: "", d: false }], done: {} });
  const doneCount = doc.habits.filter((h) => d.done[h.id]).length;

  return (
    <>
      <section className="hero">
        <div className="stack-s" style={{ minWidth: 0 }}>
          <span className="eyebrow">Today&apos;s intention</span>
          <textarea className="intention" id="intention" rows={1} value={d.intention} placeholder="Who do I want to be today?"
            onChange={(e) => mutate((x) => { ensureDay(x).intention = e.target.value.replace(/\n/g, " "); })} />
          <p className="verse">{doc.scripture}</p>
        </div>
        <div className="align-ring" title="How well this week matches what you say matters">
          <RingSvg size={104} stroke={7} frac={al ?? 0} color="var(--gold)" />
          <div><div className="val">{pct(al)}</div><div className="lbl">Aligned</div></div>
        </div>
      </section>
      <Brief />
      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2>Three priorities</h2><span className="eyebrow">Today</span></div>
          <div className="list">
            {d.priorities.slice(0, 3).map((p, i) => (
              <div className={`row${p.d ? " done" : ""}`} key={i}>
                <span className="pnum">{i + 1}</span>
                <div className="grow"><input className="plain quest-name" id={`pri-${i}`} value={p.t} placeholder={`Priority ${i + 1}`} aria-label={`Priority ${i + 1}`}
                  onChange={(e) => mutate((x) => { ensureDay(x).priorities[i].t = e.target.value; })} /></div>
                <Check on={p.d} label={`Mark priority ${i + 1} done`} onClick={() => mutate((x) => { const q = ensureDay(x).priorities[i]; q.d = !q.d; })} />
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Daily quests</h2><span className="eyebrow num">{doneCount}/{doc.habits.length}</span></div>
          <div className="list">
            {doc.habits.length ? doc.habits.map((h) => {
              const a = doc.areas.find((x) => x.id === h.areaId);
              const on = !!d.done[h.id];
              return (
                <div className={`row${on ? " done" : ""}`} key={h.id}>
                  <Check on={on} label={`Mark ${h.name} done`} onClick={(e) => {
                    if (!on) popXP(e.currentTarget, h.xp);
                    mutate((x) => { const day = ensureDay(x); day.done[h.id] = !day.done[h.id]; });
                  }} />
                  <div className="grow"><div className="quest-name">{h.name}</div><span className="tag"><i className="dot" style={{ background: a?.color }} />{a?.name}</span></div>
                  <span className="xp">+{h.xp}</span>
                </div>
              );
            }) : <div className="empty">Add your daily practices in Setup.</div>}
          </div>
        </section>
      </div>
      <PeopleToday />
      <section className="card"><div className="card-head"><h2>This week&apos;s missions</h2></div><Missions /></section>
      <section className="card">
        <div className="card-head"><h2>Life areas</h2><span className="small muted">Rings show this week&apos;s consistency</span></div>
        <div className="skills">{doc.areas.map((a) => <SkillCard key={a.id} doc={doc} id={a.id} xp={xp} today={today} />)}</div>
      </section>
    </>
  );
}
