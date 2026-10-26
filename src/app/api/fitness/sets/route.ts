import { saveSet, setInput } from "@/lib/fitness-db";
import { authed, fail, json, readJson } from "@/lib/http";

// Saves one set as soon as it's entered, so a half-finished workout is never lost.
export const PUT = authed(async (req, user) => {
  const ok = await saveSet(user.id, setInput.parse(await readJson(req)));
  return ok ? json({ ok: true }) : fail(404, "That workout wasn't found.");
});
