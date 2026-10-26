import assert from "node:assert/strict";
import { test } from "node:test";
import { consistency, scheduleLabel, streak } from "./habits";
import { defaultDoc } from "./defaults";

const doc = defaultDoc("2026-10-01");
const mark = (...ks: string[]) => { for (const k of ks) (doc.days[k] ??= { intention: "", priorities: [], done: {} }).done.h = true; };

test("streaks skip unscheduled days and don't break on today until it's over", () => {
  const h = { id: "h", name: "Run", areaId: "", xp: 10, days: [1, 3, 5] }; // Mon Wed Fri
  mark("2026-10-19", "2026-10-21", "2026-10-23"); // Mon Wed Fri
  assert.equal(streak(doc, h, "2026-10-25"), 3); // Sunday, not scheduled
  assert.equal(streak(doc, h, "2026-10-26"), 3); // Monday, not done yet
  mark("2026-10-26");
  assert.equal(streak(doc, h, "2026-10-26"), 4);
  const daily = { id: "h", name: "Read", areaId: "", xp: 10 };
  assert.equal(streak(doc, daily, "2026-10-26"), 1); // Sunday the 25th wasn't done
});

test("consistency counts scheduled days up to today only", () => {
  const h = { id: "h", name: "Run", areaId: "", xp: 10, days: [1, 3, 5] };
  assert.deepEqual(consistency(doc, h, "2026-10-19", "2026-10-25", "2026-10-25"), { done: 3, sched: 3, pct: 1 });
  assert.deepEqual(consistency(doc, h, "2026-10-26", "2026-11-01", "2026-10-27"), { done: 1, sched: 1, pct: 1 });
  assert.equal(scheduleLabel(h), "Mon, Wed, Fri");
  assert.equal(scheduleLabel({ ...h, days: [1, 2, 3, 4, 5] }), "Weekdays");
});

import { setDone } from "./habits";
import { matchBlocks, splitByTime } from "./now";
import { nextRef } from "./bible";
import type { LifeDoc } from "./types";

test("a reading plan moves one chapter per completed day and steps back when unchecked", () => {
  const doc = { days: {}, habits: [{ id: "q", name: "Quiet time", areaId: "", xp: 0, plan: { book: "Jude", chapter: 1 } }] } as unknown as LifeDoc;
  setDone(doc, "q", "2026-10-26", true);
  assert.deepEqual(doc.habits[0].plan, { book: "Revelation", chapter: 1 });
  assert.equal(doc.days["2026-10-26"].read?.q, "Jude");
  setDone(doc, "q", "2026-10-26", false);
  assert.deepEqual(doc.habits[0].plan, { book: "Jude", chapter: 1 });
  assert.deepEqual(nextRef({ book: "Revelation", chapter: 22 }), { book: "Genesis", chapter: 1 });
});

test("calendar blocks match habits and workouts, and a missed block stays open later", () => {
  const ev = (id: string, title: string, start: number, end: number) => ({ id, title, date: "2026-10-26", start, end, allDay: false, free: false, attendees: [] });
  const habits = [{ id: "q", name: "Quiet time", areaId: "", xp: 0 }, { id: "w", name: "Workout", areaId: "", xp: 0 }, { id: "r", name: "Reading", areaId: "", xp: 0, match: "read, book club" }];
  const items = matchBlocks([ev("1", "Quiet Time", 360, 390), ev("2", "Gym - Push A", 400, 460), ev("3", "Team sync", 540, 570), ev("4", "Book club", 1200, 1260), ev("5", "Spreadsheet review", 600, 630)], habits, "2026-10-26");
  assert.deepEqual(items.map((i) => i.key), ["habit:q:1", "workout:2", "habit:r:4"]);
  const at = splitByTime(items, 380, () => false);
  assert.deepEqual(at.now.map((i) => i.key), ["habit:q:1"]);
  assert.deepEqual(at.next.map((i) => i.key), ["workout:2"]);
  const later = splitByTime(items, 900, (i) => i.kind === "habit" && i.habitId === "q");
  assert.deepEqual(later.earlier.map((i) => i.key), ["workout:2"]);
});
