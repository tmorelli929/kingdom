import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { authed, fail, json, readJson } from "@/lib/http";
import { defaultDoc } from "@/lib/life/defaults";
import { looksLikeLifeDoc } from "@/lib/life/migrate";
import { todayIn } from "@/lib/life/dates";

// GET: the dashboard document. `doc: null` means a brand-new account (import V1 or start fresh).
export const GET = authed(async (_req, user) => {
  const [row] = await db.select().from(schema.lifeDocs).where(eq(schema.lifeDocs.userId, user.id)).limit(1);
  return json({ doc: row?.data ?? null, version: row?.version ?? 0 });
});

// POST { start: "fresh", tz }: create the default Kingdom document for a new account.
export const POST = authed(async (req, user) => {
  const body = (await readJson(req)) as { start?: string; tz?: string };
  if (body.start !== "fresh") return fail(400, "Unknown request.");
  const doc = defaultDoc(todayIn(body.tz));
  const rows = await db.insert(schema.lifeDocs).values({ userId: user.id, data: doc, version: 1 }).onConflictDoNothing().returning();
  if (!rows.length) return fail(409, "This account already has data.");
  return json({ doc, version: 1 });
});

// PUT { doc, baseVersion }: save. Refused with 409 if another device saved first.
export const PUT = authed(async (req, user) => {
  const body = (await readJson(req)) as { doc?: unknown; baseVersion?: number };
  if (!looksLikeLifeDoc(body.doc) || typeof body.baseVersion !== "number") return fail(400, "That save didn't look like a Kingdom dashboard.");
  const rows = await db
    .update(schema.lifeDocs)
    .set({ data: body.doc, version: body.baseVersion + 1, updatedAt: new Date() })
    .where(and(eq(schema.lifeDocs.userId, user.id), eq(schema.lifeDocs.version, body.baseVersion)))
    .returning({ version: schema.lifeDocs.version });
  if (!rows.length) {
    const [cur] = await db.select().from(schema.lifeDocs).where(eq(schema.lifeDocs.userId, user.id)).limit(1);
    return json({ error: "conflict", doc: cur?.data ?? null, version: cur?.version ?? 0 }, 409);
  }
  return json({ version: rows[0].version });
});
