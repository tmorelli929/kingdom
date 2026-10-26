import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { authed, json } from "@/lib/http";

// GET: network updates proposed from his daily digest, waiting for his approval.
export const GET = authed(async (_req, user) => {
  const rows = await db.select({
    id: schema.suggestions.id, personName: schema.suggestions.personName, personId: schema.suggestions.personId,
    occurredOn: schema.suggestions.occurredOn, kind: schema.suggestions.kind, summary: schema.suggestions.summary, followUp: schema.suggestions.followUp,
  }).from(schema.suggestions)
    .where(and(eq(schema.suggestions.userId, user.id), eq(schema.suggestions.status, "pending")))
    .orderBy(asc(schema.suggestions.occurredOn), asc(schema.suggestions.ord));
  return json({ suggestions: rows });
});
