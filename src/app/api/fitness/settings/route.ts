import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authed, json, readJson } from "@/lib/http";

export const PATCH = authed(async (req, user) => {
  const p = z.object({ unit: z.enum(["lb", "kg"]).optional(), restTimer: z.boolean().optional() }).parse(await readJson(req));
  await db.update(schema.fitnessSettings).set(p).where(eq(schema.fitnessSettings.userId, user.id));
  return json({ ok: true });
});
