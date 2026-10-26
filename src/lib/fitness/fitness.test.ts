import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateMinutes, programDays } from "./program";
import { suggest } from "./progression";
import { LIBRARY, TEMPLATES } from "./library";

test("program follows the dated table: 31 lifting days and 6 Sundays (37 days), Oct 25 to Nov 30", () => {
  const days = programDays();
  assert.equal(days.length, 37);
  assert.equal(days.filter((d) => d.kind === "lift").length, 31);
  assert.equal(days.filter((d) => d.kind === "recovery").length, 6);
  assert.equal(days[0].date, "2026-10-25");
  assert.equal(days[0].kind, "recovery");
  assert.equal(days[1].title, "Push A");
  assert.equal(days[2].title, "Pull A");
  assert.equal(days.at(-1)!.date, "2026-11-30");
  assert.equal(days.at(-1)!.title, "Push A");
  assert.equal(new Set(days.map((d) => d.seedKey)).size, 37);
  assert.ok(days.find((d) => d.date === "2026-11-26")!.note.includes("Thanksgiving"));
});

test("every template exercise is in the library and sessions fit in about an hour", () => {
  const keys = new Set(LIBRARY.map((e) => e.key));
  assert.equal(keys.size, LIBRARY.length);
  for (const t of TEMPLATES) {
    for (const i of t.items) assert.ok(keys.has(i.key), i.key);
    const m = estimateMinutes(t.items, t.cardio.max);
    assert.ok(m >= 40 && m <= 65, `${t.name} ${m}`);
  }
});

const item = { key: "x", sets: 3, repLow: 8, repHigh: 12, rest: 120 };
const s = (date: string, w: number, reps: number[]) => ({ date, sets: reps.map((r) => ({ weight: w, reps: r, done: true })) });

test("no history asks for a starting weight instead of inventing one", () => {
  const r = suggest(item, [], 5);
  assert.equal(r.action, "start");
  assert.equal(r.weight, null);
});

test("all sets at the top of the range suggests the smallest increase", () => {
  const r = suggest(item, [s("b", 100, [12, 12, 12])], 5);
  assert.equal(r.action, "increase");
  assert.equal(r.weight, 105);
});

test("below the top keeps the weight and aims for one more rep", () => {
  const r = suggest(item, [s("b", 100, [11, 10, 9])], 5);
  assert.equal(r.action, "build");
  assert.equal(r.weight, 100);
  assert.equal(r.reps, "12, 11, 10");
});

test("a worse session never triggers an increase", () => {
  const r = suggest(item, [s("b", 100, [12, 12, 11]), s("a", 100, [12, 12, 12])], 5);
  assert.equal(r.action, "hold");
  assert.equal(r.weight, 100);
});

test("incomplete or unlogged sets are ignored", () => {
  const r = suggest(item, [{ date: "b", sets: [{ weight: 100, reps: 12, done: true }, { weight: null, reps: null, done: false }] }], 5);
  assert.equal(r.action, "build");
});
