import { decodeIdToken, type OAuth2Tokens } from "arctic";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { googleClient, isAllowed } from "@/lib/auth/google";
import { createSession, currentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { PROVIDER, saveConnection } from "@/lib/google-calendar";
import { GMAIL, hasGmailScope, isWorkAccount } from "@/lib/gmail";

const back = (reason: string) => NextResponse.redirect(`${env().APP_URL}/login?error=${reason}`);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const savedState = jar.get("g_state")?.value;
  const verifier = jar.get("g_verifier")?.value;
  const flow = jar.get("g_flow")?.value;
  jar.delete("g_state");
  jar.delete("g_verifier");
  jar.delete("g_flow");
  if (flow?.startsWith("calendar:")) return connectGoogle("calendar", flow.slice(9), code, state, savedState, verifier);
  if (flow?.startsWith("gmail:")) return connectGoogle("gmail", flow.slice(6), code, state, savedState, verifier);
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

const FLOWS = {
  calendar: { provider: PROVIDER, granted: (s: string[]) => s.some((x) => x.endsWith("/calendar.events.readonly")) },
  gmail: { provider: GMAIL, granted: hasGmailScope },
};

// Finishes a Calendar or Gmail connection for the signed-in user who started it.
async function connectGoogle(which: keyof typeof FLOWS, userId: string, code: string | null, state: string | null, savedState?: string, verifier?: string) {
  const flow = FLOWS[which];
  const toSetup = (result: string) => NextResponse.redirect(`${env().APP_URL}/?${which}=${result}#setup`);
  const user = await currentUser();
  if (!user || user.id !== userId) return back("expired");
  if (!code || !state || !savedState || !verifier || state !== savedState) return toSetup("cancelled");
  let tokens: OAuth2Tokens;
  try {
    tokens = await googleClient().validateAuthorizationCode(code, verifier);
  } catch {
    return toSetup("failed");
  }
  const scope = tokens.hasScopes() ? tokens.scopes() : [];
  if (!flow.granted(scope) || !tokens.hasRefreshToken()) return toSetup("denied");
  let accountEmail = "";
  try {
    accountEmail = ((decodeIdToken(tokens.idToken()) as { email?: string }).email ?? "").toLowerCase();
  } catch { /* email is display-only for Calendar */ }
  // Gmail needs the account address to tell sent from received, and work accounts are refused.
  if (which === "gmail" && (!accountEmail || isWorkAccount(accountEmail))) {
    try { await googleClient().revokeToken(tokens.refreshToken()); } catch { /* best effort */ }
    return toSetup(accountEmail ? "work" : "failed");
  }
  await saveConnection(user.id, {
    refreshToken: tokens.refreshToken(), accessToken: tokens.accessToken(), expiresAt: tokens.accessTokenExpiresAt(),
    scope: scope.join(" "), accountEmail,
  }, flow.provider);
  return toSetup("connected");
}
