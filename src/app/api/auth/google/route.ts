import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { googleClient, SIGN_IN_SCOPES } from "@/lib/auth/google";

// Starts Google sign-in. State and PKCE verifier live in short-lived httpOnly cookies.
export async function GET() {
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = googleClient().createAuthorizationURL(state, verifier, SIGN_IN_SCOPES);
  url.searchParams.set("prompt", "select_account");
  const jar = await cookies();
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
  jar.set("g_state", state, opts);
  jar.set("g_verifier", verifier, opts);
  return NextResponse.redirect(url);
}
