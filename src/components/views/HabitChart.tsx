"use client";
import { useEffect, useRef, useState } from "react";
import { addDays, fmtShort } from "@/lib/life/dates";
import { consistency } from "@/lib/life/habits";
import type { LifeDoc } from "@/lib/life/types";

type Week = { start: string; done: number; sched: number; pct: number | null };

// Share of scheduled habit days kept, one bar per week. Weeks before he started logging have no bar.
export function weeklySeries(doc: LifeDoc, habitIds: string[], firstWeek: string, weeks: number, today: string, firstLogged: string): Week[] {
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(firstWeek, i * 7);
    const end = addDays(start, 6);
    if (end < firstLogged || start > today) return { start, done: 0, sched: 0, pct: null };
    let done = 0, sched = 0;
    for (const h of doc.habits.filter((x) => habitIds.includes(x.id))) {
      const c = consistency(doc, h, start > firstLogged ? start : firstLogged, end, today);
      if (c) { done += c.done; sched += c.sched; }
    }
    return { start, done, sched, pct: sched ? done / sched : null };
  });
}

const H = 160, PAD_L = 38, PAD_B = 22, PAD_T = 8;

export default function HabitChart({ series, label }: { series: Week[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  // Drawn at the container's real pixel width so labels stay a readable size on any screen.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const plotW = W - PAD_L, plotH = H - PAD_B - PAD_T;
  const slot = plotW / series.length, bar = Math.min(28, slot - 4);
  const y = (p: number) => PAD_T + plotH * (1 - p);
  const h = hover !== null ? series[hover] : null;
  const summary = series.filter((w) => w.pct !== null).map((w) => `week of ${fmtShort(w.start)}: ${w.done} of ${w.sched}`).join("; ");

  return (
    <div className="hchart" ref={box}>
      <div className="hchart-tip small" aria-hidden={!h}>
        {h ? <><b>Week of {fmtShort(h.start)}</b> · {h.pct === null ? "no data yet" : `${Math.round(h.pct * 100)}% (${h.done} of ${h.sched} scheduled days)`}</>
          : <span className="faint">Tap a bar for details. Bars start the week you began logging.</span>}
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}, share of scheduled days kept each week. ${summary || "No data yet."}`} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((p) => (
          <g key={p}>
            <line x1={PAD_L} x2={W} y1={y(p)} y2={y(p)} className="hchart-grid" />
            <text x={PAD_L - 6} y={y(p) + 4} textAnchor="end" className="hchart-axis">{p * 100}%</text>
          </g>
        ))}
        {series.map((w, i) => {
          const x = PAD_L + i * slot + (slot - bar) / 2;
          const top = w.pct === null ? y(0) : y(w.pct);
          const hgt = Math.max(0, y(0) - top);
          return (
            <g key={w.start} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={PAD_L + i * slot} y={PAD_T} width={slot} height={plotH} fill="transparent" />
              {w.pct !== null && hgt > 0 && <path className={`hchart-bar${hover === i ? " on" : ""}`}
                d={`M${x},${y(0)} V${top + Math.min(4, hgt)} Q${x},${top} ${x + Math.min(4, hgt)},${top} H${x + bar - Math.min(4, hgt)} Q${x + bar},${top} ${x + bar},${top + Math.min(4, hgt)} V${y(0)} Z`} />}
              {w.pct !== null && hgt === 0 && <line x1={x} x2={x + bar} y1={y(0) - 1} y2={y(0) - 1} className="hchart-zero" />}
              {(series.length - 1 - i) % 3 === 0 && <text x={PAD_L + i * slot + slot / 2} y={H - 6} textAnchor="middle" className="hchart-axis">{fmtShort(w.start)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
