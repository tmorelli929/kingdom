import { z } from "zod";
import { db, schema } from "@/db";
import { kindFor } from "@/lib/life/calendar";
import { authed, fail, json, readJson } from "@/lib/http";
import { ownsPerson } from "@/lib/network-db";

const input = z.object({
  eventId: z.string().min(1).max(1024),
  personId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().max(200).default(""),
});

// He confirmed a calendar event was with this person: log it as a meeting (planned if it's in the future).
export const POST = authed(async (req, user) => {
  const b = input.parse(await readJson(req));
  if (!(await ownsPerson(user.id, b.personId))) return fail(404, "That person isn't in your network.");
  const [row] = await db.insert(schema.interactions).values({
    userId: user.id, personId: b.personId, occurredOn: b.date, kind: kindFor(b.title), summary: "", sourceEventId: b.eventId,
  }).returning();
  return json({ id: row.id });
});
