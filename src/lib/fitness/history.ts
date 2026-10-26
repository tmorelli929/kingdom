import type { FitnessData, SetRow, Workout } from "../fitness-db";
import { e1rm, type Session } from "./progression";

// Past completed sessions that included this exercise, newest first. `before` excludes the session being logged.
export function sessionsFor(data: FitnessData, key: string, excludeWorkoutId?: string): Session[] {
  const byWorkout = new Map<string, SetRow[]>();
  for (const s of data.sets) {
    if (s.exerciseKey !== key || s.workoutId === excludeWorkoutId) continue;
    (byWorkout.get(s.workoutId) ?? byWorkout.set(s.workoutId, []).get(s.workoutId)!).push(s);
  }
  const out: Session[] = [];
  for (const w of data.workouts) {
    if (w.status !== "completed") continue;
    const sets = byWorkout.get(w.id);
    if (!sets?.some((s) => s.done)) continue;
    out.push({ date: w.date, sets: sets.sort((a, b) => a.setNumber - b.setNumber).map((s) => ({ weight: s.weight, reps: s.reps, done: s.done })) });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export const fmtSession = (s: Session, unit: string) => {
  const done = s.sets.filter((x) => x.done && x.reps !== null);
  if (!done.length) return "";
  const weights = new Set(done.map((x) => x.weight));
  if (weights.size === 1) {
    const w = done[0].weight;
    return `${done.map((x) => x.reps).join(", ")} reps${w !== null && w > 0 ? ` @ ${w} ${unit}` : ""}`;
  }
  return done.map((x) => `${x.weight ?? 0}×${x.reps}`).join(", ") + ` ${unit}`;
};

export type PR = { key: string; weight: number; reps: number; date: string; est: number };

// Best set per exercise by estimated one-rep max, so a heavier triple and a lighter set of 12 compare fairly.
export function personalRecords(data: FitnessData): PR[] {
  const date = new Map(data.workouts.filter((w) => w.status === "completed").map((w) => [w.id, w.date]));
  const best = new Map<string, PR>();
  for (const s of data.sets) {
    const d = date.get(s.workoutId);
    if (!d || !s.done || !s.weight || !s.reps) continue;
    const est = e1rm(s.weight, s.reps);
    const cur = best.get(s.exerciseKey);
    if (!cur || est > cur.est) best.set(s.exerciseKey, { key: s.exerciseKey, weight: s.weight, reps: s.reps, date: d, est });
  }
  return [...best.values()].sort((a, b) => b.date.localeCompare(a.date));
}

// Heaviest completed set per session, for the exercise chart.
export function topSets(data: FitnessData, key: string) {
  return sessionsFor(data, key).reverse().map((s) => {
    const done = s.sets.filter((x) => x.done && x.weight !== null && x.reps !== null) as { weight: number; reps: number }[];
    const top = done.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a), done[0]);
    return { date: s.date, weight: top?.weight ?? 0, reps: top?.reps ?? 0 };
  }).filter((x) => x.weight > 0);
}

export const durationMin = (w: Workout) =>
  w.startedAt && w.finishedAt ? Math.max(1, Math.round((Date.parse(w.finishedAt) - Date.parse(w.startedAt)) / 60000)) : null;
