import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { googleClient } from "@/lib/auth/google";
import { open, seal } from "@/lib/crypto";
import { addDays } from "@/lib/life/dates";
import type { CalEvent } from "@/lib/life/calendar";

export const PROVIDER = "google_calendar";
// Read-only access to events. Kingdom never creates, edits or deletes anything on the calendar.
export const CALENDAR_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events.readonly"];

export type Connection = typeof schema.connections.$inferSelect;

export async function getConnection(userId: string) {
  const [row] = await db.select().from(schema.connections).where(and(eq(schema.connections.userId, userId), eq(schema.connections.provider, PROVIDER))).limit(1);
  return row ?? null;
}

export async function saveConnection(userId: string, v: { refreshToken: string; accessToken: string; expiresAt: Date; scope: string; accountEmail: string }) {
  const values = {
    userId, provider: PROVIDER, accountEmail: v.accountEmail, scope: v.scope, status: "ok",
    refreshToken: seal(v.refreshToken), accessToken: seal(v.accessToken), accessExpiresAt: v.expiresAt,
  };
  await db.insert(schema.connections).values(values).onConflictDoUpdate({
    target: [schema.connections.userId, schema.connections.provider],
    set: { ...values, dismissed: [] },
  });
}

export class CalendarExpired extends Error {}

async function accessToken(c: Connection) {
  if (c.accessToken && c.accessExpiresAt && c.accessExpiresAt.getTime() > Date.now() + 60_000) return open(c.accessToken);
  try {
    const t = await googleClient().refreshAccessToken(open(c.refreshToken));
    const token = t.accessToken();
    await db.update(schema.connections).set({ accessToken: seal(token), accessExpiresAt: t.accessTokenExpiresAt(), status: "ok" }).where(eq(schema.connections.id, c.id));
    return token;
  } catch {
    // Google refused the refresh token (revoked, or expired while the app was in Testing).
    await db.update(schema.connections).set({ status: "expired", accessToken: null }).where(eq(schema.connections.id, c.id));
    throw new CalendarExpired("Calendar access expired. Reconnect it in Setup.");
  }
}

// Local date and minutes-after-midnight of an instant, in his time zone.
function local(iso: string, tz: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

type GEvent = {
  id: string; status?: string; summary?: string; transparency?: string; eventType?: string;
  start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string };
  attendees?: { email?: string; displayName?: string; self?: boolean; responseStatus?: string }[];
};

// Events on his primary calendar from `from` for `days` days. Only titles, times and attendees are kept;
// descriptions, locations and links are never requested.
export async function fetchEvents(c: Connection, from: string, days: number, tz: string): Promise<CalEvent[]> {
  const token = await accessToken(c);
  const to = addDays(from, days);
  const params = new URLSearchParams({
    timeMin: new Date(`${addDays(from, -1)}T00:00:00Z`).toISOString(),
    timeMax: new Date(`${addDays(to, 1)}T00:00:00Z`).toISOString(),
    singleEvents: "true", orderBy: "startTime", maxResults: "250",
    fields: "items(id,status,summary,transparency,eventType,start,end,attendees(email,displayName,self,responseStatus))",
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (res.status === 401 || res.status === 403) {
    await db.update(schema.connections).set({ status: "expired", accessToken: null }).where(eq(schema.connections.id, c.id));
    throw new CalendarExpired("Calendar access was removed. Reconnect it in Setup.");
  }
  if (!res.ok) throw new Error(`Google Calendar returned ${res.status}`);
  const body = (await res.json()) as { items?: GEvent[] };
  const out: CalEvent[] = [];
  for (const g of body.items ?? []) {
    if (g.status === "cancelled" || g.eventType === "workingLocation") continue;
    if (g.attendees?.some((a) => a.self && a.responseStatus === "declined")) continue;
    const attendees = (g.attendees ?? []).filter((a) => !a.self && a.email).slice(0, 20).map((a) => ({ email: a.email!, name: a.displayName ?? "" }));
    const base = { id: g.id, title: (g.summary ?? "(no title)").slice(0, 200), free: g.transparency === "transparent", attendees };
    if (g.start?.date) {
      // All-day events: one entry per day they cover, within range.
      for (let d = g.start.date; d < (g.end?.date ?? addDays(g.start.date, 1)); d = addDays(d, 1)) {
        if (d >= from && d < to) out.push({ ...base, date: d, start: null, end: null, allDay: true });
      }
    } else if (g.start?.dateTime && g.end?.dateTime) {
      const s = local(g.start.dateTime, tz), e = local(g.end.dateTime, tz);
      if (s.date < from || s.date >= to) continue;
      out.push({ ...base, date: s.date, start: s.minutes, end: e.date === s.date ? e.minutes : 1440, allDay: false });
    }
  }
  return out;
}

export async function disconnect(c: Connection) {
  try { await googleClient().revokeToken(open(c.refreshToken)); } catch { /* already revoked; delete anyway */ }
  await db.delete(schema.connections).where(eq(schema.connections.id, c.id));
}
