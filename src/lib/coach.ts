import { addDays, daysBetween, fmtShort, weekOf } from "./life/dates";
import {
  lastInteraction, metricCount, METRIC_LABEL, needsTakeaways, openCommitments, reconnectList, upcomingMeetings,
  networkXp, type NetworkData, type Person,
} from "./life/network";
import { alignment, areaConsistency, levelOf, recentWeeks, trackedDays, xpByArea } from "./life/scoring";
import type { LifeDoc } from "./life/types";

export const COACH_SYSTEM = `You are Kingdom's coach: a personal chief of staff, life coach and accountability partner for one person. His framework is the Kingdom Builder Protocol, grounded in Matthew 6:33. He is a Christian; respect that faith and speak from it naturally when relevant, without preaching.

How you work:
- Be direct, thoughtful, practical and willing to challenge him. Encourage only when the evidence earns it. Never congratulate him for the bare minimum. No generic motivation, no hype, no emoji, never mention XP or points.
- Ground every claim in the data you are given. The data is labeled by source: [ENTERED] is what he typed into Kingdom, [REFLECTION] is his own reflection writing, [CONNECTED] is from connected accounts. When you infer something that isn't stated, say it's your read ("My read:"). If the data doesn't cover something, say so instead of guessing.
- Don't make assumptions about his marriage, spiritual life or emotional state beyond what he wrote. Never judge or score his spiritual maturity.
- Relationships outrank achievement. If career or entrepreneurship is strong while faith, marriage, health or rest is thin, say so plainly. Career ambition must not crowd out everything else.
- Plan realistically. Prefer protecting time for what matters over adding tasks. Suggest specific days, times and people.
- Relationships are about investing in people, not extracting value. When helping with networking, focus on genuine interest, follow-through and service. Never rank people by status or usefulness.
- If asked to draft a message, write it in his voice: warm, brief, plain. Kingdom never sends messages; he sends them himself.
- Kingdom is personal. Never ask for or use information from his employer's internal systems, customers or confidential data.
- Keep answers short: under 150 words unless he asks for a plan or a draft. Use short paragraphs or a few bullets.`;

const pct = (v: number | null) => (v === null ? "n/a" : `${Math.round(v * 100)}%`);

