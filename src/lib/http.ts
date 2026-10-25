import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { currentUser, type SessionUser } from "@/lib/auth/session";
import { env } from "@/lib/env";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export const fail = (status: number, error: string) => json({ error }, status);

// Rejects state-changing requests that didn't come from this app's own pages (CSRF defense on top of SameSite cookies).
function sameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set([env().APP_URL, new URL(req.url).origin]);
  return allowed.has(origin);
}

type Handler<C> = (req: Request, user: SessionUser, ctx: C) => Promise<Response>;

// Wraps an API route: checks origin and session, and keeps personal data out of error logs.
export function authed<C = unknown>(handler: Handler<C>) {
  return async (req: Request, ctx: C) => {
    if (!sameOrigin(req)) return fail(403, "Request blocked: it didn't come from Kingdom.");
    const user = await currentUser();
    if (!user) return fail(401, "Please sign in again.");
    try {
      return await handler(req, user, ctx);
    } catch (e) {
      if (e instanceof BodyError) return fail(400, e.message);
      if (e instanceof ZodError) return fail(400, "Some fields weren't valid: " + e.issues.slice(0, 3).map((i) => i.path.join(".") || "body").join(", "));
      const ref = crypto.randomUUID().slice(0, 8);
      console.error(`[${ref}] ${req.method} ${new URL(req.url).pathname} failed:`, e instanceof Error ? e.name + ": " + e.message.slice(0, 200) : "unknown");
      return fail(500, `Something went wrong (ref ${ref}). Try again.`);
    }
  };
}

const MAX_BODY = 2 * 1024 * 1024;
export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new BodyError("That's too large to save.");
  try {
    return JSON.parse(text);
  } catch {
    throw new BodyError("The request wasn't valid JSON.");
  }
}
export class BodyError extends Error {}
