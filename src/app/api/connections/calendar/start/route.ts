import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { googleClient } from "@/lib/auth/google";
import { CALENDAR_SCOPES } from "@/lib/google-calendar";
import { authed } from "@/lib/http";

// Starts the separate, optional Calendar connection. It reuses the sign-in callback URL
// (so no extra redirect URI is needed in Google Cloud); a flow cookie tells the callback what this is.
export const GET = authed(async (_req, user) => {
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = googleClient().createAuthorizationURL(state, verifier, CALENDAR_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("login_hint", user.email);
  const jar = await cookies();
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
  jar.set("g_state", state, opts);
  jar.set("g_verifier", verifier, opts);
  jar.set("g_flow", `calendar:${user.id}`, opts);
  return NextResponse.redirect(url);
});
