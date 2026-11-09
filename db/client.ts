import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type AppDb = NodePgDatabase<typeof schema>;

let singleton: Promise<AppDb> | null = null;

/**
 * Netlify Database (via the drizzle netlify adapter) when the function
 * runtime injected NETLIFY_DB_URL. A plain DATABASE_URL is only for a
 * Postgres the maintainer runs locally — never point it at production.
 */
export function getDb(): Promise<AppDb> {
  if (!singleton) singleton = openDb();
  return singleton;
}

async function openDb(): Promise<AppDb> {
  const onNetlify =
    process.env.NETLIFY === "true" || Boolean(process.env.NETLIFY_DB_URL);
  if (!onNetlify && process.env.DATABASE_URL) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pgModule = await import("pg");
    const Pool = pgModule.default?.Pool ?? pgModule.Pool;
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
    });
    return drizzle({ client: pool, schema }) as unknown as AppDb;
  }

  const { drizzle } = await import("drizzle-orm/netlify-db");
  return drizzle({ schema }) as unknown as AppDb;
}
