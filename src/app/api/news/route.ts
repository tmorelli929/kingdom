import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { env } from "@/lib/env";
import { authed, fail, json, readJson } from "@/lib/http";
import { todayIn } from "@/lib/life/dates";
import { looksLikeLifeDoc } from "@/lib/life/migrate";
import { fetchNews, type Brief } from "@/lib/news";

export const maxDuration = 120; // several web searches can take a minute or more
const DAILY_LIMIT = 6;
type Stored = Brief & { date: string; topics: string[]; at: string };

async function latest(userId: string) {
  const [row] = await db.select({ content: schema.coachMessages.content }).from(schema.coachMessages)
    .where(and(eq(schema.coachMessages.userId, userId), eq(schema.coachMessages.kind, "news")))
    .orderBy(desc(schema.coachMessages.createdAt)).limit(1);
  try { return row ? (JSON.parse(row.content) as Stored) : null; } catch { return null; }
}

// GET ?tz=: today's brief if it's been made (so a page load doesn't trigger a search).
export const GET = authed(async (req, user) => {
  const tz = new URL(req.url).searchParams.get("tz") ?? undefined;
  const cur = await latest(user.id);
  return json({ configured: !!env().ANTHROPIC_API_KEY, news: cur && cur.date === todayIn(tz) ? cur : null, stale: cur && cur.date !== todayIn(tz) ? cur : null });
});

// POST { tz }: searches the web for today's news on his topics.
export const POST = authed(async (req, user) => {
  const key = env().ANTHROPIC_API_KEY;
  if (!key) return fail(503, "News needs an Anthropic API key in the app's hosting settings.");
  const body = z.object({ tz: z.string().max(64).optional() }).parse(await readJson(req));
  const made = await db.select({ id: schema.coachMessages.id }).from(schema.coachMessages)
    .where(and(eq(schema.coachMessages.userId, user.id), eq(schema.coachMessages.kind, "news"), gte(schema.coachMessages.createdAt, new Date(Date.now() - 86400000))));
  if (made.length >= DAILY_LIMIT) return fail(429, "News was already refreshed a lot today. Try again tomorrow.");
  const [life] = await db.select().from(schema.lifeDocs).where(eq(schema.lifeDocs.userId, user.id)).limit(1);
  if (!life || !looksLikeLifeDoc(life.data)) return fail(400, "Set up your dashboard first.");
  const topics = (life.data.newsTopics ?? []).map((t) => t.trim().slice(0, 100)).filter(Boolean).slice(0, 12);
  if (!topics.length) return fail(400, "Add a few news topics in Settings first.");

  const today = todayIn(body.tz);
  let brief: Brief;
  try {
    brief = await fetchNews(user.id, key, topics, today, (life.data.newsLocation ?? "").slice(0, 100), (life.data.newsAbout ?? "").slice(0, 600));
  } catch (e) {
    console.error("news failed:", e instanceof Error ? e.name : "unknown");
    return fail(502, e instanceof Anthropic.AuthenticationError ? "The Anthropic API key was rejected." : "Couldn't fetch news just now. Try again shortly.");
  }
  const stored: Stored = { ...brief, date: today, topics, at: new Date().toISOString() };
  await db.insert(schema.coachMessages).values({ userId: user.id, kind: "news", role: "assistant", content: JSON.stringify(stored) });
  return json({ news: stored });
});
