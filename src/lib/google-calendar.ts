import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { googleClient } from "@/lib/auth/google";
import { open, seal } from "@/lib/crypto";
import { addDays } from "@/lib/life/dates";
import type { CalEvent } from "@/lib/life/calendar";

export const PROVIDER = "google_calendar";
// Read-only: event details, plus the list of his calendars so he can choose which ones to include.
// Kingdom never creates, edits or deletes anything on the calendar.
const EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
const LIST_SCOPE = "https://www.googleapis.com/auth/calendar.calendarlist.readonly";
export const CALENDAR_SCOPES = ["openid", "email", EVENTS_SCOPE, LIST_SCOPE];

export type Connection = typeof schema.connections.$inferSelect;
export type CalendarInfo = { id: string; name: string; color: string; primary: boolean; selected: boolean; access: string };
export type CalendarProblem = { calendar: string; message: string };

export const canListCalendars = (c: Connection) => c.scope.split(" ").some((s) => s.endsWith("/calendar.calendarlist.readonly"));
export const calendarsOf = (c: Connection) => (c.calendars as CalendarInfo[]) ?? [];

export async function getConnection(userId: string, provider = PROVIDER) {
  const [row] = await db.select().from(schema.connections).where(and(eq(schema.connections.userId, userId), eq(schema.connections.provider, provider))).limit(1);
  return row ?? null;
}

export async function saveConnection(userId: string, v: { refreshToken: string; accessToken: string; expiresAt: Date; scope: string; accountEmail: string }, provider = PROVIDER) {
  const values = {
    userId, provider, accountEmail: v.accountEmail, scope: v.scope, status: "ok",
    refreshToken: seal(v.refreshToken), accessToken: seal(v.accessToken), accessExpiresAt: v.expiresAt,
  };
  // Reconnecting keeps his calendar choices and dismissed suggestions.
  await db.insert(schema.connections).values(values).onConflictDoUpdate({
    target: [schema.connections.userId, schema.connections.provider],
    set: values,
  });
}

export class CalendarExpired extends Error {}

async function markExpired(c: Connection) {
  await db.update(schema.connections).set({ status: "expired", accessToken: null }).where(eq(schema.connections.id, c.id));
}

// A fresh access token for any Google connection (Calendar or Gmail), refreshing it when needed.
export async function accessToken(c: Connection) {
  if (c.accessToken && c.accessExpiresAt && c.accessExpiresAt.getTime() > Date.now() + 60_000) return open(c.accessToken);
  try {
    const t = await googleClient().refreshAccessToken(open(c.refreshToken));
    const token = t.accessToken();
    await db.update(schema.connections).set({ accessToken: seal(token), accessExpiresAt: t.accessTokenExpiresAt(), status: "ok" }).where(eq(schema.connections.id, c.id));
    return token;
  } catch {
    // Google refused the refresh token (revoked, or expired while the app was in Testing).
    await markExpired(c);
    throw new CalendarExpired(`${c.provider === "gmail" ? "Gmail" : "Calendar"} access expired. Reconnect it in Settings.`);
  }
}

async function google<T>(c: Connection, token: string, path: string, params: Record<string, string>) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (res.status === 401) { await markExpired(c); throw new CalendarExpired("Calendar access was removed. Reconnect it in Settings."); }
  return { status: res.status, body: res.ok ? ((await res.json()) as T) : null };
}

type GCal = { id: string; summary?: string; summaryOverride?: string; backgroundColor?: string; primary?: boolean; selected?: boolean; accessRole?: string; hidden?: boolean; deleted?: boolean };

// Refreshes his list of calendars from Google. New calendars start included if they're shown in his
// Google Calendar; ones he already turned on or off here keep his choice.
export async function refreshCalendarList(c: Connection): Promise<CalendarInfo[]> {
  if (!canListCalendars(c)) return calendarsOf(c);
  const token = await accessToken(c);
  const r = await google<{ items?: GCal[] }>(c, token, "users/me/calendarList", { maxResults: "250", fields: "items(id,summary,summaryOverride,backgroundColor,primary,selected,accessRole,hidden,deleted)" });
  if (!r.body) return calendarsOf(c);
  const prev = new Map(calendarsOf(c).map((x) => [x.id, x]));
  const list = (r.body.items ?? []).filter((g) => !g.deleted).map((g) => ({
    id: g.id,
    name: g.summaryOverride || g.summary || g.id,
    color: g.backgroundColor ?? "#8fa3b8",
    primary: !!g.primary,
    access: g.accessRole ?? "",
    selected: prev.get(g.id)?.selected ?? (!!g.primary || (!!g.selected && !g.hidden)),
  })).sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
  await db.update(schema.connections).set({ calendars: list }).where(eq(schema.connections.id, c.id));
  return list;
}

export async function setSelected(c: Connection, choice: Record<string, boolean>) {
  const list = calendarsOf(c).map((x) => (x.id in choice ? { ...x, selected: choice[x.id] } : x));
  await db.update(schema.connections).set({ calendars: list }).where(eq(schema.connections.id, c.id));
  return list;
}

