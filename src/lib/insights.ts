import { addDays, parseKey } from "./life/dates";
import { doneOn, firstLoggedDay, scheduledOn } from "./life/habits";
import type { LifeDoc } from "./life/types";
import type { FitnessData } from "./fitness-db";
import { sessionsFor } from "./fitness/history";

// Patterns computed from his data in code, so every number an insight cites is real.
// The AI only chooses which ones matter and phrases them.

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Weekdays where a habit is kept much less often than on its other days (last 8 weeks, from first log).
export function habitWeakDays(doc: LifeDoc, today: string) {
  const first = firstLoggedDay(doc, today);
  const from = addDays(today, -56) > first ? addDays(today, -56) : first;
  const out: string[] = [];
  for (const h of doc.habits) {
    const by = Array.from({ length: 7 }, () => ({ sched: 0, done: 0 }));
    for (let d = from; d < today; d = addDays(d, 1)) {
      if (!scheduledOn(h, d)) continue;
      const w = parseKey(d).getDay();
      by[w].sched++;
      if (doneOn(doc, h.id, d)) by[w].done++;
    }
    const total = by.reduce((a, x) => ({ sched: a.sched + x.sched, done: a.done + x.done }), { sched: 0, done: 0 });
    if (total.sched < 14) continue;
    const overall = total.done / total.sched;
    by.forEach((x, w) => {
      if (x.sched >= 3 && x.done / x.sched <= overall - 0.35) out.push(`${h.name}: kept ${x.done} of ${x.sched} ${DAY[w]}s vs ${Math.round(overall * 100)}% overall since ${from}.`);
    });
  }
  return out;
}

// Habits trending down: last 2 weeks vs the 2 weeks before, when both have enough scheduled days.
export function habitTrends(doc: LifeDoc, today: string) {
  const first = firstLoggedDay(doc, today);
  const rate = (hid: string, from: string, to: string) => {
    const h = doc.habits.find((x) => x.id === hid)!;
    let s = 0, d = 0;
    for (let k = from; k <= to; k = addDays(k, 1)) if (k >= first && scheduledOn(h, k)) { s++; if (doneOn(doc, hid, k)) d++; }
    return s >= 5 ? { s, d } : null;
  };
  const out: string[] = [];
  for (const h of doc.habits) {
    const recent = rate(h.id, addDays(today, -14), addDays(today, -1));
    const before = rate(h.id, addDays(today, -28), addDays(today, -15));
    if (!recent || !before) continue;
    const delta = recent.d / recent.s - before.d / before.s;
    if (Math.abs(delta) >= 0.25) out.push(`${h.name}: ${recent.d}/${recent.s} scheduled days in the last 2 weeks vs ${before.d}/${before.s} the 2 weeks before (${delta > 0 ? "up" : "down"}).`);
  }
  return out;
}

// Lifts where the top set hasn't improved for 3 sessions in a row, and lifts that just went up.
export function liftTrends(fit: FitnessData) {
  const name = new Map(fit.exercises.map((e) => [e.key, e.name]));
  const keys = [...new Set(fit.sets.map((s) => s.exerciseKey))];
  const out: string[] = [];
  for (const key of keys) {
    const sessions = sessionsFor(fit, key).slice(0, 3).map((s) => {
      const done = s.sets.filter((x) => x.done && x.weight !== null && x.reps !== null) as { weight: number; reps: number }[];
      const w = Math.max(...done.map((x) => x.weight));
      return { date: s.date, w, reps: done.filter((x) => x.weight === w).reduce((a, x) => a + x.reps, 0) };
    }).filter((s) => Number.isFinite(s.w));
    if (sessions.length < 3) continue;
    const [a, b, c] = sessions; // newest first
    if (a.w === b.w && b.w === c.w && a.reps <= c.reps) out.push(`${name.get(key) ?? key}: stuck at ${a.w} for 3 sessions (${c.date} to ${a.date}), reps at that weight ${c.reps} then ${a.reps}.`);
    else if (a.w > b.w) out.push(`${name.get(key) ?? key}: moved up from ${b.w} to ${a.w} on ${a.date}.`);
  }
  return out;
}

// Training consistency: planned lifts in the last 14 days and how many were done or skipped.
export function trainingConsistency(fit: FitnessData, today: string) {
  const recent = fit.workouts.filter((w) => w.kind === "lift" && w.date >= addDays(today, -14) && w.date < today);
  if (!recent.length) return [];
  const done = recent.filter((w) => w.status === "completed").length;
  const skipped = recent.filter((w) => w.status === "skipped").length;
  return [`Lifting, last 14 days: ${done} of ${recent.length} planned sessions done, ${skipped} skipped, ${recent.length - done - skipped} not logged.`];
}

export function patterns(doc: LifeDoc, fit: FitnessData | null, today: string) {
  return [
    ...habitWeakDays(doc, today), ...habitTrends(doc, today),
    ...(fit ? [...trainingConsistency(fit, today), ...liftTrends(fit)] : []),
  ];
}
