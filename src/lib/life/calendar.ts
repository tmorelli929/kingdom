import type { NetworkData } from "./network";

// A calendar event, already converted to his local time zone. Times are minutes after midnight.
export type CalEvent = {
  id: string;
  title: string;
  date: string; // local YYYY-MM-DD the event starts on
  start: number | null; // null for all-day events
  end: number | null; // capped at 1440 when the event runs past midnight
  allDay: boolean;
  free: boolean; // marked "free" in Google, so it doesn't count as busy
  attendees: { email: string; name: string }[];
  calendarId?: string;
  calendar?: string; // calendar name, e.g. "Holidays in United States"
  color?: string;
  multiDay?: boolean; // part of an event spanning more than one day
};

export const EVENING: [number, number] = [18 * 60, 21 * 60 + 30];
const OVERLOAD_MINUTES = 6 * 60;
const OVERLOAD_EVENTS = 6;

export type DaySummary = { date: string; count: number; busyMinutes: number; eveningFree: boolean; overloaded: boolean };

// Busy time merges overlapping events, so two meetings at once count once.
export function summarizeDay(events: CalEvent[], date: string): DaySummary {
  const timed = events.filter((e) => e.date === date && !e.allDay && !e.free && e.start !== null && e.end !== null)
    .map((e) => [e.start!, Math.max(e.start!, e.end!)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  let busy = 0, curS = -1, curE = -1;
  for (const [s, e] of timed) {
    if (s > curE) { if (curE > curS) busy += curE - curS; curS = s; curE = e; }
    else curE = Math.max(curE, e);
  }
  if (curE > curS) busy += curE - curS;
  const eveningFree = !timed.some(([s, e]) => s < EVENING[1] && e > EVENING[0]);
  const count = events.filter((e) => e.date === date).length;
  return { date, count, busyMinutes: busy, eveningFree, overloaded: busy >= OVERLOAD_MINUTES || timed.length >= OVERLOAD_EVENTS };
}

export const fmtTime = (m: number) => {
  const h = Math.floor(m / 60) % 24, mm = m % 60;
  return `${((h + 11) % 12) + 1}${mm ? ":" + String(mm).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`;
};
export const fmtHours = (m: number) => `${Math.round((m / 60) * 10) / 10}h`;

export type LinkSuggestion = { eventId: string; title: string; date: string; personId: string; personName: string; why: string };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Events that look like they involve someone in his network. Nothing is linked until he confirms.
export function suggestLinks(events: CalEvent[], net: NetworkData, dismissed: string[]): LinkSuggestion[] {
  const linked = new Set(net.interactions.map((i) => i.sourceEventId).filter(Boolean));
  const skip = new Set(dismissed);
  const out: LinkSuggestion[] = [];
  for (const e of events) {
    if (linked.has(e.id) || skip.has(e.id) || e.allDay) continue;
    const title = norm(e.title);
    for (const p of net.people) {
      const email = norm(p.email);
      const byEmail = email && e.attendees.some((a) => norm(a.email) === email);
      const name = norm(p.name);
      const byName = name.includes(" ") && title.includes(name);
      if (byEmail || byName) {
        out.push({ eventId: e.id, title: e.title, date: e.date, personId: p.id, personName: p.name, why: byEmail ? `${p.email} is invited` : `"${p.name}" is in the title` });
        break;
      }
    }
  }
  return out;
}

// Picks an interaction kind from the event title.
export function kindFor(title: string) {
  const t = title.toLowerCase();
  if (/coffee|latte|breakfast|lunch|dinner/.test(t)) return "coffee";
  if (/call|phone|zoom|meet\b|teams/.test(t)) return "call";
  return "meeting";
}
