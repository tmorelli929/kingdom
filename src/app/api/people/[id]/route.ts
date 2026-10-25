import { authed, fail, json, readJson } from "@/lib/http";
import { deletePerson, personPatch, updatePerson } from "@/lib/network-db";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = authed<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  const person = await updatePerson(user.id, id, personPatch.parse(await readJson(req)));
  return person ? json({ person }) : fail(404, "That person wasn't found.");
});

export const DELETE = authed<Ctx>(async (_req, user, { params }) => {
  const { id } = await params;
  return (await deletePerson(user.id, id)) ? json({ ok: true }) : fail(404, "That person wasn't found.");
});