// Local date and minutes-after-midnight of an instant, in his time zone.
function local(iso: string, tz: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

type GEvent = {
  id: string; iCalUID?: string; status?: string; summary?: string; transparency?: string; eventType?: string;
  start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string };
  attendees?: { email?: string; displayName?: string; self?: boolean; responseStatus?: string }[];
};

// Turns one Google event into one entry per local day it touches, within [from, to).
export function expandEvent(g: GEvent, cal: { id: string; name: string; color: string }, from: string, to: string, tz: string): CalEvent[] {
  if (g.status === "cancelled" || g.eventType === "workingLocation") return [];
  if (g.attendees?.some((a) => a.self && a.responseStatus === "declined")) return [];
  const attendees = (g.attendees ?? []).filter((a) => !a.self && a.email).slice(0, 20).map((a) => ({ email: a.email!, name: a.displayName ?? "" }));
  const base = { id: g.id, title: (g.summary ?? "(no title)").slice(0, 200), free: g.transparency === "transparent", attendees, calendarId: cal.id, calendar: cal.name, color: cal.color };
  const out: CalEvent[] = [];
  if (g.start?.date) {
    // All-day: plain dates with an exclusive end, never shifted through a time zone.
    const end = g.end?.date && g.end.date > g.start.date ? g.end.date : addDays(g.start.date, 1);
    for (let d = g.start.date < from ? from : g.start.date; d < end && d < to; d = addDays(d, 1)) {
      out.push({ ...base, date: d, start: null, end: null, allDay: true, multiDay: end > addDays(g.start.date, 1) });
    }
  } else if (g.start?.dateTime && g.end?.dateTime) {
    const s = local(g.start.dateTime, tz), e = local(g.end.dateTime, tz);
    // Timed events that cross midnight appear on each day they cover.
    for (let d = s.date < from ? from : s.date; d <= e.date && d < to; d = addDays(d, 1)) {
      const startM = d === s.date ? s.minutes : 0;
      const endM = d === e.date ? e.minutes : 1440;
      if (d !== s.date && endM === 0) break; // ends exactly at midnight
      out.push({ ...base, date: d, start: startM, end: Math.max(startM, endM), allDay: false, multiDay: s.date !== e.date });
    }
  }
  return out;
}

// Events from every calendar he's included, from `from` for `days` days. Only titles, times and
// attendees are read; descriptions, locations and links are never requested. A calendar that can't
// be read is reported, not silently dropped.
export async function fetchEvents(c: Connection, from: string, days: number, tz: string): Promise<{ events: CalEvent[]; problems: CalendarProblem[] }> {
  const token = await accessToken(c);
  const to = addDays(from, days);
  const cals = calendarsOf(c).filter((x) => x.selected);
  const targets = cals.length ? cals : [{ id: "primary", name: "Primary calendar", color: "#d6b26a" }];
  const problems: CalendarProblem[] = [];
  const results = await Promise.all(targets.map(async (cal) => {
    const events: CalEvent[] = [];
    let pageToken = "";
    for (let page = 0; page < 5; page++) {
      const params: Record<string, string> = {
        timeMin: new Date(`${addDays(from, -1)}T00:00:00Z`).toISOString(),
        timeMax: new Date(`${addDays(to, 1)}T00:00:00Z`).toISOString(),
        singleEvents: "true", orderBy: "startTime", maxResults: "250", showDeleted: "false",
        fields: "nextPageToken,items(id,iCalUID,status,summary,transparency,eventType,start,end,attendees(email,displayName,self,responseStatus))",
      };
      if (pageToken) params.pageToken = pageToken;
      try {
        const r = await google<{ items?: GEvent[]; nextPageToken?: string }>(c, token, `calendars/${encodeURIComponent(cal.id)}/events`, params);
        if (!r.body) {
          problems.push({ calendar: cal.name, message: r.status === 403 ? "Google didn't allow reading this calendar's events." : r.status === 404 ? "This calendar no longer exists or isn't shared with you." : `Google returned an error (${r.status}).` });
          break;
        }
        for (const g of r.body.items ?? []) events.push(...expandEvent(g, cal, from, to, tz));
        if (!r.body.nextPageToken) break;
        pageToken = r.body.nextPageToken;
      } catch (e) {
        if (e instanceof CalendarExpired) throw e;
        problems.push({ calendar: cal.name, message: "Couldn't reach Google for this calendar." });
        break;
      }
    }
    return events;
  }));
  // The same meeting can sit on two of his calendars; show it once.
  const seen = new Set<string>();
  const events = results.flat().filter((e) => {
    const k = `${e.title}|${e.date}|${e.start}|${e.end}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date) || Number(b.allDay) - Number(a.allDay) || (a.start ?? 0) - (b.start ?? 0));
  await db.update(schema.connections).set({ lastSyncedAt: new Date() }).where(eq(schema.connections.id, c.id));
  return { events, problems };
}

export async function disconnect(c: Connection) {
  try { await googleClient().revokeToken(open(c.refreshToken)); } catch { /* already revoked; delete anyway */ }
  await db.delete(schema.connections).where(eq(schema.connections.id, c.id));
}
