import { addDays, daysBetween, DOW, fmtShort, parseKey, weekOf } from "./life/dates";
import { fmtTime, summarizeDay, type CalEvent } from "./life/calendar";
import { consistency, doneOn, firstLoggedDay, scheduledOn, scheduleLabel } from "./life/habits";
import {
  lastContact, metricCount, METRIC_LABEL, needsTakeaways, openCommitments, reconnectList, upcomingMeetings,
  type NetworkData, type Person,
} from "./life/network";
import type { LifeDoc } from "./life/types";
import type { FitnessData } from "./fitness-db";
import { durationMin, fmtSession, personalRecords, sessionsFor } from "./fitness/history";

export const COACH_SYSTEM = `You are the assistant inside Thomas's personal dashboard. The dashboard holds his calendar, his training program and workout logs, his habits, and his personal network. Help him plan his days, train well, keep his habits, and look after the people in his life.

How you work:
- Use only the data you're given. It's labeled by source: [CALENDAR] is read from his Google Calendar, [FITNESS], [HABITS] and [NETWORK] are what he logged in the app, [EMAIL] is last-contact dates from Gmail headers (no message content). If the data doesn't cover something, say so plainly. Never invent events, numbers, dates, people or conversations. When you infer something, say it's your read.
- Be direct, practical and brief: under 150 words unless he asks for a plan or a draft. Short paragraphs or a few bullets. No hype, no emoji.
- Planning: use real free time from the calendar, name specific days and times, and don't stack more onto a full day. Don't speculate about what a work meeting is about.
- Training: base suggestions on his logged sets and the program's targets. He has multidirectional shoulder instability: never push overhead pressing or end-range shoulder positions, and favor his substitutions. You aren't a doctor; for pain or injury, tell him to stop and see a professional.
- People: focus on genuine interest and follow-through, never on how useful someone is. Drafts are in his voice: warm, brief, plain. The app never sends messages; he sends them himself.
- He has faith-related habits; treat them like any other habit unless he brings faith up.
- This is personal. Never ask for or use anything from his employer's systems, customers or confidential data.`;

const dow = (d: string) => DOW[(parseKey(d).getDay() + 6) % 7];

function personLine(p: Person, d: NetworkData, today: string) {
  const last = lastContact(p, d.interactions, today);
  const bits = [p.name, [p.title, p.organization].filter(Boolean).join(" at "), p.categories.join("/"),
    last ? `last contact ${fmtShort(last.on)} (${last.label.toLowerCase()}${last.label.includes("emailed") ? ", from [EMAIL]" : ""})` : "no contact logged"];
  return "- " + bits.filter(Boolean).join(" | ");
}

function personDetail(p: Person, d: NetworkData, today: string) {
  const lines = [personLine(p, d, today)];
  if (p.metWhere || p.metOn) lines.push(`  Met: ${[p.metWhere, p.metOn].filter(Boolean).join(", ")}`);
  if (p.location) lines.push(`  Location: ${p.location}`);
  if (p.interests) lines.push(`  Shared interests: ${p.interests.slice(0, 400)}`);
  if (p.notes) lines.push(`  Notes: ${p.notes.slice(0, 1200)}`);
  if (p.nextFollowUp) lines.push(`  Next follow-up: ${p.nextFollowUp}`);
  const convos = d.interactions.filter((i) => i.personId === p.id).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)).slice(0, 4);
  for (const i of convos) lines.push(`  ${i.occurredOn > today ? "Planned" : "Conversation"} ${i.occurredOn} (${i.kind}): ${i.summary.slice(0, 600) || "no notes yet"}`);
  for (const c of d.commitments.filter((c) => c.personId === p.id && !c.doneOn)) lines.push(`  Open commitment: ${c.text}${c.dueOn ? ` (due ${c.dueOn})` : ""}`);
  return lines.join("\n");
}

// People the message seems to be about, by full name or a distinctive first name.
function mentioned(people: Person[], message: string) {
  const m = message.toLowerCase();
  return people.filter((p) => {
    const full = p.name.toLowerCase();
    const first = full.split(/\s+/)[0];
    return m.includes(full) || (first.length >= 3 && new RegExp(`\\b${first.replace(/[^a-z]/g, "")}\\b`).test(m));
  });
}

