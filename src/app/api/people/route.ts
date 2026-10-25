import { authed, json, readJson } from "@/lib/http";
import { createPerson, loadNetwork, personInput } from "@/lib/network-db";

// GET: the whole network (people, conversations, commitments). POST: add a person.
export const GET = authed(async (_req, user) => json(await loadNetwork(user.id)));

export const POST = authed(async (req, user) => {
  const input = personInput.parse(await readJson(req));
  return json({ person: await createPerson(user.id, input) }, 201);
});
