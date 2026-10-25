import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { createSession } from "@/lib/auth/session";
import { env } from "@/lib/env";

// Local development only: signs in as the first allowed email without Google.
// env().DEV_LOGIN is always false in a production build.
export async function GET() {
  const e = env();
  if (!e.DEV_LOGIN) return new NextResponse("Not found", { status: 404 });
  const email = e.ALLOWED_EMAILS[0];
  let [u] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!u) [u] = await db.insert(schema.users).values({ email, name: "Dev" }).returning();
  await createSession(u.id);
  return NextResponse.redirect(`${e.APP_URL}/`);
}
