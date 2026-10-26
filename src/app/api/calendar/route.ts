import { suggestLinks } from "@/lib/life/calendar";
import { CalendarExpired, canListCalendars, fetchEvents, getConnection } from "@/lib/google-calendar";
import { authed, fail, json } from "@/lib/http";
import { loadNetwork } from "@/lib/network-db";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET ?from=YYYY-MM-DD&days=N&tz=Area/City: his events, plus meetings that may involve people in his network.
export const GET = authed(async (req, user) => {
  const q = new URL(req.url).searchParams;
  const from = q.get("from") ?? "";
  const days = Math.min(21, Math.max(1, Number(q.get("days")) || 7));
  const tz = q.get("tz") || "UTC";
  if (!DATE.test(from)) return fail(400, "Missing start date.");
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); } catch { return fail(400, "Unknown time zone."); }
  const c = await getConnection(user.id);
  if (!c) return json({ connected: false });
  if (c.status !== "ok") return json({ connected: true, status: "expired", events: [], suggestions: [] });
  try {
    const { events, problems } = await fetchEvents(c, from, days, tz);
    const suggestions = suggestLinks(events, await loadNetwork(user.id), c.dismissed);
    return json({ connected: true, status: "ok", email: c.accountEmail, events, suggestions, problems, needsReconnectForList: !canListCalendars(c) });
  } catch (e) {
    if (e instanceof CalendarExpired) return json({ connected: true, status: "expired", events: [], suggestions: [] });
    throw e;
  }
});
