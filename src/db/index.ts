import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;

// Connect on first use (not at import), and reuse one pool across hot reloads in development.
const g = globalThis as unknown as { __kingdomDb?: DB };
function instance(): DB {
  if (!g.__kingdomDb) g.__kingdomDb = drizzle(postgres(env().DATABASE_URL, { max: 5, prepare: false }), { schema });
  return g.__kingdomDb;
}

export const db = new Proxy({} as DB, {
  get: (_t, prop) => {
    const real = instance();
    const v = Reflect.get(real, prop, real);
    return typeof v === "function" ? v.bind(real) : v;
  },
});
export { schema };
