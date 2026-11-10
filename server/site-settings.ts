import { eq, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { siteSettings } from "../db/schema";
import { env } from "./config";

const NEW_MOCKS_LOCKED = "new_mocks_locked";

export async function newMocksLocked(db: AppDb): Promise<boolean> {
  if (env("NEW_MOCKS_LOCKED") === "true") return true;
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, NEW_MOCKS_LOCKED)).limit(1);
  return row?.value === "true";
}

export async function setNewMocksLocked(db: AppDb, locked: boolean): Promise<boolean> {
  if (env("NEW_MOCKS_LOCKED") === "true") return true;
  const value = locked ? "true" : "false";
  await db.execute(sql`
    INSERT INTO site_settings (key, value) VALUES (${NEW_MOCKS_LOCKED}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = excluded.value
  `);
  return locked;
}
