import { addDays, weekDays, weekOf } from "./dates";
import type { LifeDoc } from "./types";

export const GOAL_XP = 40;
export const REFLECT_XP = 25;
export const MILESTONE_XP = 100;

// Level L starts at 50·L·(L−1) XP: L2 at 100, L3 at 300, L4 at 600...
export const levelStart = (L: number) => 50 * L * (L - 1);
export function levelOf(xp: number) {
  let L = 1;
  while (xp >= levelStart(L + 1)) L++;
  const a = levelStart(L), b = levelStart(L + 1);
  return { L, into: xp - a, need: b - a, pct: (xp - a) / (b - a) };
}

// XP only ever comes from things you did. Nothing is subtracted for a missed day.
export function xpByArea(doc: LifeDoc, extra: Record<string, number> = {}) {
  const xp: Record<string, number> = Object.fromEntries(doc.areas.map((a) => [a.id, 0]));
  const add = (aid: string, n: number) => { if (xp[aid] !== undefined) xp[aid] += n; };
  for (const day of Object.values(doc.days)) {
    for (const [hid, on] of Object.entries(day.done || {})) {
      if (!on) continue;
      const h = doc.habits.find((x) => x.id === hid);
      if (h) add(h.areaId, h.xp);
    }
  }
  for (const g of doc.goals) if (g.count >= g.target) add(g.areaId, GOAL_XP);
  for (const r of Object.values(doc.reflections)) {
    for (const [aid, e] of Object.entries(r.areas || {})) if (e?.note?.trim() || e?.rating) add(aid, REFLECT_XP);
  }
  for (const m of doc.milestones) if (m.done) add(m.areaId, MILESTONE_XP);
  for (const [aid, n] of Object.entries(extra)) add(aid, n);
  return xp;
}

// Days of a week that count: already happened, and on or after the day you started.
export const trackedDays = (doc: LifeDoc, wk: string, today: string) => weekDays(wk).filter((k) => k <= today && k >= doc.startedOn);
// Gentle flags only once there are three tracked days to judge from.
export const canFlag = (doc: LifeDoc, wk: string, today: string) => trackedDays(doc, wk, today).length >= 3;

// Share of practice days kept plus share of missions met, capped at 100%,
// so extra effort in one area never covers for another.
export function areaConsistency(doc: LifeDoc, aid: string, wk: string, today: string): number | null {
  const days = trackedDays(doc, wk, today);
  const hs = doc.habits.filter((h) => h.areaId === aid);
  const parts: number[] = [];
  if (hs.length && days.length) {
    let done = 0;
    for (const k of days) for (const h of hs) if (doc.days[k]?.done?.[h.id]) done++;
    parts.push(done / (hs.length * days.length));
  }
  const gs = doc.goals.filter((g) => g.week === wk && g.areaId === aid);
  if (gs.length) parts.push(gs.reduce((s, g) => s + Math.min(1, g.count / g.target), 0) / gs.length);
  if (!parts.length) return null;
  return Math.min(1, parts.reduce((a, b) => a + b, 0) / parts.length);
}

// Alignment blends the average with the weakest area. A neglected area pulls the whole week down.
export function alignment(doc: LifeDoc, wk: string, today: string): number | null {
  const vals = doc.areas.map((a) => areaConsistency(doc, a.id, wk, today)).filter((v): v is number => v !== null);
  if (!vals.length) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return 0.6 * mean + 0.4 * Math.min(...vals);
}

export function neglected(doc: LifeDoc, wk: string, today: string) {
  return doc.areas
    .map((a) => ({ a, c: areaConsistency(doc, a.id, wk, today) }))
    .filter((x): x is { a: (typeof doc.areas)[number]; c: number } => x.c !== null && x.c < 0.34)
    .sort((x, y) => x.c - y.c);
}

export const recentWeeks = (today: string, n: number) => {
  const wk = weekOf(today);
  return Array.from({ length: n }, (_, i) => addDays(wk, -7 * (n - 1 - i)));
};

export type Signal = { tone: "warn" | "info" | "gold" | "good"; text: string };

// Plain, rule-based observations that work even without the AI coach.
export function signals(doc: LifeDoc, today: string): Signal[] {
  const wk = weekOf(today);
  const out: Signal[] = [];
  const neg = neglected(doc, wk, today);
  const flag = canFlag(doc, wk, today);
  if (flag) for (const { a } of neg.slice(0, 2)) out.push({ tone: "warn", text: `${a.name} has had little attention this week. What would one small, real step look like before Sunday?` });
  const strong = doc.areas.map((a) => ({ a, c: areaConsistency(doc, a.id, wk, today) })).filter((x) => x.c !== null && x.c >= 0.85);
  if (flag && strong.length && neg.length) out.push({ tone: "info", text: `${strong.map((x) => x.a.name).join(" and ")} ${strong.length > 1 ? "are" : "is"} strong. That doesn't make up for ${neg[0].a.name}.` });
  const dayIdx = weekDays(wk).indexOf(today);
  if (!doc.reflections[wk]?.done && dayIdx >= 5) out.push({ tone: "gold", text: "Your weekly reflection is open. It counts as much as the points do." });
  if (!out.length) out.push({ tone: "good", text: Object.keys(doc.days).length > 3 ? "Steady week so far. Keep the main things the main things." : "Start simple: check off today's quests and set one intention." });
  return out;
}

// When a new week opens with no missions, carry last week's list forward with counts reset.
export function rollWeek(doc: LifeDoc, today: string): boolean {
  const wk = weekOf(today);
  if (doc.goals.some((g) => g.week === wk)) return false;
  const prev = [...new Set(doc.goals.map((g) => g.week))].filter((k) => k < wk).sort().pop();
  if (!prev) return false;
  for (const g of doc.goals.filter((x) => x.week === prev)) doc.goals.push({ ...g, id: Math.random().toString(36).slice(2, 10), week: wk, count: 0 });
  return true;
}
