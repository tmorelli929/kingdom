"use client";
import { useState } from "react";
import { addDays, DOW, fmtShort, weekDays, weekOf } from "@/lib/life/dates";
import { uid } from "@/lib/life/defaults";
import type { LifeDoc } from "@/lib/life/types";
import { useApp } from "../App";
import { Check, Icon } from "../ui";

const blankDay = () => ({ intention: "", priorities: [{ t: "", d: false }, { t: "", d: false }, { t: "", d: false }], done: {} as Record<string, boolean> });

// Days in a row, counting back from today (or from yesterday if today isn't checked yet). A miss just restarts it.
export function streak(doc: LifeDoc, hid: string, today: string) {
  let d = doc.days[today]?.done?.[hid] ? today : addDays(today, -1);
  let n = 0;
  while (doc.days[d]?.done?.[hid]) { n++; d = addDays(d, -1); }
  return n;
}

export default function Habits() {
  const { doc, today, mutate } = useApp();
  const [wk, setWk] = useState(() => weekOf(today));
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const days = weekDays(wk);
  const done = (k: string, hid: string) => !!doc.days[k]?.done?.[hid];
  const toggle = (k: string, hid: string) => mutate((x) => { const day = (x.days[k] ??= blankDay()); day.done[hid] = !day.done[hid]; });
  const last30 = (hid: string) => Array.from({ length: 30 }, (_, i) => addDays(today, -i)).filter((k) => done(k, hid)).length;
  const todayCount = doc.habits.filter((h) => done(today, h.id)).length;

  return (
    <>
      <section className="hero single stack-s">
        <span className="eyebrow">Habits</span>
        <h1>{todayCount === doc.habits.length && todayCount > 0 ? "All done today." : `${todayCount} of ${doc.habits.length} done today`}</h1>
      </section>

      <section className="card">
        <div className="card-head"><h2>Today</h2><button className="btn ghost sm" onClick={() => setEditing(!editing)}>{editing ? "Done editing" : "Edit habits"}</button></div>
        <div className="list">
          {doc.habits.map((h) => {
            const on = done(today, h.id);
            const s = streak(doc, h.id, today);
            return (
              <div className={`row${on && !editing ? " done" : ""}`} key={h.id}>
                {!editing && <Check on={on} label={`Mark ${h.name} done`} onClick={() => toggle(today, h.id)} />}
                <div className="grow">
                  {editing
                    ? <input className="in" aria-label="Habit name" value={h.name} onChange={(e) => mutate((d) => { d.habits.find((x) => x.id === h.id)!.name = e.target.value; })} />
                    : <div className="quest-name">{h.name}</div>}
                </div>
                {editing
                  ? <button className="iconbtn" aria-label={`Remove ${h.name}`} onClick={() => mutate((d) => { d.habits = d.habits.filter((x) => x.id !== h.id); })}><Icon name="x" /></button>
                  : <span className="num small muted" title="Days in a row">{s ? `${s} day${s === 1 ? "" : "s"}` : ""}</span>}
              </div>
            );
          })}
          {!doc.habits.length && <div className="empty">No habits yet. Click Edit habits to add one.</div>}
        </div>
        {editing && (
          <form style={{ display: "flex", gap: 8, marginTop: 10 }} onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            mutate((d) => { d.habits.push({ id: uid(), name: newName.trim(), areaId: d.areas[0]?.id ?? "", xp: 10 }); });
            setNewName("");
          }}>
            <input className="in" id="habit-new" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add a habit, e.g. Read 20 minutes" />
            <button className="btn primary" type="submit">Add</button>
          </form>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Week of {fmtShort(wk)}</h2>
          <div className="btns">
            <button className="iconbtn" aria-label="Previous week" onClick={() => setWk(addDays(wk, -7))}>‹</button>
            {wk !== weekOf(today) && <button className="btn ghost sm" onClick={() => setWk(weekOf(today))}>This week</button>}
            <button className="iconbtn" aria-label="Next week" disabled={wk >= weekOf(today)} onClick={() => setWk(addDays(wk, 7))}>›</button>
          </div>
        </div>
        <div className="wk"><table>
          <thead><tr><th />{days.map((k, i) => <th key={k} className={k === today ? "today" : ""}>{DOW[i]}</th>)}<th title="Days done in the last 30">30d</th></tr></thead>
          <tbody>{doc.habits.map((h) => (
            <tr key={h.id}>
              <td>{h.name}</td>
              {days.map((k) => (
                <td key={k}>
                  <button className={`cell${done(k, h.id) ? " on" : ""}${k > today ? " off" : ""}`} disabled={k > today}
                    aria-label={`${h.name} on ${fmtShort(k)}: ${done(k, h.id) ? "done" : "not done"}`} onClick={() => toggle(k, h.id)} />
                </td>
              ))}
              <td className="num small muted">{last30(h.id)}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="small muted">Tap a square to fill in a day you missed logging.</p>
      </section>
    </>
  );
}
