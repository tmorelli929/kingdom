import { Google } from "arctic";
import { env } from "@/lib/env";

// Sign-in only asks for identity. Calendar access is a separate, optional connection (Phase 2).
export const SIGN_IN_SCOPES = ["openid", "email", "profile"];

export function googleClient() {
  const e = env();
  return new Google(e.AUTH_GOOGLE_ID, e.AUTH_GOOGLE_SECRET, `${e.APP_URL}/api/auth/google/callback`);
}

export const isAllowed = (email: string) => env().ALLOWED_EMAILS.includes(email.trim().toLowerCase());
