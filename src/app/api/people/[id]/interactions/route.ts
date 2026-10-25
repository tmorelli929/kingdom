import { authed, fail, json, readJson } from "@/lib/http";
import { addInteraction, interactionInput, ownsPerson } from "@/lib/network-db";

type Ctx = { params: Promise<{ id: string }> };

export const POST = authed<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  if (!(await ownsPerson(user.id, id))) return fail(404, "That person wasn't found.");
  return json({ interaction: await addInteraction(user.id, id, interactionInput.parse(await readJson(req))) }, 201);
});
