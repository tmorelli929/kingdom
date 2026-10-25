import { endSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { fail, json } from "@/lib/http";

export async function POST(req: Request) {
  if (req.headers.get("origin") !== env().APP_URL && req.headers.get("origin") !== new URL(req.url).origin) return fail(403, "Request blocked.");
  await endSession();
  return json({ ok: true });
}
