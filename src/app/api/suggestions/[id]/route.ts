import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authed, fail, json, readJson } from "@/lib/http";
import { addCommitment, addInteraction, createPerson, ownsPerson } from "@/lib/network-db";

type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH { action: "apply", personId | "new", summary? } logs the conversation (and any follow-up as a commitment);
// { action: "dismiss" } drops it.
export const PATCH = authed<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  if (!UUID.test(id)) return fail(404, "That suggestion wasn't found.");
  const body = z.object({
    action: z.enum(["apply", "dismiss"]),
    personId: z.string().max(40).optional(),
    summary: z.string().trim().max(2000).optional(),
  }).parse(await readJson(req));
  const [s] = await db.select().from(schema.suggestions)
    .where(and(eq(schema.suggestions.id, id), eq(schema.suggestions.userId, user.id), eq(schema.suggestions.status, "pending"))).limit(1);
  if (!s) return fail(404, "That suggestion was already handled.");
  if (body.action === "dismiss") {
    await db.update(schema.suggestions).set({ status: "dismissed" }).where(eq(schema.suggestions.id, id));
    return json({ ok: true });
  }

  let personId = body.personId ?? s.personId ?? "new";
  if (personId === "new") {
    personId = (await createPerson(user.id, {
      name: s.personName, organization: "", title: "", linkedinUrl: "", email: "", location: "", metWhere: "Daily digest",
      metOn: s.occurredOn, categories: [], notes: "", interests: "", nextFollowUp: null, aiAccess: true,
    })).id;
  } else if (!(await ownsPerson(user.id, personId))) {
    return fail(404, "That person isn't in your network.");
  }
  const kind = (["coffee", "call", "meeting", "message", "event", "conversation"] as const).find((k) => k === s.kind) ?? "conversation";
  await addInteraction(user.id, personId, { occurredOn: s.occurredOn, kind, summary: body.summary ?? s.summary });
  if (s.followUp) await addCommitment(user.id, personId, { text: s.followUp, dueOn: null });
  await db.update(schema.suggestions).set({ status: "applied", personId }).where(eq(schema.suggestions.id, id));
  return json({ ok: true, personId });
});
