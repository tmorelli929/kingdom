import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, parseKey } from "./life/dates";
import { habitTrends, habitWeakDays, liftTrends } from "./insights";
import type { LifeDoc } from "./life/types";
import type { FitnessData } from "./fitness-db";

const today = "2026-10-26"; // a Monday
function docWith(done: (d: string) => boolean): LifeDoc {
  const days: LifeDoc["days"] = {};
  for (let d = addDays(today, -56); d < today; d = addDays(d, 1)) days[d] = { intention: "", priorities: [], done: { r: done(d) } } as never;
  return { habits: [{ id: "r", name: "Reading", areaId: "", xp: 0 }], days } as unknown as LifeDoc;
}

test("finds a weekday where a habit is usually missed", () => {
  const doc = docWith((d) => parseKey(d).getDay() !== 4); // never on Thursdays
  const out = habitWeakDays(doc, today);
  assert.equal(out.length, 1);
  assert.match(out[0], /^Reading: kept 0 of 8 Thursdays vs 86% overall/);
  assert.deepEqual(habitWeakDays(docWith(() => true), today), []);
});

test("spots a habit dropping off in the last two weeks", () => {
  const doc = docWith((d) => d < addDays(today, -14));
  assert.match(habitTrends(doc, today)[0], /0\/14 scheduled days in the last 2 weeks vs 14\/14 .*\(down\)/);
});

test("flags a lift stuck for three sessions and one that went up", () => {
  const w = (id: string, date: string) => ({ id, date, status: "completed" }) as never;
  const s = (workoutId: string, exerciseKey: string, weight: number, reps: number) => ({ workoutId, exerciseKey, weight, reps, done: true, setNumber: 1, slot: 0 }) as never;
  const fit = {
    exercises: [{ key: "press", name: "Chest Press" }, { key: "row", name: "Row" }],
    workouts: [w("a", "2026-10-12"), w("b", "2026-10-19"), w("c", "2026-10-26")],
    sets: [s("a", "press", 120, 10), s("b", "press", 120, 9), s("c", "press", 120, 10), s("a", "row", 100, 10), s("b", "row", 100, 12), s("c", "row", 110, 8)],
  } as unknown as FitnessData;
  const out = liftTrends(fit);
  assert.ok(out.some((x) => x.startsWith("Chest Press: stuck at 120 for 3 sessions")));
  assert.ok(out.some((x) => x === "Row: moved up from 100 to 110 on 2026-10-26."));
});