function personLine(p: Person, d: NetworkData, today: string) {
  const last = lastInteraction(p.id, d.interactions, today);
  const bits = [p.name, [p.title, p.organization].filter(Boolean).join(" at "), p.categories.join("/"), last ? `last spoke ${fmtShort(last.occurredOn)}` : "no conversation logged"];
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

// Builds the coach's view of his life. Only what the coach-access settings allow is included,
// and people marked private never appear.
export function buildContext(doc: LifeDoc, net: NetworkData, today: string, localTime: string, message: string) {
  const wk = weekOf(today);
  const out: string[] = [];
  const access = doc.coachAccess ?? { reflections: true, network: true, profile: true };
  out.push(`NOW: ${localTime}. Today is ${today}. This week started ${wk}.`);
  out.push("[CONNECTED] No accounts are connected yet. Calendar and email information below is only what he typed.");

  if (access.profile) {
    out.push(`\n[ENTERED] ABOUT HIM: ${doc.about}`);
    out.push(`Anchor verse: ${doc.scripture}`);
    out.push(`Principles: ${doc.principles.map((p) => p.join(" ")).join("; ")}.`);
  }

  const xp = xpByArea(doc, networkXp(net, doc, today));
  const weeks = recentWeeks(today, 5);
  out.push(`\n[ENTERED] LIFE AREAS: consistency for the last 5 weeks (oldest to this week), level, and what success means to him:`);
  for (const a of doc.areas) {
    const series = weeks.map((w) => pct(areaConsistency(doc, a.id, w, today))).join(", ");
    out.push(`- ${a.name}: ${series}. Level ${levelOf(xp[a.id] ?? 0).L}. Success: ${a.vision}${a.noScore ? " (He chose not to self-rate this area.)" : ""}`);
  }
  out.push(`Overall alignment, last 8 weeks: ${recentWeeks(today, 8).map((w) => pct(alignment(doc, w, today))).join(", ")}. (Alignment weighs the average with the weakest area.)`);

  const days = trackedDays(doc, wk, today);
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, -i));
  const prev30 = Array.from({ length: 30 }, (_, i) => addDays(today, -30 - i));
  const count = (keys: string[], hid: string) => keys.filter((k) => doc.days[k]?.done?.[hid]).length;
  out.push(`\n[ENTERED] DAILY QUESTS: days kept this week / last 30 days / the 30 days before that:`);
  for (const h of doc.habits) out.push(`- ${h.name}: ${count(days, h.id)}/${days.length} this week, ${count(last30, h.id)} vs ${count(prev30, h.id)}`);

  const d = doc.days[today];
  if (d) {
    out.push(`\n[ENTERED] TODAY: intention "${d.intention || "none"}". Priorities: ${d.priorities.map((p) => `${p.t || "(blank)"}${p.d ? " [done]" : ""}`).join(" | ")}.`);
    out.push(`Quests done today: ${doc.habits.filter((h) => d.done?.[h.id]).map((h) => h.name).join(", ") || "none yet"}.`);
  }
  out.push(`\n[ENTERED] THIS WEEK'S MISSIONS:`);
  for (const g of doc.goals.filter((g) => g.week === wk)) out.push(`- ${g.title} (${doc.areas.find((a) => a.id === g.areaId)?.name ?? ""}): ${g.count}/${g.target}`);
  const openMs = doc.milestones.filter((m) => !m.done).map((m) => m.title);
  if (openMs.length) out.push(`Long-term milestones in progress: ${openMs.join("; ")}.`);
  if (doc.schedule[wk]) out.push(`\n[ENTERED] HIS NOTE ABOUT THIS WEEK'S CALENDAR: ${doc.schedule[wk]}`);

  if (access.reflections) {
    const keys = Object.keys(doc.reflections).filter((k) => doc.reflections[k].done || Object.values(doc.reflections[k].areas || {}).some((e) => e?.note)).sort().slice(-3);
    for (const k of keys) {
      const r = doc.reflections[k];
      const parts = doc.areas.map((a) => {
        const e = r.areas?.[a.id];
        return e && (e.note || e.rating) ? `${a.name}${e.rating ? ` ${e.rating}/5` : ""}: ${e.note ?? ""}` : "";
      }).filter(Boolean);
      out.push(`\n[REFLECTION] WEEK OF ${k}: Lived what matters: ${r.wins || "-"}. Will protect next: ${r.next || "-"}. ${parts.join(" | ")}`);
    }
  }

  if (access.network) {
    const visible: NetworkData = {
      people: net.people.filter((p) => p.aiAccess),
      interactions: [],
      commitments: [],
    };
    const ids = new Set(visible.people.map((p) => p.id));
    visible.interactions = net.interactions.filter((i) => ids.has(i.personId));
    visible.commitments = net.commitments.filter((c) => ids.has(c.personId));
    const byId = new Map(visible.people.map((p) => [p.id, p]));

    out.push(`\n[ENTERED] RELATIONSHIP GOALS:`);
    for (const g of doc.networkGoals ?? []) out.push(`- ${g.title} (${METRIC_LABEL[g.metric]}, this ${g.period}): ${metricCount(g.metric, g.period, visible, today)}/${g.target}`);
    const rec = reconnectList(visible, today).slice(0, 8);
    if (rec.length) out.push(`Due for a reconnect: ${rec.map((r) => `${r.person.name} (${r.why})`).join("; ")}.`);
    const up = upcomingMeetings(visible, today).slice(0, 6);
    if (up.length) out.push(`Upcoming: ${up.map((i) => `${byId.get(i.personId)?.name} on ${i.occurredOn} (${i.kind})`).join("; ")}.`);
    const nt = needsTakeaways(visible, today);
    if (nt.length) out.push(`Recent meetings with no notes yet: ${nt.map((i) => `${byId.get(i.personId)?.name} ${i.occurredOn}`).join("; ")}.`);
    const oc = openCommitments(visible).slice(0, 8);
    if (oc.length) out.push(`Open commitments: ${oc.map((c) => `${c.text} for ${byId.get(c.personId)?.name}${c.dueOn ? ` by ${c.dueOn}` : ""}`).join("; ")}.`);

    const focus = new Map<string, Person>();
    for (const p of mentioned(visible.people, message)) focus.set(p.id, p);
    for (const i of up.slice(0, 3)) { const p = byId.get(i.personId); if (p) focus.set(p.id, p); }
    for (const r of rec.slice(0, 3)) focus.set(r.person.id, r.person);
    if (focus.size) out.push(`\n[ENTERED] PEOPLE IN FOCUS (his notes):\n${[...focus.values()].slice(0, 8).map((p) => personDetail(p, visible, today)).join("\n")}`);
    if (visible.people.length) {
      out.push(`\n[ENTERED] DIRECTORY (${visible.people.length} people he chose to share with the coach):`);
      for (const p of visible.people.slice(0, 150)) out.push(personLine(p, visible, today));
      const newThisMonth = visible.people.filter((p) => daysBetween(p.addedOn, today) <= 30).length;
      out.push(`Added in the last 30 days: ${newThisMonth}.`);
    } else {
      out.push("No people in his network are shared with the coach.");
    }
  }
  return out.join("\n");
}
