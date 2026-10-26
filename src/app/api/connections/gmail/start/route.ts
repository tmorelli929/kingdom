import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { googleClient } from "@/lib/auth/google";
import { DIGEST_SCOPES } from "@/lib/digest";
import { GMAIL_SCOPES } from "@/lib/gmail";
import { authed } from "@/lib/http";

// Starts the optional Gmail connection. Like Calendar, it reuses the sign-in callback.
// Plain: headers only. ?digest=1: read access, used only for messages under his digest label. The two
// aren't combined, because Gmail refuses full messages to a token that also holds the headers-only scope.
export const GET = authed(async (req, user) => {
  const digest = new URL(req.url).searchParams.get("digest") === "1";
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = googleClient().createAuthorizationURL(state, verifier, digest ? DIGEST_SCOPES : GMAIL_SCOPES);
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
