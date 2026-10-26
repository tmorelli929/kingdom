import Anthropic from "@anthropic-ai/sdk";
import { recordUsage } from "@/lib/usage";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { and, desc, eq, gte } from "drizzle-orm";
import * as z from "zod/v4";
import { db, schema } from "@/db";
import { COACH_SYSTEM } from "@/lib/coach";
import { assistantData } from "@/lib/coach-data";
import { env } from "@/lib/env";
import { authed, fail, json, readJson } from "@/lib/http";
import { todayIn } from "@/lib/life/dates";
import { looksLikeLifeDoc } from "@/lib/life/migrate";

export const maxDuration = 60;
const MODEL = "claude-opus-5-5";
const DAILY_LIMIT = 8;

const Insights = z.object({
  insights: z.array(z.object({
    area: z.enum(["calendar", "fitness", "habits", "network"]),
    title: z.string().describe("One short sentence: the pattern or what's coming, and what to do about it"),
    basis: z.string().describe("The exact numbers or dates from the data this rests on"),
  })),
});
type Stored = { date: string; items: z.infer<typeof Insights>["insights"]; at: string };

const ASK = `Give me up to 4 insights for today and the coming week. Each should be either a pattern in my data (use the PATTERNS section and the numbers above) or something coming up that's worth planning around, with a concrete suggestion. Only use what's in the data, and put the exact numbers or dates in "basis". Skip anything generic. If there isn't enough history for patterns yet, say so in one insight and focus on what's coming up.`;

async function latest(userId: string) {
  const [row] = await db.select({ content: schema.coachMessages.content }).from(schema.coachMessages)
    .where(and(eq(schema.coachMessages.userId, userId), eq(schema.coachMessages.kind, "insights")))
    .orderBy(desc(schema.coachMessages.createdAt)).limit(1);
  try { return row ? (JSON.parse(row.content) as Stored) : null; } catch { return null; }
}

// GET ?tz=: today's insights if they've been made, so the page doesn't spend a model call on every load.
export const GET = authed(async (req, user) => {
  const tz = new URL(req.url).searchParams.get("tz") ?? undefined;
  const cur = await latest(user.id);
  return json({ configured: !!env().ANTHROPIC_API_KEY, insights: cur && cur.date === todayIn(tz) ? cur : null, stale: cur && cur.date !== todayIn(tz) ? cur : null });
});

// POST { tz }: makes today's insights from his data.
export const POST = authed(async (req, user) => {
  const key = env().ANTHROPIC_API_KEY;
  if (!key) return fail(503, "Insights need an Anthropic API key in the app's hosting settings.");
  const body = z.object({ tz: z.string().max(64).optional() }).parse(await readJson(req));
  const made = await db.select({ id: schema.coachMessages.id }).from(schema.coachMessages)
    .where(and(eq(schema.coachMessages.userId, user.id), eq(schema.coachMessages.kind, "insights"), gte(schema.coachMessages.createdAt, new Date(Date.now() - 86400000))));
  if (made.length >= DAILY_LIMIT) return fail(429, "Insights were already refreshed a lot today. Try again tomorrow.");
  const [life] = await db.select().from(schema.lifeDocs).where(eq(schema.lifeDocs.userId, user.id)).limit(1);
  if (!life || !looksLikeLifeDoc(life.data)) return fail(400, "Set up your dashboard first.");

  const { today, context } = await assistantData(user.id, life.data, body.tz, "");
  const client = new Anthropic({ apiKey: key });
  let items;
  try {
    const msg = await client.messages.parse({
      model: MODEL, max_tokens: 8000, system: COACH_SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(Insights) },
      messages: [{ role: "user", content: `<my_data>\n${context}\n</my_data>\n\n${ASK}` }],
    });
    await recordUsage(user.id, "insights", msg.usage);
    items = (msg.parsed_output?.insights ?? []).slice(0, 4);
  } catch (e) {
    console.error("insights failed:", e instanceof Error ? e.name : "unknown");
    return fail(502, e instanceof Anthropic.AuthenticationError ? "The Anthropic API key was rejected." : "Couldn't make insights just now. Try again shortly.");
  }
  const stored: Stored = { date: today, items, at: new Date().toISOString() };
  await db.insert(schema.coachMessages).values({ userId: user.id, kind: "insights", role: "assistant", content: JSON.stringify(stored) });
  return json({ insights: stored });
});