export type CalendarContext = { status: "ok"; events: CalEvent[] } | { status: "none" | "expired" | "error" | "hidden" };

// One line per day for today and the next 13 days: events, and whether the evening is open.
function calendarLines(events: CalEvent[], today: string) {
  return Array.from({ length: 14 }, (_, i) => addDays(today, i)).map((d) => {
    const s = summarizeDay(events, d);
    const list = events.filter((e) => e.date === d).slice(0, 12)
      .map((e) => `${e.allDay ? "all day" : `${fmtTime(e.start!)}-${fmtTime(e.end!)}`} ${e.title.slice(0, 80)}${e.free ? " (marked free)" : ""}`);
    return `- ${dow(d)} ${d}${d === today ? " (TODAY)" : ""}: evening ${s.eveningFree ? "free" : "booked"}.${list.length ? " " + list.join("; ") : " No events."}`;
  });
}

function fitnessLines(fit: FitnessData, today: string) {
  const out: string[] = [];
  const unit = fit.settings.unit;
  const name = new Map(fit.exercises.map((e) => [e.key, e.name]));
  const fmtW = (w: (typeof fit.workouts)[number]) => `${dow(w.date)} ${w.date}: ${w.title}${w.kind === "lift" ? ` (${w.focus})` : ""}, ${w.status}${w.cardioDone ? `, cardio ${w.cardioMinutes ?? 0} min` : ""}${durationMin(w) ? `, ${durationMin(w)} min` : ""}${w.note ? `. Note: ${w.note.slice(0, 200)}` : ""}`;
  const wk = weekOf(today);
  const week = fit.workouts.filter((w) => w.date >= wk && w.date <= addDays(wk, 6));
  out.push(`This week: ${week.filter((w) => w.kind === "lift" && w.status === "completed").length} of ${week.filter((w) => w.kind === "lift").length} lifts done.`);
  for (const w of fit.workouts.filter((w) => w.date >= addDays(today, -3) && w.date <= addDays(today, 7))) out.push(`- ${fmtW(w)}`);
  const todays = fit.workouts.find((w) => w.date === today && w.kind === "lift");
  if (todays) {
    out.push(`Today's plan (${todays.title}):`);
    todays.plan.forEach((item, slot) => {
      const last = sessionsFor(fit, item.key, todays.id)[0];
      const loggedToday = fit.sets.filter((x) => x.workoutId === todays.id && x.slot === slot && x.done).sort((a, b) => a.setNumber - b.setNumber);
      out.push(`  - ${name.get(item.key) ?? item.key}: ${item.sets} x ${item.repLow}-${item.repHigh}. Last time: ${last ? `${fmtSession(last, unit)} (${last.date})` : "no history"}${loggedToday.length ? `. Today so far: ${fmtSession({ date: today, sets: loggedToday }, unit)}` : ""}`);
    });
  }
  const done = fit.workouts.filter((w) => w.status === "completed" && w.date < today).slice(-5);
  if (done.length) out.push(`Recent completed sessions: ${done.map((w) => `${w.date} ${w.title}`).join("; ")}.`);
  const prs = personalRecords(fit).slice(0, 6);
  if (prs.length) out.push(`Best sets (by estimated 1RM): ${prs.map((p) => `${name.get(p.key) ?? p.key} ${p.weight}${unit} x ${p.reps} on ${p.date}`).join("; ")}.`);
  const bw = fit.bodyWeights.slice(-3);
  if (bw.length) out.push(`Body weight: ${bw.map((b) => `${b.weight}${unit} on ${b.date}`).join(", ")}.`);
  return out;
}

function habitLines(doc: LifeDoc, today: string) {
  const first = firstLoggedDay(doc, today);
  const from = addDays(today, -27) > first ? addDays(today, -27) : first;
  return doc.habits.map((h) => {
    const four = consistency(doc, h, from, today, today);
    const todayState = scheduledOn(h, today) ? (doneOn(doc, h.id, today) ? "done today" : "not done yet today") : "not scheduled today";
    return `- ${h.name} (${scheduleLabel(h)}): ${todayState}; since ${from}: ${four ? `${four.done}/${four.sched} scheduled days` : "nothing scheduled"}.`;
  });
}

