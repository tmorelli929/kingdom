import { z } from "zod";
import { CalendarExpired } from "@/lib/google-calendar";
import { getGmail, syncGmail } from "@/lib/gmail";
import { authed, fail, json, readJson } from "@/lib/http";

export const maxDuration = 60;

// POST { tz, ifStale? }: reads new mail headers and updates "last emailed" on people in his network.
export const POST = authed(async (req, user) => {
  const body = z.object({ tz: z.string().max(64).default("UTC"), ifStale: z.boolean().default(false) }).parse(await readJson(req));
  const c = await getGmail(user.id);
  if (!c) return json({ connected: false });
  if (c.status !== "ok") return json({ connected: true, expired: true });
  let tz = "UTC";
  try { tz = new Intl.DateTimeFormat("en-US", { timeZone: body.tz }).resolvedOptions().timeZone; } catch { /* keep UTC */ }
  try {
    return json({ connected: true, ...(await syncGmail(c, tz, { ifStale: body.ifStale })) });
  } catch (e) {
    if (e instanceof CalendarExpired) return json({ connected: true, expired: true });
    if (e instanceof Error && e.message.startsWith("Gmail returned")) return fail(502, e.message);
    throw e;
  }
});
