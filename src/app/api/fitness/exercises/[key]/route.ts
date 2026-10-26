import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { exercisePatch } from "@/lib/fitness-db";
import { authed, fail, json, readJson } from "@/lib/http";

// Rename, record the exact machine, mark whether his gym has it, or change the weight increment.
export const PATCH = authed<{ params: Promise<{ key: string }> }>(async (req, user, ctx) => {
  const { key } = await ctx.params;
  const p = exercisePatch.parse(await readJson(req));
  if (!Object.keys(p).length) return fail(400, "Nothing to change.");
  const rows = await db.update(schema.exercises).set(p).where(and(eq(schema.exercises.userId, user.id), eq(schema.exercises.key, key))).returning({ key: schema.exercises.key });
  return rows.length ? json({ ok: true }) : fail(404, "That exercise wasn't found.");
});
