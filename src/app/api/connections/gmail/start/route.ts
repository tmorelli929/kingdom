import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { googleClient } from "@/lib/auth/google";
import { GMAIL_SCOPES } from "@/lib/gmail";
import { authed } from "@/lib/http";

// Starts the optional Gmail connection (headers only). Like Calendar, it reuses the sign-in callback.
export const GET = authed(async (_req, user) => {
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = googleClient().createAuthorizationURL(state, verifier, GMAIL_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("login_hint", user.email);
  const jar = await cookies();
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
  jar.set("g_state", state, opts);
  jar.set("g_verifier", verifier, opts);
  jar.set("g_flow", `gmail:${user.id}`, opts);
  return NextResponse.redirect(url);
});
