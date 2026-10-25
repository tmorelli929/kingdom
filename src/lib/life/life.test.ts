import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, todayIn, weekOf } from "./dates";
import { defaultDoc } from "./defaults";
import { ImportError, parseBackup } from "./migrate";
import { metricCount, networkXp, reconnectList, type NetworkData } from "./network";
import { alignment, areaConsistency, levelOf, rollWeek, signals, xpByArea } from "./scoring";

const TODAY = "2026-10-25"; // a Sunday

test("weeks start on Monday", () => {
  assert.equal(weekOf(TODAY), "2026-10-19");
  assert.equal(weekOf("2026-10-19"), "2026-10-19");
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
});

test("todayIn respects time zones", () => {
  const instant = new Date("2026-10-26T02:00:00Z");
  assert.equal(todayIn("America/New_York", instant), "2026-10-25");
  assert.equal(todayIn("UTC", instant), "2026-10-26");
  assert.equal(todayIn("Not/AZone", instant).length, 10);
});

test("levels follow 50·L·(L−1)", () => {
  assert.equal(levelOf(0).L, 1);
  assert.equal(levelOf(99).L, 1);
  assert.equal(levelOf(100).L, 2);
  assert.equal(levelOf(300).L, 3);
  assert.equal(levelOf(250).into, 150);
});

test("XP never drops for a missed day, and adds habits, missions, reflections, milestones", () => {
  const doc = defaultDoc(TODAY);
  doc.days[TODAY].done["h-workout"] = true;
  doc.goals[0].count = doc.goals[0].target; // workouts mission complete
  doc.reflections[weekOf(TODAY)] = { areas: { faith: { note: "Grateful" } } };
  doc.milestones[0].done = true;
  const xp = xpByArea(doc);
  assert.equal(xp.health, 10 + 40);
  assert.equal(xp.faith, 25);
  assert.equal(xp.venture, 100);
  // An empty day later on changes nothing.
  doc.days[addDays(TODAY, 1)] = { intention: "", priorities: [], done: {} };
  assert.deepEqual(xpByArea(doc), xp);
});

test("consistency is capped so one area can't cover for another", () => {
  const doc = defaultDoc("2026-10-19");
  doc.startedOn = "2026-10-19";
  const wk = "2026-10-19";
  for (let i = 0; i < 7; i++) {
    const k = addDays(wk, i);
    doc.days[k] = { intention: "", priorities: [], done: { "h-workout": true, "h-nutrition": true } };
  }
  doc.goals.find((g) => g.areaId === "health")!.count = 50; // far over target
  assert.equal(areaConsistency(doc, "health", wk, TODAY), 1);
  assert.equal(areaConsistency(doc, "marriage", wk, TODAY), 0);
  const al = alignment(doc, wk, TODAY)!;
  assert.ok(al < 0.3, `alignment ${al} should be pulled down by the weakest area`);
});

test("no gentle flags in the first days after starting", () => {
  const doc = defaultDoc(TODAY);
  assert.ok(signals(doc, TODAY).every((s) => s.tone !== "warn"));
});

test("a new week carries last week's missions forward with counts reset", () => {
  const doc = defaultDoc("2026-10-19");
  doc.goals.forEach((g) => (g.count = 2));
  assert.equal(rollWeek(doc, "2026-10-26"), true);
  const next = doc.goals.filter((g) => g.week === "2026-10-26");
  assert.equal(next.length, 4);
  assert.ok(next.every((g) => g.count === 0));
  assert.equal(rollWeek(doc, "2026-10-26"), false);
});

const V1_BACKUP = JSON.stringify({
  v: 1, name: "Thomas", protocol: "Kingdom Builder Protocol",
  principles: [["Stewardship", "over endless productivity"]],
  areas: [{ id: "faith", name: "Faith & Character", icon: "faith", color: "#d6b26a", noScore: true, vision: "v", practices: "p" }],
  habits: [{ id: "h-quiet", name: "Quiet time", areaId: "faith", xp: 10 }],
  goals: [{ id: "g1", week: "2026-10-19", title: "Pray", areaId: "faith", target: 3, count: 2 }],
  milestones: [{ id: "m1", areaId: "faith", title: "Gospels", done: false }],
  days: { "2026-10-24": { intention: "Serve", priorities: [{ t: "A", d: true }], done: { "h-quiet": true } }, junk: 5 },
  reflections: { "2026-10-19": { areas: { faith: { note: "Grateful" } }, done: true, wins: "Sunday" } },
  schedule: { "2026-10-19": "Tue dinner" },
  chat: [{ role: "user", content: "What am I neglecting?" }, { role: "assistant", content: "Sleep." }, { role: "assistant", content: "…" }],
  brief: { date: "2026-10-24", text: "x" },
  startedOn: "2026-10-24", updatedAt: 123, somethingNew: { keep: true },
});

