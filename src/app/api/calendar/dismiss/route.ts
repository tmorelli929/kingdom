import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { PROVIDER } from "@/lib/google-calendar";
import { authed, json, readJson } from "@/lib/http";

// "Not about anyone": stop suggesting a link for this event.
export const POST = authed(async (req, user) => {
  const { eventId } = z.object({ eventId: z.string().min(1).max(1024) }).parse(await readJson(req));
  await db.update(schema.connections)
    .set({ dismissed: sql`(array_append(${schema.connections.dismissed}, ${eventId}))[greatest(1, cardinality(${schema.connections.dismissed}) - 498):]` })
    .where(and(eq(schema.connections.userId, user.id), eq(schema.connections.provider, PROVIDER)));
  return json({ ok: true });
});
