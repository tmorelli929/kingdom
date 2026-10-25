import { authed, fail, json, readJson } from "@/lib/http";
import { deleteInteraction, interactionInput, updateInteraction } from "@/lib/network-db";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = authed<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  const row = await updateInteraction(user.id, id, interactionInput.partial().parse(await readJson(req)));
  return row ? json({ interaction: row }) : fail(404, "That conversation wasn't found.");
});

export const DELETE = authed<Ctx>(async (_req, user, { params }) => {
  const { id } = await params;
  return (await deleteInteraction(user.id, id)) ? json({ ok: true }) : fail(404, "That conversation wasn't found.");
});
