import assert from "node:assert/strict";
import { test } from "node:test";
import { fmtTime, kindFor, suggestLinks, summarizeDay, type CalEvent } from "./calendar";
import type { NetworkData, Person } from "./network";

const ev = (p: Partial<CalEvent>): CalEvent => ({ id: "e" + Math.random(), title: "Thing", date: "2026-10-27", start: 540, end: 600, allDay: false, free: false, attendees: [], ...p });

test("busy time merges overlaps and ignores all-day and free events", () => {
  const s = summarizeDay([
    ev({ start: 540, end: 600 }), ev({ start: 570, end: 660 }), // 9-11 merged = 120
    ev({ start: 780, end: 840 }), // 60
    ev({ allDay: true, start: null, end: null }),
    ev({ start: 900, end: 1000, free: true }),
    ev({ date: "2026-10-28", start: 0, end: 600 }),
  ], "2026-10-27");
  assert.equal(s.busyMinutes, 180);
  assert.equal(s.count, 5);
  assert.equal(s.eveningFree, true);
  assert.equal(s.overloaded, false);
});

test("evening booked and overloaded days are flagged", () => {
  const s = summarizeDay([ev({ start: 480, end: 1020 }), ev({ start: 1140, end: 1260 })], "2026-10-27");
  assert.equal(s.eveningFree, false);
  assert.equal(s.overloaded, true);
});

const person = (p: Partial<Person>): Person => ({
  id: "p1", name: "Sarah Kim", organization: "", title: "", linkedinUrl: "", email: "", location: "", metWhere: "", metOn: null,
  categories: [], notes: "", interests: "", nextFollowUp: null, aiAccess: true, addedOn: "2026-10-01", ...p,
});

test("suggests links by attendee email or full name, skipping linked and dismissed events", () => {
  const net: NetworkData = {
    people: [person({}), person({ id: "p2", name: "Mark Davis", email: "mark@example.com" })],
    interactions: [{ id: "i1", personId: "p1", occurredOn: "2026-10-20", kind: "coffee", summary: "", sourceEventId: "old" }],
    commitments: [],
  };
  const events = [
    ev({ id: "a", title: "Coffee with Sarah Kim" }),
    ev({ id: "b", title: "Sync", attendees: [{ email: "MARK@example.com", name: "" }] }),
    ev({ id: "old", title: "Coffee with Sarah Kim" }),
    ev({ id: "c", title: "Sarah 1:1" }), // first name only: too vague
    ev({ id: "d", title: "Mark Davis lunch" }),
  ];
  const s = suggestLinks(events, net, ["d"]);
  assert.deepEqual(s.map((x) => [x.eventId, x.personId]), [["a", "p1"], ["b", "p2"]]);
});

test("formatting and kinds", () => {
  assert.equal(fmtTime(0), "12am");
  assert.equal(fmtTime(13 * 60 + 5), "1:05pm");
  assert.equal(kindFor("Coffee w/ Sarah"), "coffee");
  assert.equal(kindFor("Zoom catch-up"), "call");
  assert.equal(kindFor("Board prep"), "meeting");
});
