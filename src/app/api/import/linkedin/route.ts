import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authed, fail, json, readJson } from "@/lib/http";
import { parseConnections, planImport } from "@/lib/linkedin";

// POST { csv, apply, addNew }: previews (apply false) or imports LinkedIn's Connections.csv.
// Existing people only get blank fields filled; new people are added only when addNew is true.
export const POST = authed(async (req, user) => {
  const body = z.object({ csv: z.string().max(1_900_000), apply: z.boolean().default(false), addNew: z.boolean().default(false) }).parse(await readJson(req));
  let rows;
  try { rows = parseConnections(body.csv); } catch (e) { return fail(400, e instanceof Error ? e.message : "Couldn't read that file."); }
  if (rows.length > 10000) return fail(400, "That file has more than 10,000 connections.");
  const people = await db.select().from(schema.people).where(eq(schema.people.userId, user.id));
  const plan = planImport(rows, people);
  const summary = { total: rows.length, update: plan.updates.length, add: plan.adds.length, unchanged: plan.unchanged };
  if (!body.apply) return json({ ...summary, sample: plan.adds.slice(0, 5).map((a) => [a.name, a.title, a.organization].filter(Boolean).join(" · ")) });

  await db.transaction(async (tx) => {
    for (const u of plan.updates) {
      await tx.update(schema.people).set({ ...u.patch, updatedAt: new Date() }).where(and(eq(schema.people.id, u.id), eq(schema.people.userId, user.id)));
    }
    if (body.addNew) {
      for (let i = 0; i < plan.adds.length; i += 500) {
        await tx.insert(schema.people).values(plan.adds.slice(i, i + 500).map((a) => ({ ...a, userId: user.id })));
      }
    }
  });
  return json({ ...summary, added: body.addNew ? plan.adds.length : 0, updated: plan.updates.length });
});
