import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authed, fail, json, readJson } from "@/lib/http";
import { todayIn } from "@/lib/life/dates";
import { looksLikeLifeDoc } from "@/lib/life/migrate";
import { fetchHeadlines, plainBrief, type Brief } from "@/lib/news";

export const maxDuration = 60;
const DAILY_LIMIT = 12;
type Stored = Brief & { date: string; topics: string[]; at: string; v?: number };
const VERSION = 2; // briefs made before pictures are remade

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
  const fresh = cur && cur.date === todayIn(tz) && cur.v === VERSION;
  return json({ configured: true, news: fresh ? cur : null, stale: cur && !fresh ? cur : null });
});

// POST { tz }: gathers today's headlines on his topics from the news feeds.
export const POST = authed(async (req, user) => {
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
    const all = await fetchHeadlines(topics, (life.data.newsLocation ?? "").slice(0, 100));
    if (!all.length) return fail(502, "Couldn't reach the news feeds just now. Try again shortly.");
    brief = plainBrief(all);
  } catch (e) {
    console.error("news failed:", e instanceof Error ? e.name : "unknown");
    return fail(502, "Couldn't fetch news just now. Try again shortly.");
  }
  const stored: Stored = { ...brief, date: today, topics, at: new Date().toISOString(), v: VERSION };
  await db.insert(schema.coachMessages).values({ userId: user.id, kind: "news", role: "assistant", content: JSON.stringify(stored) });
  return json({ news: stored });
});
