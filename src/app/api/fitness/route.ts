import { ensureFitness, loadFitness } from "@/lib/fitness-db";
import { authed, json } from "@/lib/http";

// Everything the Fitness tab needs. The first call sets up the library and the dated program.
export const GET = authed(async (_req, user) => {
  await ensureFitness(user.id);
  return json(await loadFitness(user.id));
});
