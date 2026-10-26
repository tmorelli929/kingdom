import type { PlanItem } from "./library";

export type LoggedSet = { weight: number | null; reps: number | null; done: boolean };
export type Session = { date: string; sets: LoggedSet[] }; // one past workout's sets for an exercise, in order

export type Suggestion = {
  weight: number | null; // null: no history, he picks a starting weight
  reps: string; // what to aim for, e.g. "10, 10, 9" or "8-12"
  action: "start" | "increase" | "hold" | "build";
  why: string;
};

const working = (s: Session) => s.sets.filter((x) => x.done && x.weight !== null && x.reps !== null) as { weight: number; reps: number; done: true }[];
const topWeight = (sets: { weight: number }[]) => Math.max(...sets.map((x) => x.weight));
const volume = (sets: { weight: number; reps: number }[]) => sets.reduce((v, x) => v + x.weight * x.reps, 0);

export const fmtW = (w: number) => (Number.isInteger(w) ? String(w) : w.toFixed(1).replace(/\.0$/, ""));

// Double progression: keep the weight until every prescribed set reaches the top of the rep range,
// then add the smallest increment. Never raise the weight after a worse session. He can override any of it.
export function suggest(item: PlanItem, history: Session[], increment: number): Suggestion {
  const range = `${item.repLow}-${item.repHigh}`;
  const last = history[0] ? working(history[0]) : [];
  if (!last.length) {
    return { weight: null, reps: range, action: "start", why: "No history yet. Pick a weight you could lift for about 2 more reps on each set; today sets your baseline." };
  }
  const w = topWeight(last);
  const atW = last.filter((x) => x.weight === w);
  const allTop = atW.length >= item.sets && atW.slice(0, item.sets).every((x) => x.reps >= item.repHigh);

  const prev = history[1] ? working(history[1]) : [];
  const declined = prev.length > 0 && topWeight(prev) === w && volume(last) < volume(prev);

  if (allTop && !declined && increment > 0) {
    return { weight: w + increment, reps: `${item.repLow}+`, action: "increase", why: `You hit ${item.repHigh} on all ${item.sets} sets at ${fmtW(w)}. Add ${fmtW(increment)} and build back up from ${item.repLow}.` };
  }
  if (declined) {
    return { weight: w, reps: atW.map((x) => x.reps).join(", "), action: "hold", why: `Reps dipped from last time at ${fmtW(w)}. Hold the weight and match ${atW.map((x) => x.reps).join(", ")}.` };
  }
  const target = Array.from({ length: item.sets }, (_, i) => {
    const r = atW[i]?.reps ?? item.repLow;
    return Math.min(item.repHigh, r + (i === 0 || r < item.repHigh ? 1 : 0));
  });
  return { weight: w, reps: target.join(", "), action: "build", why: `Same weight as last time (${fmtW(w)}). Beat your reps: ${target.join(", ")}.` };
}

// Estimated one-rep max (Epley), used only to find personal records across rep ranges.
export const e1rm = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));
