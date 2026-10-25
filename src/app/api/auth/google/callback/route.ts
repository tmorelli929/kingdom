import { decodeIdToken, type OAuth2Tokens } from "arctic";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { googleClient, isAllowed } from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";
import { env } from "@/lib/env";

const back = (reason: string) => NextResponse.redirect(`${env().APP_URL}/login?error=${reason}`);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const savedState = jar.get("g_state")?.value;
  const verifier = jar.get("g_verifier")?.value;
  jar.delete("g_state");
  jar.delete("g_verifier");
  if (!code || !state || !savedState || !verifier || state !== savedState) return back("expired");

  let tokens: OAuth2Tokens;
  try {
    tokens = await googleClient().validateAuthorizationCode(code, verifier);
  } catch {
    return back("google");
  }
  // The ID token comes straight from Google's token endpoint over TLS, so its claims can be read directly.
  const claims = decodeIdToken(tokens.idToken()) as { sub: string; email?: string; email_verified?: boolean; name?: string };
  const email = (claims.email ?? "").toLowerCase();
  if (!email || !claims.email_verified || !isAllowed(email)) return back("not-allowed");

  const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  let userId = existing[0]?.id;
  if (!userId) {
    const [u] = await db.insert(schema.users).values({ email, googleSub: claims.sub, name: claims.name ?? null }).returning();
    userId = u.id;
  } else if (!existing[0].googleSub) {
    await db.update(schema.users).set({ googleSub: claims.sub }).where(eq(schema.users.id, userId));
  } else if (existing[0].googleSub !== claims.sub) {
    return back("not-allowed");
  }
  await createSession(userId);
  return NextResponse.redirect(`${env().APP_URL}/`);
}
