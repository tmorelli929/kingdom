import { db, schema } from "@/db";
import { exerciseInput } from "@/lib/fitness-db";
import { authed, json, readJson } from "@/lib/http";

// Adds his own exercise to the library.
export const POST = authed(async (req, user) => {
  const e = exerciseInput.parse(await readJson(req));
  const key = `custom-${crypto.randomUUID().slice(0, 8)}`;
  await db.insert(schema.exercises).values({ ...e, userId: user.id, key, custom: true, availability: "available" });
  return json({ key });
});
