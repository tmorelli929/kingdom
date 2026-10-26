import type { CalEvent } from "./calendar";
import type { Habit, LifeDoc } from "./types";

// Ties today's calendar blocks to his habits and workout, so the dashboard shows what this hour is for.

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
export const LEAD_MIN = 15; // a block shows up this many minutes before it starts
const WORKOUT_WORDS = ["gym", "lift", "workout", "work out", "training", "push day", "pull day", "leg day"];

export const isWorkoutHabit = (h: Habit) => /\b(workout|lift|lifting|gym|training)\b/i.test(h.name);
export const workoutHabit = (doc: LifeDoc) => doc.habits.find(isWorkoutHabit);

export const matchWords = (h: Habit) => (h.match?.trim() ? h.match.split(",") : [h.name]).map(norm).filter((w) => w.length >= 3);
const hasWord = (title: string, w: string) => ` ${norm(title).replace(/[^a-z0-9 ]/g, " ")} `.includes(` ${w.replace(/[^a-z0-9 ]/g, " ")} `);

export type NowItem = { key: string; kind: "habit" | "workout"; habitId?: string; event: CalEvent };

// What each of today's timed blocks is for: a workout block, or the first habit whose words are in its title.
export function matchBlocks(events: CalEvent[], habits: Habit[], today: string): NowItem[] {
  const wh = habits.find(isWorkoutHabit);
  const workoutWords = [...WORKOUT_WORDS, ...(wh ? matchWords(wh) : [])];
  const out: NowItem[] = [];
  for (const e of events) {
    if (e.date !== today || e.allDay || e.start === null || e.end === null) continue;
    if (workoutWords.some((w) => hasWord(e.title, w))) { out.push({ key: `workout:${e.id}`, kind: "workout", habitId: wh?.id, event: e }); continue; }
    const h = habits.find((x) => !isWorkoutHabit(x) && matchWords(x).some((w) => hasWord(e.title, w)));
    if (h) out.push({ key: `habit:${h.id}:${e.id}`, kind: "habit", habitId: h.id, event: e });
  }
  return out.sort((a, b) => a.event.start! - b.event.start!);
}

// Splits matched blocks around the current minute. Items already done today drop out of "now" and "next";
// "earlier" keeps blocks that passed without being done, so a missed morning lift can still be done after work.
export function splitByTime(items: NowItem[], nowMin: number, isDone: (i: NowItem) => boolean) {
  const open = items.filter((i) => !isDone(i));
  const now = open.filter((i) => i.event.start! - LEAD_MIN <= nowMin && nowMin < i.event.end!);
  const next = open.filter((i) => i.event.start! - LEAD_MIN > nowMin);
  const seen = new Set([...now, ...next].map((i) => i.kind === "workout" ? "workout" : i.habitId));
  const earlier: NowItem[] = [];
  for (const i of open.filter((x) => x.event.end! <= nowMin)) {
    const id = i.kind === "workout" ? "workout" : i.habitId;
    if (!seen.has(id)) { seen.add(id); earlier.push(i); }
  }
  return { now, next: next.slice(0, 1), earlier };
}
