import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { authed, fail, json, readJson } from "@/lib/http";
import { todayIn } from "@/lib/life/dates";
import { ImportError, parseBackup } from "@/lib/life/migrate";

// POST { raw, tz, commit?, replace? }
// Without commit: returns a preview of what the backup contains. Nothing is saved.
// With commit: saves it. If the account already has data, `replace: true` is required.
export const POST = authed(async (req, user) => {
  const body = (await readJson(req)) as { raw?: string; tz?: string; commit?: boolean; replace?: boolean };
  if (typeof body.raw !== "string" || !body.raw.trim()) return fail(400, "Paste your V1 backup first.");
  let parsed;
  try {
    parsed = parseBackup(body.raw, todayIn(body.tz));
  } catch (e) {
    if (e instanceof ImportError) return fail(400, e.message);
    throw e;
  }
  const [existing] = await db.select({ version: schema.lifeDocs.version }).from(schema.lifeDocs).where(eq(schema.lifeDocs.userId, user.id)).limit(1);
  if (!body.commit) return json({ preview: parsed.preview, hasExisting: !!existing });
  if (existing && !body.replace) return fail(409, "Your account already has data. Choose Replace to overwrite it with this backup.");

  const version = (existing?.version ?? 0) + 1;
  await db.transaction(async (tx) => {
    await tx.insert(schema.imports).values({ userId: user.id, source: "v1", raw: body.raw! });
    await tx
      .insert(schema.lifeDocs)
      .values({ userId: user.id, data: parsed.doc, version })
      .onConflictDoUpdate({ target: schema.lifeDocs.userId, set: { data: parsed.doc, version, updatedAt: new Date() } });
    if (parsed.chat.length) {
      await tx.insert(schema.coachMessages).values(parsed.chat.map((m, i) => ({ userId: user.id, kind: "chat", role: m.role, content: m.content, createdAt: new Date(Date.now() - (parsed.chat.length - i) * 1000) })));
    }
  });
  return json({ doc: parsed.doc, version, preview: parsed.preview });
});
