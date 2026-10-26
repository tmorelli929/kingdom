import { z } from "zod";
import { CalendarExpired, calendarsOf, canListCalendars, disconnect, getConnection, refreshCalendarList, setSelected } from "@/lib/google-calendar";
import { canReadDigest, DEFAULT_LABEL } from "@/lib/digest";
import { disconnectGmail, getGmail } from "@/lib/gmail";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { authed, fail, json, readJson } from "@/lib/http";

// What's connected, and which of his Google calendars are included. Tokens never leave the server.
export const GET = authed(async (_req, user) => {
  const g = await getGmail(user.id);
  const gmail = g ? { email: g.accountEmail, status: g.status, lastSyncedAt: g.lastSyncedAt, digest: canReadDigest(g), digestLabel: g.digestLabel || DEFAULT_LABEL } : null;
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
// PATCH { digestLabel }: the Gmail label that holds his daily digest emails.
export const PATCH = authed(async (req, user) => {
  const raw = await readJson(req);
  const label = z.object({ digestLabel: z.string().trim().min(1).max(100) }).safeParse(raw);
  if (label.success) {
    const g = await getGmail(user.id);
    if (!g) return fail(404, "Gmail isn't connected.");
    await db.update(schema.connections).set({ digestLabel: label.data.digestLabel }).where(eq(schema.connections.id, g.id));
    return json({ ok: true });
  }
  const body = z.object({ calendars: z.record(z.string().max(300), z.boolean()) }).parse(raw);
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