// Builds the assistant's view of his data. Only what his sharing settings allow is included,
// and people marked private never appear.
export function buildContext(doc: LifeDoc, net: NetworkData, fit: FitnessData | null, today: string, localTime: string, message: string, cal: CalendarContext = { status: "none" }) {
  const out: string[] = [];
  const access = doc.coachAccess ?? { reflections: true, network: true, profile: true };
  out.push(`NOW: ${localTime}. Today is ${dow(today)} ${today}.`);
  if (cal.status === "ok") {
    out.push(`\n[CALENDAR] Google Calendar, read-only. Evenings are 6pm-9:30pm. Today and the next 13 days:`);
    out.push(...calendarLines(cal.events, today));
  } else {
    const why = { none: "Google Calendar isn't connected", expired: "Google Calendar access expired and needs reconnecting in Settings", error: "Google Calendar couldn't be reached just now", hidden: "He chose not to share his calendar with the assistant" }[cal.status];
    out.push(`\n[CALENDAR] ${why}, so you don't know his schedule beyond his workouts.`);
  }

  if (fit) {
    out.push(`\n[FITNESS] Push/pull/legs program, lifting Mon-Sat, Sunday recovery. Workouts around today:`);
    out.push(...fitnessLines(fit, today));
  }

  if (doc.habits.length) {
    out.push(`\n[HABITS]`);
    out.push(...habitLines(doc, today));
  }

  if (access.network) {
    const visible: NetworkData = { people: net.people.filter((p) => p.aiAccess), interactions: [], commitments: [] };
    const ids = new Set(visible.people.map((p) => p.id));
    visible.interactions = net.interactions.filter((i) => ids.has(i.personId));
    visible.commitments = net.commitments.filter((c) => ids.has(c.personId));
    const byId = new Map(visible.people.map((p) => [p.id, p]));

    out.push(`\n[NETWORK]`);
    for (const g of doc.networkGoals ?? []) out.push(`Goal: ${g.title} (${METRIC_LABEL[g.metric]}, this ${g.period}): ${metricCount(g.metric, g.period, visible, today)}/${g.target}`);
    const rec = reconnectList(visible, today).slice(0, 8);
    if (rec.length) out.push(`Due for a reconnect: ${rec.map((r) => `${r.person.name} (${r.why})`).join("; ")}.`);
    const up = upcomingMeetings(visible, today).slice(0, 6);
    if (up.length) out.push(`Planned: ${up.map((i) => `${byId.get(i.personId)?.name} on ${i.occurredOn} (${i.kind})`).join("; ")}.`);
    const nt = needsTakeaways(visible, today);
    if (nt.length) out.push(`Recent meetings with no notes yet: ${nt.map((i) => `${byId.get(i.personId)?.name} ${i.occurredOn}`).join("; ")}.`);
    const oc = openCommitments(visible).slice(0, 8);
    if (oc.length) out.push(`Open commitments: ${oc.map((c) => `${c.text} for ${byId.get(c.personId)?.name}${c.dueOn ? ` by ${c.dueOn}` : ""}`).join("; ")}.`);

    const focus = new Map<string, Person>();
    for (const p of mentioned(visible.people, message)) focus.set(p.id, p);
    for (const i of up.slice(0, 3)) { const p = byId.get(i.personId); if (p) focus.set(p.id, p); }
    for (const r of rec.slice(0, 3)) focus.set(r.person.id, r.person);
    if (focus.size) out.push(`People in focus (his notes):\n${[...focus.values()].slice(0, 8).map((p) => personDetail(p, visible, today)).join("\n")}`);
    if (visible.people.length) {
      out.push(`Directory (${visible.people.length} people he shares with the assistant${visible.people.length > 150 ? ", first 150 shown" : ""}):`);
      for (const p of visible.people.slice(0, 150)) out.push(personLine(p, visible, today));
      out.push(`Added in the last 30 days: ${visible.people.filter((p) => daysBetween(p.addedOn, today) <= 30).length}.`);
    } else {
      out.push("No people in his network are shared with the assistant.");
    }
  } else {
    out.push(`\n[NETWORK] He chose not to share his network with the assistant.`);
  }
  return out.join("\n");
}
