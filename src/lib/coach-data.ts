import { buildContext, type CalendarContext } from "@/lib/coach";
import { loadFitness } from "@/lib/fitness-db";
import { CalendarExpired, fetchEvents, getConnection } from "@/lib/google-calendar";
import { timeIn, todayIn } from "@/lib/life/dates";
import type { LifeDoc } from "@/lib/life/types";
import { loadNetwork } from "@/lib/network-db";
import { patterns } from "@/lib/insights";

// Today and the next 13 days of calendar, if connected and shared. A calendar problem never blocks the assistant.
async function calendarFor(userId: string, allowed: boolean, today: string, tz?: string): Promise<CalendarContext> {
  const c = await getConnection(userId);
  if (!c) return { status: "none" };
  if (!allowed) return { status: "hidden" };
  if (c.status !== "ok") return { status: "expired" };
  const zone = tz || "UTC";
  try { new Intl.DateTimeFormat("en", { timeZone: zone }); } catch { return { status: "error" }; }
  try {
    return { status: "ok", events: (await fetchEvents(c, today, 14, zone)).events };
  } catch (e) {
    return { status: e instanceof CalendarExpired ? "expired" : "error" };
  }
}

// Everything the assistant may see, as labeled text, plus the patterns computed from it.
export async function assistantData(userId: string, doc: LifeDoc, tz: string | undefined, message: string) {
  const today = todayIn(tz);
  const [net, fit, cal] = await Promise.all([
    loadNetwork(userId),
    loadFitness(userId).catch(() => null),
    calendarFor(userId, doc.coachAccess?.calendar !== false, today, tz),
  ]);
  const context = buildContext(doc, net, fit, today, timeIn(tz), message, cal);
  const found = patterns(doc, fit, today);
  return { today, context: `${context}\n\n[PATTERNS] Computed from the data above:\n${found.length ? found.map((p) => `- ${p}`).join("\n") : "- None yet; there isn't enough history."}` };
}
