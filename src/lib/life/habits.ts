import { addDays, parseKey } from "./dates";
import { nextRef, parseRef, refLabel } from "./bible";
import type { Habit, LifeDoc } from "./types";

export const scheduledOn = (h: Habit, k: string) => !h.days || h.days.length === 0 || h.days.includes(parseKey(k).getDay());
export const doneOn = (doc: LifeDoc, hid: string, k: string) => !!doc.days[k]?.done?.[hid];

// Scheduled days in a row, counting back from today (or yesterday if today isn't done yet).
// Unscheduled days are skipped, so a Monday-Wednesday-Friday habit isn't broken by Tuesday.
export function streak(doc: LifeDoc, h: Habit, today: string) {
  let d = scheduledOn(h, today) && !doneOn(doc, h.id, today) ? addDays(today, -1) : today;
  let n = 0;
  for (let guard = 0; guard < 3650; guard++, d = addDays(d, -1)) {
    if (!scheduledOn(h, d)) continue;
    if (!doneOn(doc, h.id, d)) break;
    n++;
  }
  return n;
}

// Share of scheduled days done in [from, to], counting only days up to today. Null if none were scheduled.
export function consistency(doc: LifeDoc, h: Habit, from: string, to: string, today: string) {
  let sched = 0, done = 0;
  for (let d = from; d <= to && d <= today; d = addDays(d, 1)) {
    if (!scheduledOn(h, d)) continue;
    sched++;
    if (doneOn(doc, h.id, d)) done++;
  }
  return sched ? { done, sched, pct: done / sched } : null;
}

export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
export function scheduleLabel(h: Habit) {
  const d = [...(h.days ?? [])].sort();
  if (!d.length || d.length === 7) return "Every day";
  if (d.join() === "1,2,3,4,5") return "Weekdays";
  if (d.join() === "0,6") return "Weekends";
  return d.map((x) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][x]).join(", ");
}

// The first day anything was checked off. Consistency counts from here, so days before he
// started using the app aren't treated as misses.
export const firstLoggedDay = (doc: LifeDoc, today: string) =>
  Object.keys(doc.days).filter((k) => Object.values(doc.days[k]?.done ?? {}).some(Boolean)).sort()[0] ?? today;

const blankDay = () => ({ intention: "", priorities: [{ t: "", d: false }, { t: "", d: false }, { t: "", d: false }], done: {} as Record<string, boolean> });

// Checks a habit on or off for a day. A reading-plan habit logs the chapter it covered and moves on;
// unchecking the latest one puts the plan back on that chapter.
export function setDone(doc: LifeDoc, hid: string, k: string, on: boolean) {
  const day = (doc.days[k] ??= blankDay());
  const h = doc.habits.find((x) => x.id === hid);
  if (!!day.done[hid] === on) return;
  day.done[hid] = on;
  if (on && day.skipped) delete day.skipped[hid];
  if (!h?.plan) return;
  if (on) {
    (day.read ??= {})[hid] = refLabel(h.plan);
    h.plan = nextRef(h.plan);
  } else if (day.read?.[hid]) {
    const back = parseRef(day.read[hid]);
    if (back && refLabel(nextRef(back)) === refLabel(h.plan)) h.plan = back;
    delete day.read[hid];
  }
}

export function setSkipped(doc: LifeDoc, hid: string, k: string, on: boolean) {
  const day = (doc.days[k] ??= blankDay());
  if (on) (day.skipped ??= {})[hid] = true;
  else if (day.skipped) delete day.skipped[hid];
}
