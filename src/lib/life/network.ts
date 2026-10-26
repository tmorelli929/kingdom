import { addDays, daysBetween, monthOf, weekOf } from "./dates";
import type { LifeDoc, NetworkGoal, NetworkMetric } from "./types";

export type Person = {
  id: string;
  name: string;
  organization: string;
  title: string;
  linkedinUrl: string;
  email: string;
  location: string;
  metWhere: string;
  metOn: string | null;
  categories: string[];
  notes: string;
  interests: string;
  nextFollowUp: string | null;
  aiAccess: boolean;
  addedOn: string; // date the profile was created
  lastEmail?: { on: string; dir: "sent" | "received" } | null; // from Gmail headers, when connected
};
export type Interaction = { id: string; personId: string; occurredOn: string; kind: string; summary: string; sourceEventId?: string | null };
export type Commitment = { id: string; personId: string; text: string; dueOn: string | null; doneOn: string | null };
export type NetworkData = { people: Person[]; interactions: Interaction[]; commitments: Commitment[] };

export const INTERACTION_KINDS = ["coffee", "call", "meeting", "message", "event", "conversation"] as const;
export const INTERACTION_XP = 10;
export const COMMITMENT_XP = 10;

// How long before a relationship may want attention, by category. Shortest wins.
export const CADENCE: Record<string, number> = {
  Family: 14, Friends: 30, Mentors: 45, Community: 60, Entrepreneurship: 60, Professional: 90,
};

// Which life area relationship-building XP goes to. Every conversation counts the same, whoever it's with.
const CATEGORY_AREA: Record<string, string> = {
  Mentors: "career", Professional: "career", Entrepreneurship: "venture",
  Friends: "marriage", Family: "marriage", Community: "marriage",
};
export function areaForPerson(p: Pick<Person, "categories">, doc: LifeDoc) {
  for (const c of p.categories) {
    const a = CATEGORY_AREA[c];
    if (a && doc.areas.some((x) => x.id === a)) return a;
  }
  return doc.areas.find((a) => a.id === "marriage")?.id ?? doc.areas[0]?.id ?? "";
}

export function lastInteraction(personId: string, interactions: Interaction[], today: string) {
  let last: Interaction | null = null;
  for (const i of interactions) if (i.personId === personId && i.occurredOn <= today && (!last || i.occurredOn > last.occurredOn)) last = i;
  return last;
}

// The most recent contact of any kind: a logged interaction or an email (from Gmail).
export function lastContact(p: Person, interactions: Interaction[], today: string): { on: string; label: string } | null {
  const i = lastInteraction(p.id, interactions, today);
  const e = p.lastEmail && p.lastEmail.on <= today ? p.lastEmail : null;
  if (e && (!i || e.on > i.occurredOn)) return { on: e.on, label: e.dir === "sent" ? "You emailed" : "They emailed" };
  return i ? { on: i.occurredOn, label: i.kind[0].toUpperCase() + i.kind.slice(1) } : null;
}

export function cadenceFor(p: Pick<Person, "categories">) {
  const days = p.categories.map((c) => CADENCE[c]).filter(Boolean);
  return days.length ? Math.min(...days) : null;
}

export type ReconnectReason = { person: Person; why: string; overdueDays: number };

// People to reach out to this week: a follow-up date that has arrived, or a relationship past its usual rhythm.
export function reconnectList(d: NetworkData, today: string): ReconnectReason[] {
  const weekEnd = addDays(weekOf(today), 6);
  const out: ReconnectReason[] = [];
  for (const p of d.people) {
    if (p.nextFollowUp && p.nextFollowUp <= weekEnd) {
      out.push({ person: p, why: p.nextFollowUp < today ? `Follow-up was due ${p.nextFollowUp}` : `Follow-up planned for ${p.nextFollowUp}`, overdueDays: daysBetween(p.nextFollowUp, today) });
      continue;
    }
    const cadence = cadenceFor(p);
    if (!cadence || p.nextFollowUp) continue;
    const upcoming = d.interactions.some((i) => i.personId === p.id && i.occurredOn > today);
    if (upcoming) continue;
    const last = lastContact(p, d.interactions, today);
    const since = last ? daysBetween(last.on, today) : daysBetween(p.addedOn, today);
    if (since >= cadence) out.push({ person: p, why: last ? `Last contact ${since} days ago` : `Added ${since} days ago, no conversation logged`, overdueDays: since - cadence });
  }
  return out.sort((a, b) => b.overdueDays - a.overdueDays);
}

