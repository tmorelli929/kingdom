import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { Commitment, Interaction, NetworkData, Person } from "@/lib/life/network";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = (max: number) => z.string().trim().max(max);

export const personInput = z.object({
  name: text(120).min(1),
  organization: text(160).default(""),
  title: text(160).default(""),
  linkedinUrl: z.union([z.literal(""), z.string().trim().max(300).url().refine((u) => /^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(u), "Must be a linkedin.com link")]).default(""),
  email: z.union([z.literal(""), z.string().trim().max(200).email()]).default(""),
  location: text(160).default(""),
  metWhere: text(300).default(""),
  metOn: dateKey.nullable().default(null),
  categories: z.array(text(40).min(1)).max(12).default([]),
  notes: text(20000).default(""),
  interests: text(2000).default(""),
  nextFollowUp: dateKey.nullable().default(null),
  aiAccess: z.boolean().default(true),
});
export const personPatch = personInput.partial();

export const interactionInput = z.object({
  occurredOn: dateKey,
  kind: z.enum(["coffee", "call", "meeting", "message", "event", "conversation"]).default("conversation"),
  summary: text(20000).default(""),
});
export const commitmentInput = z.object({ text: text(500).min(1), dueOn: dateKey.nullable().default(null) });
export const commitmentPatch = z.object({ text: text(500).min(1).optional(), dueOn: dateKey.nullable().optional(), doneOn: dateKey.nullable().optional() });

const toPerson = (r: typeof schema.people.$inferSelect): Person => ({
  id: r.id,
  name: r.name,
  organization: r.organization,
  title: r.title,
  linkedinUrl: r.linkedinUrl,
  email: r.email,
  location: r.location,
  metWhere: r.metWhere,
  metOn: r.metOn,
  categories: r.categories,
  notes: r.notes,
  interests: r.interests,
  nextFollowUp: r.nextFollowUp,
  aiAccess: r.aiAccess,
  addedOn: r.createdAt.toISOString().slice(0, 10),
});
const toInteraction = (r: typeof schema.interactions.$inferSelect): Interaction => ({
  id: r.id, personId: r.personId, occurredOn: r.occurredOn, kind: r.kind, summary: r.summary,
});
const toCommitment = (r: typeof schema.commitments.$inferSelect): Commitment => ({
  id: r.id, personId: r.personId, text: r.text, dueOn: r.dueOn, doneOn: r.doneOn,
});

export async function loadNetwork(userId: string): Promise<NetworkData> {
  const [p, i, c] = await Promise.all([
    db.select().from(schema.people).where(eq(schema.people.userId, userId)).orderBy(schema.people.name),
    db.select().from(schema.interactions).where(eq(schema.interactions.userId, userId)),
    db.select().from(schema.commitments).where(eq(schema.commitments.userId, userId)),
  ]);
  return { people: p.map(toPerson), interactions: i.map(toInteraction), commitments: c.map(toCommitment) };
}

export async function createPerson(userId: string, input: z.infer<typeof personInput>) {
  const [row] = await db.insert(schema.people).values({ ...input, userId }).returning();
  return toPerson(row);
}

export async function updatePerson(userId: string, id: string, patch: z.infer<typeof personPatch>) {
  if (!UUID.test(id)) return null;
  const [row] = await db
    .update(schema.people)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(schema.people.id, id), eq(schema.people.userId, userId)))
    .returning();
  return row ? toPerson(row) : null;
}

export async function deletePerson(userId: string, id: string) {
  if (!UUID.test(id)) return false;
  const rows = await db.delete(schema.people).where(and(eq(schema.people.id, id), eq(schema.people.userId, userId))).returning({ id: schema.people.id });
  return rows.length > 0;
}

// Confirms the person belongs to this user before attaching anything to them.
export async function ownsPerson(userId: string, personId: string) {
  if (!UUID.test(personId)) return false;
  const rows = await db.select({ id: schema.people.id }).from(schema.people).where(and(eq(schema.people.id, personId), eq(schema.people.userId, userId))).limit(1);
  return rows.length > 0;
}

export async function addInteraction(userId: string, personId: string, input: z.infer<typeof interactionInput>) {
  const [row] = await db.insert(schema.interactions).values({ ...input, userId, personId }).returning();
  return toInteraction(row);
}
export async function updateInteraction(userId: string, id: string, patch: Partial<z.infer<typeof interactionInput>>) {
  if (!UUID.test(id)) return null;
  const [row] = await db.update(schema.interactions).set(patch).where(and(eq(schema.interactions.id, id), eq(schema.interactions.userId, userId))).returning();
  return row ? toInteraction(row) : null;
}
export async function deleteInteraction(userId: string, id: string) {
  if (!UUID.test(id)) return false;
  const rows = await db.delete(schema.interactions).where(and(eq(schema.interactions.id, id), eq(schema.interactions.userId, userId))).returning({ id: schema.interactions.id });
  return rows.length > 0;
}

export async function addCommitment(userId: string, personId: string, input: z.infer<typeof commitmentInput>) {
  const [row] = await db.insert(schema.commitments).values({ ...input, userId, personId }).returning();
  return toCommitment(row);
}
export async function updateCommitment(userId: string, id: string, patch: z.infer<typeof commitmentPatch>) {
  if (!UUID.test(id)) return null;
  const [row] = await db.update(schema.commitments).set(patch).where(and(eq(schema.commitments.id, id), eq(schema.commitments.userId, userId))).returning();
  return row ? toCommitment(row) : null;
}
export async function deleteCommitment(userId: string, id: string) {
  if (!UUID.test(id)) return false;
  const rows = await db.delete(schema.commitments).where(and(eq(schema.commitments.id, id), eq(schema.commitments.userId, userId))).returning({ id: schema.commitments.id });
  return rows.length > 0;
}
