import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** Reads Netlify/Drizzle migration folders in lexicographic order. */
export async function readMigrationStatements(
  directory = path.resolve("netlify/database/migrations"),
): Promise<string[]> {
  const files = await collectSql(directory);
  const statements: string[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const part of text.split("--> statement-breakpoint")) {
      const statement = part.trim().replace(/;\s*$/, "");
      if (statement) statements.push(statement);
    }
  }
  return statements;
}

async function collectSql(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSql(full)));
    } else if (entry.name.endsWith(".sql")) {
      files.push(full);
    }
  }
  return files;
}
