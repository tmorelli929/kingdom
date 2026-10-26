"use client";
import { useState } from "react";
import { addDays, fmtShort } from "@/lib/life/dates";
import { useApp } from "../App";
import { CalendarWeek } from "./CalendarCard";

// Seven days starting today, so the top of the dashboard is always what's next.
export default function CalendarView({ from }: { from?: string }) {
  const { today } = useApp();
  const first = from ?? today;
  const [start, setStart] = useState(first);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <>
      <div className="sec-head">
        <h2 className="sec-title">Week ahead</h2>
        <div className="btns">
          <button className="iconbtn" aria-label="Previous 7 days" onClick={() => setStart(addDays(start, -7))}>‹</button>
          {start !== first && <button className="btn ghost sm" onClick={() => setStart(first)}>Reset</button>}
          <button className="iconbtn" aria-label="Next 7 days" onClick={() => setStart(addDays(start, 7))}>›</button>
        </div>
      </div>
      <CalendarWeek key={start} days={days} title={start === first ? "Next 7 days" : `${fmtShort(days[0])} – ${fmtShort(days[6])}`} />
    </>
  );
}
