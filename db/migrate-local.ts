import "dotenv/config";
import pg from "pg";
import { readMigrationStatements } from "./sql-migrations";

/**
 * Applies committed SQL migrations to a local Postgres named by DATABASE_URL.
 * Hosted Netlify databases are migrated by the deploy. This script refuses
 * to run when it looks like a Netlify environment.
 */
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (local Postgres only).");
  process.exit(1);
}
if (process.env.NETLIFY_DB_URL || process.env.NETLIFY === "true") {
  console.error(
    "Refusing to migrate a Netlify database. Push the repo and let the deploy apply migrations.",
  );
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  const statements = await readMigrationStatements();
  for (const statement of statements) {
    await client.query(statement);
  }
  console.log(`Applied ${statements.length} statements to the local database.`);
} finally {
  client.release();
  await pool.end();
}
