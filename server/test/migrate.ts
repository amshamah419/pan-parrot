import { sql } from "drizzle-orm";
import type { AppDb } from "../../db/client";
import { readMigrationStatements } from "../../db/sql-migrations";

export async function applySqlMigrations(db: AppDb): Promise<void> {
  const statements = await readMigrationStatements();
  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}
