import { sql } from "drizzle-orm";
import { rateLimits } from "../db/schema";
import type { AppDb } from "../db/client";
import { rateMax } from "./config";
import { HttpError } from "./http";
import { noteHealth } from "./health";

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

export async function enforceRateLimit(
  db: AppDb,
  key: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  const result = await db.execute(sql`
    INSERT INTO rate_limits (key, count, window_start)
    VALUES (${key}, 1, ${now})
    ON CONFLICT (key) DO UPDATE
    SET
      count = CASE
        WHEN rate_limits.window_start < ${cutoff} THEN 1
        ELSE rate_limits.count + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start < ${cutoff} THEN ${now}
        ELSE rate_limits.window_start
      END
    RETURNING count
  `);
  const count = Number(firstCount(result));
  if (!Number.isFinite(count) || count > limit) {
    await noteHealth(db, "rate_limit");
    throw new HttpError(429, "Too many requests");
  }
}

function firstCount(result: unknown): unknown {
  const rows = Array.isArray(result)
    ? result
    : result &&
        typeof result === "object" &&
        Array.isArray((result as { rows?: unknown[] }).rows)
      ? (result as { rows: unknown[] }).rows
      : [];
  const row = rows[0] as { count?: unknown } | undefined;
  return row?.count;
}

export async function limitAuthRequest(
  db: AppDb,
  ip: string,
  email: string,
): Promise<void> {
  await enforceRateLimit(
    db,
    `auth-req-ip:${ip}`,
    rateMax("RATE_AUTH_IP_MAX", 20),
    FIFTEEN_MINUTES,
  );
  await enforceRateLimit(
    db,
    `auth-req-email:${email}`,
    rateMax("RATE_AUTH_EMAIL_MAX", 5),
    FIFTEEN_MINUTES,
  );
}

export async function limitAuthVerify(
  db: AppDb,
  ip: string,
  email: string,
): Promise<void> {
  await enforceRateLimit(
    db,
    `auth-verify-ip:${ip}`,
    rateMax("RATE_AUTH_VERIFY_IP_MAX", 10),
    FIFTEEN_MINUTES,
  );
  await enforceRateLimit(
    db,
    `auth-verify-email:${email}`,
    rateMax("RATE_AUTH_VERIFY_EMAIL_MAX", 10),
    FIFTEEN_MINUTES,
  );
}

export async function limitCatch(
  db: AppDb,
  ip: string,
  endpointId: string,
): Promise<void> {
  await enforceRateLimit(
    db,
    `catch-ip:${ip}`,
    rateMax("RATE_CATCH_IP_MAX", 300),
    ONE_MINUTE,
  );
  await enforceRateLimit(
    db,
    `catch-endpoint:${endpointId}`,
    rateMax("RATE_CATCH_ENDPOINT_MAX", 600),
    ONE_MINUTE,
  );
}

export async function limitToken(db: AppDb, tokenId: string): Promise<void> {
  await enforceRateLimit(
    db,
    `api-token:${tokenId}`,
    rateMax("RATE_API_TOKEN_MAX", 120),
    ONE_MINUTE,
  );
}

export async function limitAuthed(
  db: AppDb,
  userId: string,
): Promise<void> {
  await enforceRateLimit(
    db,
    `api-user:${userId}`,
    rateMax("RATE_API_USER_MAX", 180),
    ONE_MINUTE,
  );
}

export async function limitPing(db: AppDb, ip: string): Promise<void> {
  await enforceRateLimit(db, `ping:${ip}`, rateMax("RATE_PING_MAX", 60), ONE_MINUTE);
}

void rateLimits;
