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
