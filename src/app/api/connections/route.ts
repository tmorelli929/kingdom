import { disconnect, getConnection } from "@/lib/google-calendar";
import { authed, fail, json, readJson } from "@/lib/http";

// What's connected. Tokens never leave the server.
export const GET = authed(async (_req, user) => {
  const c = await getConnection(user.id);
  return json({ calendar: c ? { email: c.accountEmail, status: c.status, since: c.createdAt } : null });
});

// DELETE { provider: "calendar" }: revokes access with Google and deletes the stored tokens.
export const DELETE = authed(async (req, user) => {
  const body = (await readJson(req)) as { provider?: string };
  if (body.provider !== "calendar") return fail(400, "Unknown connection.");
  const c = await getConnection(user.id);
  if (c) await disconnect(c);
  return json({ ok: true });
});
