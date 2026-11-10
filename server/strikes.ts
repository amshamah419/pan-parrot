import { eq, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { authStrikes } from "../db/schema";

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

export async function strikeLocked(db: AppDb, key: string): Promise<boolean> {
  const [row] = await db.select().from(authStrikes).where(eq(authStrikes.key, key)).limit(1);
  if (!row?.lockedUntil) return false;
  return row.lockedUntil.getTime() > Date.now();
}

export async function recordStrike(db: AppDb, key: string): Promise<void> {
  const now = new Date();
  const [row] = await db.select().from(authStrikes).where(eq(authStrikes.key, key)).limit(1);
  const failures = (row?.failures ?? 0) + 1;
  const lockedUntil = lockUntil(failures, now);
  if (!row) {
    await db.insert(authStrikes).values({ key, failures, updatedAt: now, lockedUntil });
    return;
  }
  await db.update(authStrikes).set({ failures, updatedAt: now, lockedUntil }).where(eq(authStrikes.key, key));
}

export async function clearStrike(db: AppDb, key: string): Promise<void> {
  await db.delete(authStrikes).where(eq(authStrikes.key, key));
}

export async function strikeCount(db: AppDb, key: string): Promise<number> {
  const [row] = await db.select().from(authStrikes).where(eq(authStrikes.key, key)).limit(1);
  return row?.failures ?? 0;
}

function lockUntil(failures: number, now: Date): Date | null {
  if (failures >= 20) return new Date(now.getTime() + ONE_DAY);
  if (failures >= 10) return new Date(now.getTime() + ONE_HOUR);
  if (failures >= 5) return new Date(now.getTime() + FIFTEEN_MINUTES);
  return null;
}

export async function trimStrikes(db: AppDb): Promise<void> {
  const cutoff = new Date(Date.now() - 2 * ONE_DAY);
  await db.execute(sql`DELETE FROM auth_strikes WHERE updated_at < ${cutoff}`);
}
