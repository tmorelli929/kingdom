import { patchWorkout, workoutPatch } from "@/lib/fitness-db";
import { authed, fail, json, readJson } from "@/lib/http";

// Start, finish, skip, move, swap exercises, log cardio or notes for one session.
export const PATCH = authed<{ params: Promise<{ id: string }> }>(async (req, user, ctx) => {
  const { id } = await ctx.params;
  const row = await patchWorkout(user.id, id, workoutPatch.parse(await readJson(req)));
  return row ? json({ ok: true }) : fail(404, "That workout wasn't found.");
});
