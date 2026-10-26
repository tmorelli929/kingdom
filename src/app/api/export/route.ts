import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { authed } from "@/lib/http";
import { loadNetwork } from "@/lib/network-db";
import { loadFitness } from "@/lib/fitness-db";

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
    fitness: await loadFitness(user.id),
    coach,
    imports,
    digestSuggestions: await db.select({ personName: schema.suggestions.personName, occurredOn: schema.suggestions.occurredOn, kind: schema.suggestions.kind, summary: schema.suggestions.summary, followUp: schema.suggestions.followUp, status: schema.suggestions.status }).from(schema.suggestions).where(eq(schema.suggestions.userId, user.id)),
    // Which accounts are connected. Tokens are never exported.
    connections: (await db.select({ provider: schema.connections.provider, accountEmail: schema.connections.accountEmail, scope: schema.connections.scope, createdAt: schema.connections.createdAt }).from(schema.connections).where(eq(schema.connections.userId, user.id))),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="kingdom-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