test("V1 backups import with nothing dropped", () => {
  const { doc, chat, preview } = parseBackup(V1_BACKUP, TODAY);
  assert.equal(doc.v, 2);
  assert.equal(doc.days["2026-10-24"].done["h-quiet"], true);
  assert.equal(doc.days["2026-10-24"].priorities.length, 3);
  assert.equal(doc.reflections["2026-10-19"].wins, "Sunday");
  assert.equal(doc.schedule["2026-10-19"], "Tue dinner");
  assert.deepEqual(doc.somethingNew, { keep: true });
  assert.equal(doc.goals[0].count, 2);
  assert.ok(Array.isArray(doc.networkGoals));
  assert.equal("chat" in doc, false);
  assert.equal(chat.length, 2);
  assert.equal(preview.days, 1);
  assert.equal(preview.checkIns, 1);
  assert.equal(preview.reflections, 1);
  assert.equal(preview.coachMessages, 2);
});

test("bad backups are refused with a clear message", () => {
  assert.throws(() => parseBackup("not json", TODAY), ImportError);
  assert.throws(() => parseBackup("{}", TODAY), ImportError);
});

test("V2 exports can be re-imported", () => {
  const doc = defaultDoc(TODAY);
  const { doc: back } = parseBackup(JSON.stringify({ format: "kingdom-export-v2", life: doc }), TODAY);
  assert.equal(back.areas.length, 7);
});

const person = (id: string, categories: string[], addedOn: string, extra: Partial<NetworkData["people"][number]> = {}) => ({
  id, name: id, organization: "", title: "", linkedinUrl: "", email: "", location: "", metWhere: "", metOn: null,
  categories, notes: "", interests: "", nextFollowUp: null, aiAccess: true, addedOn, ...extra,
});

test("reconnect list uses follow-up dates and each category's rhythm", () => {
  const net: NetworkData = {
    people: [
      person("mentor", ["Mentors"], "2026-08-01"),
      person("friend", ["Friends"], "2026-10-20"),
      person("due", ["Other"], "2026-09-01", { nextFollowUp: "2026-10-22" }),
      person("planned", ["Mentors"], "2026-08-01"),
    ],
    interactions: [
      { id: "i1", personId: "mentor", occurredOn: "2026-08-15", kind: "coffee", summary: "Sales" },
      { id: "i2", personId: "planned", occurredOn: "2026-10-28", kind: "coffee", summary: "" },
    ],
    commitments: [],
  };
  const names = reconnectList(net, TODAY).map((r) => r.person.id);
  assert.deepEqual(names.sort(), ["due", "mentor"]);
});

test("relationship goals count automatically, and XP is equal per conversation", () => {
  const doc = defaultDoc(TODAY);
  const net: NetworkData = {
    people: [person("a", ["Mentors"], "2026-10-02"), person("b", ["Friends"], "2026-06-01")],
    interactions: [
      { id: "1", personId: "a", occurredOn: "2026-10-03", kind: "coffee", summary: "x" },
      { id: "2", personId: "b", occurredOn: "2026-10-10", kind: "event", summary: "y" },
      { id: "3", personId: "b", occurredOn: "2026-11-02", kind: "call", summary: "" },
    ],
    commitments: [{ id: "c", personId: "a", text: "Send article", dueOn: null, doneOn: "2026-10-04" }],
  };
  assert.equal(metricCount("new_people", "month", net, TODAY), 1);
  assert.equal(metricCount("mentor_conversations", "month", net, TODAY), 1);
  assert.equal(metricCount("events", "month", net, TODAY), 1);
  assert.equal(metricCount("reconnects", "month", net, TODAY), 1);
  assert.equal(metricCount("commitments_kept", "month", net, TODAY), 1);
  assert.equal(metricCount("conversations", "month", net, TODAY), 2); // the future call doesn't count yet
  assert.deepEqual(networkXp(net, doc, TODAY), { career: 20, marriage: 10 });
});
