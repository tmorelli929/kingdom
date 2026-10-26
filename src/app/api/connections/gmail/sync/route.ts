import { z } from "zod";
import { CalendarExpired } from "@/lib/google-calendar";
import { NoKey, runDigest } from "@/lib/digest";
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
    const r = await syncGmail(c, tz, { ifStale: body.ifStale });
    if (r.skipped === "fresh") return json({ connected: true, ...r });
    let digest;
    try { digest = await runDigest(c, tz); } catch (e) { if (e instanceof CalendarExpired || e instanceof NoKey) throw e; digest = { found: 0, suggested: 0, problem: "error" as const }; }
    return json({ connected: true, ...r, digest });
  } catch (e) {
    if (e instanceof CalendarExpired) return json({ connected: true, expired: true });
    if (e instanceof Error && e.message.startsWith("Gmail returned")) return fail(502, e.message);
    throw e;
  }
});
