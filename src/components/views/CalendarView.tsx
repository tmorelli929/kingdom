"use client";
import { useState } from "react";
import { addDays, fmtShort, weekDays, weekOf } from "@/lib/life/dates";
import { useApp } from "../App";
import { FitnessProvider } from "../fitness";
import { CalendarWeek } from "./CalendarCard";

export default function CalendarView() {
  const { today, go } = useApp();
  const [wk, setWk] = useState(() => weekOf(today));
  return (
    <>
      <section className="hero single stack-s">
        <span className="eyebrow">Calendar</span>
        <div className="card-head" style={{ margin: 0 }}>
          <h1>Week of {fmtShort(wk)}</h1>
          <div className="btns">
            <button className="iconbtn" aria-label="Previous week" onClick={() => setWk(addDays(wk, -7))}>‹</button>
            {wk !== weekOf(today) && <button className="btn ghost sm" onClick={() => setWk(weekOf(today))}>This week</button>}
            <button className="iconbtn" aria-label="Next week" onClick={() => setWk(addDays(wk, 7))}>›</button>
          </div>
        </div>
      </section>
      <FitnessProvider fallback={<p className="muted">Loading…</p>}>
        <CalendarWeek key={wk} days={weekDays(wk)} onOpenWorkout={() => go("fitness")} />
      </FitnessProvider>
    </>
  );
}
