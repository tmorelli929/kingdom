"use client";
import { useState } from "react";
import { addDays, DOW, fmtShort, weekDays, weekOf } from "@/lib/life/dates";
import { uid } from "@/lib/life/defaults";
import { BOOKS, refLabel } from "@/lib/life/bible";
import { consistency, DAY_LETTERS, doneOn, firstLoggedDay, scheduledOn, scheduleLabel, setDone, streak } from "@/lib/life/habits";
import type { Habit } from "@/lib/life/types";
import { useApp } from "../App";
import HabitChart, { weeklySeries } from "./HabitChart";
import { Check, Icon } from "../ui";

const ALL = [0, 1, 2, 3, 4, 5, 6];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKS = 12;

// Toggles one weekday on a habit's schedule. All seven means every day; the last day can't be removed.
function toggleDay(h: Habit, day: number) {
  const cur = h.days?.length ? h.days : ALL;
  const next = cur.includes(day) ? cur.filter((x) => x !== day) : [...cur, day].sort();
  if (!next.length) return;
  h.days = next.length === 7 ? undefined : next;
}

export default function Habits() {
  const { doc, today, mutate } = useApp();
  const [wk, setWk] = useState(() => weekOf(today));
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [chartHabit, setChartHabit] = useState<string | null>(null);
  const days = weekDays(wk);
  const toggle = (k: string, hid: string) => mutate((x) => setDone(x, hid, k, !doneOn(x, hid, k)));
  const due = doc.habits.filter((h) => scheduledOn(h, today));
  const off = doc.habits.filter((h) => !scheduledOn(h, today));
  const todayCount = due.filter((h) => doneOn(doc, h.id, today)).length;
  const list = editing ? doc.habits : due;
  const isOn = (h: Habit, day: number) => !h.days?.length || h.days.includes(day);
  // History grid: 12 full weeks ending with the current one, Monday at the top of each column.
  const heatStart = addDays(weekOf(today), -7 * (WEEKS - 1));
  const heatDays = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(heatStart, i));
  // Percentages start from the first day he logged anything, so weeks before he used the app don't count as misses.
  const firstLogged = firstLoggedDay(doc, today);
  const since = (k: string) => (k > firstLogged ? k : firstLogged);

  return (
    <>
      <div className="sec-head">
        <h2 className="sec-title">Habits</h2>
        <span className="small muted">{!due.length ? "Nothing scheduled today" : todayCount === due.length ? "All done today" : `${todayCount} of ${due.length} done today`}</span>
      </div>

      <section className="card">
        <div className="card-head"><h2>Today</h2><button className="btn ghost sm" onClick={() => setEditing(!editing)}>{editing ? "Done editing" : "Edit habits"}</button></div>
        <div className="list">
          {list.map((h) => {
            const on = doneOn(doc, h.id, today);
            const s = streak(doc, h, today);
            return (
              <div className={`row${on && !editing ? " done" : ""}`} key={h.id}>
                {!editing && <Check on={on} label={`Mark ${h.name} done`} onClick={() => toggle(today, h.id)} />}
                <div className="grow stack-s">
                  {editing ? (
                    <>
                      <input className="in" aria-label="Habit name" value={h.name} onChange={(e) => mutate((d) => { d.habits.find((x) => x.id === h.id)!.name = e.target.value; })} />
                      <div className="dayp" role="group" aria-label={`Days for ${h.name}`}>
                        {DAY_LETTERS.map((l, i) => (
                          <button key={i} type="button" className={isOn(h, i) ? "on" : ""} aria-pressed={isOn(h, i)} aria-label={DAY_NAMES[i]}
                            onClick={() => mutate((d) => toggleDay(d.habits.find((x) => x.id === h.id)!, i))}>{l}</button>
                        ))}
                        <span className="small muted">{scheduleLabel(h)}</span>
                      </div>
                      <label className="field"><span className="lab">Calendar blocks with these words (comma-separated)</span>
                        <input className="in" value={h.match ?? ""} placeholder={h.name} maxLength={120}
                          onChange={(e) => mutate((d) => { d.habits.find((x) => x.id === h.id)!.match = e.target.value; })} />
                      </label>
                      <div className="row-wrap">
                        <label className="field grow"><span className="lab">Reading plan</span>
                          <select className="in" value={h.plan?.book ?? ""} onChange={(e) => mutate((d) => {
                            const x = d.habits.find((y) => y.id === h.id)!;
                            if (e.target.value) x.plan = { book: e.target.value, chapter: 1 }; else delete x.plan;
                          })}>
                            <option value="">None</option>
                            {BOOKS.map(([b]) => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </label>
                        {h.plan && (
                          <label className="field"><span className="lab">Next chapter</span>
                            <input className="in" type="number" min={1} max={BOOKS.find(([b]) => b === h.plan!.book)?.[1] ?? 1} value={h.plan.chapter} style={{ width: 90 }}
                              onChange={(e) => { const n = Math.round(Number(e.target.value)); const max = BOOKS.find(([b]) => b === h.plan!.book)?.[1] ?? 1;
                                if (n >= 1 && n <= max) mutate((d) => { d.habits.find((x) => x.id === h.id)!.plan!.chapter = n; }); }} />
                          </label>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="quest-name">{h.name}</div>
                      {h.days?.length || h.plan ? <div className="small muted">{[h.days?.length ? scheduleLabel(h) : "", h.plan ? `${on ? "Read" : "Next"}: ${on ? doc.days[today]?.read?.[h.id] ?? "" : refLabel(h.plan)}` : ""].filter(Boolean).join(" · ")}</div> : null}
                    </>
                  )}
                </div>
                {editing
                  ? <button className="iconbtn" aria-label={`Remove ${h.name}`} onClick={() => mutate((d) => { d.habits = d.habits.filter((x) => x.id !== h.id); })}><Icon name="x" /></button>
                  : <span className="num small muted" title="Scheduled days in a row">{s ? `${s} in a row` : ""}</span>}
              </div>
            );
          })}
          {!doc.habits.length && <div className="empty">No habits yet. Click Edit habits to add one.</div>}
        </div>
        {!editing && off.length > 0 && <p className="small muted">Not scheduled today: {off.map((h) => h.name).join(", ")}</p>}
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
          <thead><tr><th />{days.map((k, i) => <th key={k} className={k === today ? "today" : ""}>{DOW[i]}</th>)}<th title="Scheduled days done this week">Week</th></tr></thead>
          <tbody>{doc.habits.map((h) => {
            const c = consistency(doc, h, days[0], days[6], today);
            return (
              <tr key={h.id}>
                <td>{h.name}</td>
                {days.map((k) => {
                  const on = doneOn(doc, h.id, k);
                  const sched = scheduledOn(h, k);
                  return (
                    <td key={k}>
                      <button className={`cell${on ? " on" : ""}${!sched && !on ? " rest" : ""}${k > today ? " off" : ""}`} disabled={k > today}
                        aria-label={`${h.name} on ${fmtShort(k)}: ${on ? "done" : sched ? "not done" : "not scheduled"}`} onClick={() => toggle(k, h.id)} />
                    </td>
                  );
                })}
                <td className="num small muted">{c ? `${c.done}/${c.sched}` : "–"}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
        <p className="small muted">Tap a square to fill in a day you missed logging. Faded squares are days the habit isn&apos;t scheduled.</p>
      </section>

      {doc.habits.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Last {WEEKS} weeks</h2></div>
          <div className="chips">
            <button className="chip" aria-pressed={!chartHabit} onClick={() => setChartHabit(null)}>All habits</button>
            {doc.habits.map((h) => <button key={h.id} className="chip" aria-pressed={chartHabit === h.id} onClick={() => setChartHabit(chartHabit === h.id ? null : h.id)}>{h.name}</button>)}
          </div>
          <HabitChart label={chartHabit ? doc.habits.find((h) => h.id === chartHabit)?.name ?? "Habit" : "All habits"}
            series={weeklySeries(doc, chartHabit ? [chartHabit] : doc.habits.map((h) => h.id), heatStart, WEEKS, today, firstLogged)} />
          <div><button className="btn ghost sm" aria-expanded={showHistory} onClick={() => setShowHistory(!showHistory)}>{showHistory ? "Hide day-by-day grid" : "Show day-by-day grid"}</button></div>
          {showHistory && <><div className="stack">
            {doc.habits.map((h) => {
              const four = consistency(doc, h, since(addDays(today, -27)), today, today);
              const twelve = consistency(doc, h, since(heatStart), today, today);
              return (
                <div key={h.id} className="stack-s">
                  <div className="heat-head">
                    <span>{h.name}</span>
                    <span className="small muted num">{four ? `${Math.round(four.pct * 100)}% ${four.sched < 28 ? `of ${four.sched} days` : "last 4 weeks"}` : "Not scheduled yet"}</span>
                  </div>
                  <div className="heat" role="img" aria-label={`${h.name}, last ${WEEKS} weeks: ${twelve ? `${twelve.done} of ${twelve.sched} scheduled days done` : "nothing scheduled"}`}>
                    {heatDays.map((k) => {
                      const on = doneOn(doc, h.id, k);
                      const state = k > today ? "upcoming" : on ? "done" : scheduledOn(h, k) ? "not done" : "not scheduled";
                      const cls = k > today ? "future" : on ? "on" : scheduledOn(h, k) ? "miss" : "rest";
                      return <i key={k} className={cls} title={`${fmtShort(k)}: ${state}`} />;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="small muted">Each column is a week, Monday at the top. Only scheduled days count, and a missed day never takes anything away.</p></>}
        </section>
      )}
    </>
  );
}