export const upcomingMeetings = (d: NetworkData, today: string) =>
  d.interactions.filter((i) => i.occurredOn > today || (i.occurredOn === today && !i.summary.trim())).sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));

// Recent meetings with nothing written down yet.
export const needsTakeaways = (d: NetworkData, today: string) =>
  d.interactions.filter((i) => i.occurredOn < today && i.occurredOn >= addDays(today, -14) && !i.summary.trim());

export const recentInteractions = (d: NetworkData, today: string, n = 8) =>
  d.interactions.filter((i) => i.occurredOn <= today).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)).slice(0, n);

export const openCommitments = (d: NetworkData) =>
  d.commitments.filter((c) => !c.doneOn).sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"));

export function periodRange(period: NetworkGoal["period"], today: string): [string, string] {
  if (period === "week") {
    const wk = weekOf(today);
    return [wk, addDays(wk, 6)];
  }
  const m = monthOf(today);
  return [`${m}-01`, `${m}-31`];
}

export function metricCount(metric: NetworkMetric, period: NetworkGoal["period"], d: NetworkData, today: string) {
  const [from, to] = periodRange(period, today);
  const inRange = (k: string | null) => !!k && k >= from && k <= to && k <= today;
  const past = d.interactions.filter((i) => inRange(i.occurredOn));
  const byId = new Map(d.people.map((p) => [p.id, p]));
  switch (metric) {
    case "new_people":
      return d.people.filter((p) => inRange(p.metOn ?? p.addedOn)).length;
    case "conversations":
      return past.length;
    case "mentor_conversations":
      return past.filter((i) => byId.get(i.personId)?.categories.includes("Mentors")).length;
    case "events":
      return past.filter((i) => i.kind === "event").length;
    case "commitments_kept":
      return d.commitments.filter((c) => inRange(c.doneOn)).length;
    case "reconnects":
      // A conversation with someone you hadn't spoken to in 30+ days.
      return past.filter((i) => {
        const p = byId.get(i.personId);
        if (!p) return false;
        const prev = d.interactions.filter((x) => x.personId === i.personId && x.occurredOn < i.occurredOn).map((x) => x.occurredOn).sort().pop();
        return prev ? daysBetween(prev, i.occurredOn) >= 30 : daysBetween(p.addedOn, i.occurredOn) >= 30;
      }).length;
  }
}

export const METRIC_LABEL: Record<NetworkMetric, string> = {
  new_people: "New people met",
  conversations: "Conversations",
  mentor_conversations: "Mentor conversations",
  reconnects: "Reconnections (30+ days apart)",
  events: "Community events",
  commitments_kept: "Commitments kept",
};

// Consistent relationship-building earns XP, the same for everyone you invest in.
export function networkXp(d: NetworkData, doc: LifeDoc, today: string) {
  const xp: Record<string, number> = {};
  const byId = new Map(d.people.map((p) => [p.id, p]));
  const add = (pid: string, n: number) => {
    const p = byId.get(pid);
    if (!p) return;
    const a = areaForPerson(p, doc);
    xp[a] = (xp[a] ?? 0) + n;
  };
  for (const i of d.interactions) if (i.occurredOn <= today) add(i.personId, INTERACTION_XP);
  for (const c of d.commitments) if (c.doneOn) add(c.personId, COMMITMENT_XP);
  return xp;
}
