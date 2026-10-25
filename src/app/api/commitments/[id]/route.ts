import { authed, fail, json, readJson } from "@/lib/http";
import { commitmentPatch, deleteCommitment, updateCommitment } from "@/lib/network-db";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = authed<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  const row = await updateCommitment(user.id, id, commitmentPatch.parse(await readJson(req)));
  return row ? json({ commitment: row }) : fail(404, "That commitment wasn't found.");
});

export const DELETE = authed<Ctx>(async (_req, user, { params }) => {
  const { id } = await params;
  return (await deleteCommitment(user.id, id)) ? json({ ok: true }) : fail(404, "That commitment wasn't found.");
});
