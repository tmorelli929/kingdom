import { and, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { authed, json } from "@/lib/http";
import { todayIn } from "@/lib/life/dates";

// GET ?tz=: estimated AI spend today, this month and all time, with this month split by feature.
export const GET = authed(async (req, user) => {
  const tz = new URL(req.url).searchParams.get("tz") ?? undefined;
  const today = todayIn(tz);
  const month = today.slice(0, 7);
  const rows = await db.select({ feature: schema.aiUsage.feature, cost: schema.aiUsage.costMicros, searches: schema.aiUsage.searches, at: schema.aiUsage.createdAt })
    .from(schema.aiUsage).where(and(eq(schema.aiUsage.userId, user.id), gte(schema.aiUsage.createdAt, new Date(Date.now() - 400 * 86400000))));
  const day = (d: Date) => todayIn(tz, d);
  let todayM = 0, monthM = 0, allM = 0, calls = 0, searches = 0;
  const byFeature: Record<string, number> = {};
  for (const r of rows) {
    const d = day(r.at);
    allM += r.cost;
    if (d === today) todayM += r.cost;
    if (d.startsWith(month)) { monthM += r.cost; calls++; searches += r.searches; byFeature[r.feature] = (byFeature[r.feature] ?? 0) + r.cost; }
  }
  const usd = (m: number) => m / 1e6;
  return json({ today: usd(todayM), month: usd(monthM), total: usd(allM), calls, searches, byFeature: Object.fromEntries(Object.entries(byFeature).map(([k, v]) => [k, usd(v)])) });
});
