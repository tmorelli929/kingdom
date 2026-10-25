import { authed, fail, json, readJson } from "@/lib/http";
import { addCommitment, commitmentInput, ownsPerson } from "@/lib/network-db";

type Ctx = { params: Promise<{ id: string }> };

export const POST = authed<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  if (!(await ownsPerson(user.id, id))) return fail(404, "That person wasn't found.");
  return json({ commitment: await addCommitment(user.id, id, commitmentInput.parse(await readJson(req))) }, 201);
});
