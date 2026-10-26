"use client";
import { useEffect, useState } from "react";
import Passage from "./Passage";
import { fmtTime } from "@/lib/life/calendar";
import { refLabel } from "@/lib/life/bible";
import { doneOn, setDone, setSkipped } from "@/lib/life/habits";
import { matchBlocks, splitByTime, type NowItem } from "@/lib/life/now";
import { useApp } from "../App";
import type { CalendarState } from "../calendar";
import { useFitness } from "../fitness";

const minutesNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const span = (i: NowItem) => `${fmtTime(i.event.start!)}–${fmtTime(i.event.end!)}`;

// Today's calendar blocks matched to his habits and workout: what this block is for, with one tap to log it.
// Anything skipped or missed stays under "Still open today" so it can be done later.
export default function Now({ cal, onOpenWorkout }: { cal: CalendarState; onOpenWorkout: (id: string) => void }) {
  const { doc, today, mutate, toast } = useApp();
  const { data: fit } = useFitness();
  const [nowMin, setNowMin] = useState(minutesNow);
  useEffect(() => { const t = setInterval(() => setNowMin(minutesNow()), 60000); return () => clearInterval(t); }, []);

  if (cal.state !== "ok") return null;
  const workout = fit.workouts.find((w) => w.date === today);
  const skipId = (i: NowItem) => i.habitId ?? "workout";
  const skipped = (i: NowItem) => !!doc.days[today]?.skipped?.[skipId(i)];
  const done = (i: NowItem) => i.kind === "workout"
    ? !workout || workout.status === "completed" || workout.status === "skipped" || (!!i.habitId && doneOn(doc, i.habitId, today))
    : doneOn(doc, i.habitId!, today);
  const items = matchBlocks(cal.events, doc.habits, today);
  const { now, next, earlier } = splitByTime(items, nowMin, (i) => done(i) || skipped(i));
  const later = [...earlier, ...items.filter((i) => skipped(i) && !done(i) && !earlier.some((e) => skipId(e) === skipId(i)))];

  if (!items.length) {
    return (
      <section className="card stack-s">
        <h2>Right now</h2>
        <p className="small muted">Name calendar blocks after your habits (like &ldquo;Quiet time&rdquo; or &ldquo;Gym&rdquo;) and they&apos;ll show up here when it&apos;s time, ready to log.</p>
      </section>
    );
  }

  const complete = (i: NowItem) => {
    if (i.kind === "workout") { if (workout) onOpenWorkout(workout.id); return; }
    const h = doc.habits.find((x) => x.id === i.habitId)!;
    const ref = h.plan ? refLabel(h.plan) : "";
    mutate((d) => setDone(d, h.id, today, true));
    toast(ref ? `${h.name} logged · ${ref} read.` : `${h.name} logged.`);
  };
  const skip = (i: NowItem) => { mutate((d) => setSkipped(d, skipId(i), today, true)); toast("Skipped for now. It's under Still open today."); };
  const label = (i: NowItem) => i.kind === "workout"
    ? (workout ? (workout.kind === "lift" ? `${workout.title} · ${workout.focus}` : "Recovery") : i.event.title)
    : doc.habits.find((x) => x.id === i.habitId)?.name ?? i.event.title;

  return (
    <section className="card stack-s now-card">
      <div className="card-head"><h2>Right now</h2></div>
      {now.map((i) => {
        const h = i.kind === "habit" ? doc.habits.find((x) => x.id === i.habitId) : undefined;
        return (
          <div key={i.key} className="stack-s">
            <div><span className="eyebrow">{i.event.title} · {span(i)}</span><div className="now-title">{label(i)}</div></div>
            {h?.plan && <Passage key={refLabel(h.plan)} chapter={refLabel(h.plan)} />}
            <div className="btns">
              <button className="btn primary" onClick={() => complete(i)}>{i.kind === "workout" ? (workout?.status === "in_progress" ? "Continue workout" : "Start workout") : "Complete"}</button>
              <button className="btn ghost" onClick={() => skip(i)}>Skip</button>
            </div>
          </div>
        );
      })}
      {!now.length && <p className="small muted">{next.length ? <>Next up: <b>{label(next[0])}</b> at {fmtTime(next[0].event.start!)}.</> : "Nothing else blocked for today."}</p>}
      {now.length > 0 && next.length > 0 && <p className="small faint">Then {label(next[0])} at {fmtTime(next[0].event.start!)}.</p>}
      {later.length > 0 && (
        <div className="brief-extra">
          <span className="eyebrow">Still open today</span>
          {later.map((i) => (
            <div key={i.key} className="row" style={{ padding: "4px 0" }}>
              <div className="grow"><b>{label(i)}</b> <span className="small faint">{skipped(i) ? "skipped" : `missed ${span(i)}`}</span></div>
              <button className="btn ghost sm" onClick={() => { if (skipped(i)) mutate((d) => setSkipped(d, skipId(i), today, false)); complete(i); }}>{i.kind === "workout" ? "Start" : "Done"}</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
