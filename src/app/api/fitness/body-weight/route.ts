import { z } from "zod";
import { db, schema } from "@/db";
import { authed, json, readJson } from "@/lib/http";

// Optional body weight, one entry per day.
export const POST = authed(async (req, user) => {
  const b = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), weight: z.number().min(50).max(800) }).parse(await readJson(req));
  await db.insert(schema.bodyWeights).values({ userId: user.id, ...b }).onConflictDoUpdate({ target: [schema.bodyWeights.userId, schema.bodyWeights.date], set: { weight: b.weight } });
  return json({ ok: true });
});
