import { and, eq, notInArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { authed, fail, json, readJson } from "@/lib/http";

// DELETE { confirm: "DELETE" }: erases the account and everything in it (cascades to every table).
export const DELETE = authed(async (req, user) => {
  const body = (await readJson(req)) as { confirm?: string };
  if (body.confirm !== "DELETE") return fail(400, 'Type DELETE to confirm.');
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  (await cookies()).delete(SESSION_COOKIE);
  return json({ ok: true });
});

// DELETE-style reset of coach history only.
export const PATCH = authed(async (req, user) => {
  const body = (await readJson(req)) as { clear?: string };
  if (body.clear !== "coach") return fail(400, "Unknown request.");
  // Clears the Ask conversation; today's insights and news stay.
  await db.delete(schema.coachMessages).where(and(eq(schema.coachMessages.userId, user.id), notInArray(schema.coachMessages.kind, ["insights", "news"])));
  return json({ ok: true });
});
