import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { authed } from "@/lib/http";
import { loadNetwork } from "@/lib/network-db";

// Everything Kingdom stores about you, as one JSON file. Session tokens are never included.
export const GET = authed(async (_req, user) => {
  const [life] = await db.select().from(schema.lifeDocs).where(eq(schema.lifeDocs.userId, user.id)).limit(1);
  const coach = await db.select({ kind: schema.coachMessages.kind, role: schema.coachMessages.role, content: schema.coachMessages.content, createdAt: schema.coachMessages.createdAt }).from(schema.coachMessages).where(eq(schema.coachMessages.userId, user.id)).orderBy(schema.coachMessages.createdAt);
  const imports = await db.select({ source: schema.imports.source, createdAt: schema.imports.createdAt, raw: schema.imports.raw }).from(schema.imports).where(eq(schema.imports.userId, user.id));
  const body = {
    exportedAt: new Date().toISOString(),
    format: "kingdom-export-v2",
    account: { email: user.email, name: user.name },
    life: life?.data ?? null,
    network: await loadNetwork(user.id),
    coach,
    imports,
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="kingdom-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
