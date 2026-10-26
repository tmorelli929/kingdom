import { z } from "zod";
import { CalendarExpired, calendarsOf, canListCalendars, disconnect, getConnection, refreshCalendarList, setSelected } from "@/lib/google-calendar";
import { disconnectGmail, getGmail } from "@/lib/gmail";
import { authed, fail, json, readJson } from "@/lib/http";

// What's connected, and which of his Google calendars are included. Tokens never leave the server.
export const GET = authed(async (_req, user) => {
  const g = await getGmail(user.id);
  const gmail = g ? { email: g.accountEmail, status: g.status, lastSyncedAt: g.lastSyncedAt } : null;
  const c = await getConnection(user.id);
  if (!c) return json({ calendar: null, gmail });
  let calendars = calendarsOf(c);
  if (c.status === "ok") {
    try { calendars = await refreshCalendarList(c); } catch (e) { if (!(e instanceof CalendarExpired)) throw e; }
  }
  const fresh = await getConnection(user.id);
  return json({ calendar: {
    email: c.accountEmail, status: fresh?.status ?? c.status, since: c.createdAt, lastSyncedAt: fresh?.lastSyncedAt ?? null,
    canList: canListCalendars(c), calendars,
  }, gmail });
});

// PATCH { calendars: { [calendarId]: boolean } }: choose which calendars to include.
export const PATCH = authed(async (req, user) => {
  const body = z.object({ calendars: z.record(z.string().max(300), z.boolean()) }).parse(await readJson(req));
  const c = await getConnection(user.id);
  if (!c) return fail(404, "Google Calendar isn't connected.");
  return json({ calendars: await setSelected(c, body.calendars) });
});

// DELETE { provider: "calendar" | "gmail" }: revokes access with Google and deletes the stored tokens.
export const DELETE = authed(async (req, user) => {
  const body = (await readJson(req)) as { provider?: string };
  if (body.provider === "gmail") {
    const g = await getGmail(user.id);
    if (g) await disconnectGmail(g);
    return json({ ok: true });
  }
  if (body.provider !== "calendar") return fail(400, "Unknown connection.");
  const c = await getConnection(user.id);
  if (c) await disconnect(c);
  return json({ ok: true });
});
