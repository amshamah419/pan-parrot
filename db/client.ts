import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type AppDb = NodePgDatabase<typeof schema>;

/**
 * Deploy previews and branch deploys must not open Netlify Database.
 * Each preview otherwise gets its own compute endpoint.
 */
export function hostedDatabaseSkipped(): boolean {
  const context = process.env.CONTEXT || "";
  return context === "deploy-preview" || context === "branch-deploy";
}

/**
 * A new short-lived client per call. Do not cache a pg or Neon Pool:
 * an open connection keeps Netlify Database compute from suspending.
 * Hosted queries use the Neon HTTP driver, which does not hold a socket.
 */
export function getDb(): Promise<AppDb> {
  return openDb();
}

async function openDb(): Promise<AppDb> {
  if (hostedDatabaseSkipped()) {
    throw new Error("Database is disabled for this deploy preview");
  }
  const onNetlify = process.env.NETLIFY === "true" || Boolean(process.env.NETLIFY_DB_URL);
  if (!onNetlify && process.env.DATABASE_URL) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pgModule = await import("pg");
    const Pool = pgModule.default?.Pool ?? pgModule.Pool;
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 1_000,
      allowExitOnIdle: true,
    });
    return drizzle({ client: pool, schema }) as unknown as AppDb;
  }

  const connectionString = process.env.NETLIFY_DB_URL;
  if (!connectionString) throw new Error("NETLIFY_DB_URL is not set");
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  return drizzle({ client: neon(connectionString), schema }) as unknown as AppDb;
}
