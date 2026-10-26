import assert from "node:assert/strict";
import { test } from "node:test";
import { expandEvent } from "./google-calendar";

const cal = { id: "c", name: "Personal", color: "#fff" };
const NY = "America/New_York";

test("all-day events use their dates as-is with an exclusive end", () => {
  const one = expandEvent({ id: "a", summary: "Birthday", start: { date: "2026-10-27" }, end: { date: "2026-10-28" } }, cal, "2026-10-26", "2026-11-02", NY);
  assert.deepEqual(one.map((e) => [e.date, e.allDay]), [["2026-10-27", true]]);
  const trip = expandEvent({ id: "b", summary: "Trip", start: { date: "2026-10-30" }, end: { date: "2026-11-03" } }, cal, "2026-10-26", "2026-11-02", NY);
  assert.deepEqual(trip.map((e) => e.date), ["2026-10-30", "2026-10-31", "2026-11-01"]); // clipped to the range
  assert.ok(trip.every((e) => e.multiDay));
  // Same dates in any time zone.
  const tokyo = expandEvent({ id: "a", start: { date: "2026-10-27" }, end: { date: "2026-10-28" } }, cal, "2026-10-26", "2026-11-02", "Asia/Tokyo");
  assert.equal(tokyo[0].date, "2026-10-27");
});

test("timed events convert to his time zone and split across midnight", () => {
  const e = expandEvent({ id: "x", summary: "Flight", start: { dateTime: "2026-10-27T22:00:00-04:00" }, end: { dateTime: "2026-10-28T06:30:00-04:00" } }, cal, "2026-10-26", "2026-11-02", NY);
  assert.deepEqual(e.map((x) => [x.date, x.start, x.end]), [["2026-10-27", 1320, 1440], ["2026-10-28", 0, 390]]);
  const utc = expandEvent({ id: "y", summary: "Call", start: { dateTime: "2026-10-27T14:00:00Z" }, end: { dateTime: "2026-10-27T15:00:00Z" } }, cal, "2026-10-26", "2026-11-02", NY);
  assert.deepEqual(utc.map((x) => [x.date, x.start, x.end]), [["2026-10-27", 600, 660]]);
  const midnight = expandEvent({ id: "z", summary: "Late", start: { dateTime: "2026-10-27T23:00:00-04:00" }, end: { dateTime: "2026-10-28T00:00:00-04:00" } }, cal, "2026-10-26", "2026-11-02", NY);
  assert.equal(midnight.length, 1);
});

test("cancelled and declined events are left out", () => {
  assert.equal(expandEvent({ id: "c", status: "cancelled", start: { date: "2026-10-27" }, end: { date: "2026-10-28" } }, cal, "2026-10-26", "2026-11-02", NY).length, 0);
  assert.equal(expandEvent({ id: "d", start: { dateTime: "2026-10-27T14:00:00Z" }, end: { dateTime: "2026-10-27T15:00:00Z" }, attendees: [{ self: true, responseStatus: "declined" }] }, cal, "2026-10-26", "2026-11-02", NY).length, 0);
});
