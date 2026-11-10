import { randomUUID } from "node:crypto";
import { desc, eq, gte, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { capturedRequests, endpoints, healthBuckets, recentErrors, users } from "../db/schema";
import { maxRequestsPerEndpoint, maxRequestsPerUser } from "./config";
import { POLICY } from "../shared/policy";

const CATCH = "catch";
const CATCH_4XX = "catch_4xx";
const CATCH_5XX = "catch_5xx";

export async function noteHealth(db: AppDb, kind: string, durationMs = 0): Promise<void> {
  try {
    const hour = new Date();
    hour.setMinutes(0, 0, 0);
    const duration = Math.max(0, Math.min(60_000, Math.round(durationMs)));
    await db.execute(sql`
      INSERT INTO health_buckets (hour, kind, count, duration_ms)
      VALUES (${hour}, ${kind}, 1, ${duration})
      ON CONFLICT (hour, kind) DO UPDATE
      SET count = health_buckets.count + 1,
          duration_ms = health_buckets.duration_ms + ${duration}
    `);
  } catch (error) {
    console.error("health bucket failed", error instanceof Error ? error.message : "");
  }
}

export async function noteCatch(db: AppDb, status: number, durationMs: number): Promise<void> {
  await noteHealth(db, CATCH, durationMs);
  if (status >= 500) await noteHealth(db, CATCH_5XX);
  else if (status >= 400) await noteHealth(db, CATCH_4XX);
  if (status >= 500) await noteError(db, `Catch responded ${status}`);
}

export async function noteError(db: AppDb, message: string): Promise<void> {
  const text = message.replace(/\s+/g, " ").trim().slice(0, 180);
  if (!text) return;
  try {
    await db.insert(recentErrors).values({ id: randomUUID(), message: text });
    await db.execute(sql`
      DELETE FROM recent_errors
      WHERE id IN (
        SELECT id FROM recent_errors
        ORDER BY created_at DESC
        OFFSET 30
      )
    `);
  } catch (error) {
    console.error("recent error failed", error instanceof Error ? error.message : "");
  }
}

interface WindowStats {
  requests: number;
  clientErrors: number;
  serverErrors: number;
  errorRate: number;
  latencyMs: number;
}

interface CounterWindow {
  attempts: number;
  failures: number;
  lockouts: number;
  rateLimitHits: number;
}

export async function healthReport(db: AppDb) {
  const now = Date.now();
  const day = new Date(now - 24 * 60 * 60 * 1000);
  const week = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const [dayCounts, weekCounts, storage, tops, errors, last] = await Promise.all([
    bucketSums(db, day),
    bucketSums(db, week),
    storageUse(db),
    topTraffic(db, week),
    db.select().from(recentErrors).orderBy(desc(recentErrors.createdAt)).limit(20),
    db
      .select({ createdAt: capturedRequests.createdAt })
      .from(capturedRequests)
      .orderBy(desc(capturedRequests.createdAt))
      .limit(1),
  ]);
  return {
    windows: { h24: windowStats(dayCounts), d7: windowStats(weekCounts) },
    signIn: { h24: signInStats(dayCounts), d7: signInStats(weekCounts) },
    rateLimitHits: {
      h24: dayCounts.get("rate_limit")?.count ?? 0,
      d7: weekCounts.get("rate_limit")?.count ?? 0,
    },
    storage,
    topMocks: tops.mocks,
    topUsers: tops.users,
    recentErrors: errors.map((row) => ({
      id: row.id,
      message: row.message,
      created: row.createdAt.toISOString(),
    })),
    lastCatch: last[0]?.createdAt ? last[0].createdAt.toISOString() : null,
  };
}

async function bucketSums(db: AppDb, since: Date) {
  const rows = await db
    .select({
      kind: healthBuckets.kind,
      count: sql<number>`coalesce(sum(${healthBuckets.count}), 0)`,
      duration: sql<number>`coalesce(sum(${healthBuckets.durationMs}), 0)`,
    })
    .from(healthBuckets)
    .where(gte(healthBuckets.hour, since))
    .groupBy(healthBuckets.kind);
  return new Map(rows.map((row) => [row.kind, { count: Number(row.count), duration: Number(row.duration) }]));
}

function windowStats(counts: Map<string, { count: number; duration: number }>): WindowStats {
  const requests = counts.get(CATCH)?.count ?? 0;
  const clientErrors = counts.get(CATCH_4XX)?.count ?? 0;
  const serverErrors = counts.get(CATCH_5XX)?.count ?? 0;
  const duration = counts.get(CATCH)?.duration ?? 0;
  return {
    requests,
    clientErrors,
    serverErrors,
    errorRate: requests ? Math.round(((clientErrors + serverErrors) / requests) * 1000) / 1000 : 0,
    latencyMs: requests ? Math.round(duration / requests) : 0,
  };
}

function signInStats(counts: Map<string, { count: number; duration: number }>): CounterWindow {
  return {
    attempts: counts.get("signin_attempt")?.count ?? 0,
    failures: counts.get("signin_failure")?.count ?? 0,
    lockouts: counts.get("signin_lockout")?.count ?? 0,
    rateLimitHits: counts.get("rate_limit")?.count ?? 0,
  };
}

async function storageUse(db: AppDb) {
  const [captures] = await db.select({ value: sql<number>`count(*)` }).from(capturedRequests);
  const [bytes] = await db
    .select({
      value: sql<number>`coalesce(sum(octet_length(coalesce(body::text, '')) + octet_length(coalesce(response_preview, ''))), 0)`,
    })
    .from(capturedRequests);
  const [people] = await db.select({ value: sql<number>`count(*)` }).from(users);
  const [mocks] = await db.select({ value: sql<number>`count(*)` }).from(endpoints);
  const usersN = Number(people?.value ?? 0);
  const endpointsN = Number(mocks?.value ?? 0);
  return {
    capturedRequests: Number(captures?.value ?? 0),
    capturedBytes: Number(bytes?.value ?? 0),
    requestQuota: Math.max(endpointsN, 1) * maxRequestsPerEndpoint(),
    perUserRequestQuota: maxRequestsPerUser(),
    endpointCount: endpointsN,
    endpointQuota: Math.max(usersN, 1) * POLICY.maxEndpointsPerUser,
    maxStoredBodyChars: POLICY.maxStoredBodyChars,
  };
}

async function topTraffic(db: AppDb, since: Date) {
  const mockRows = await db
    .select({
      id: endpoints.id,
      name: endpoints.name,
      path: endpoints.path,
      owner: users.email,
      requests: sql<number>`count(${capturedRequests.id})`,
    })
    .from(capturedRequests)
    .innerJoin(endpoints, eq(endpoints.id, capturedRequests.endpointId))
    .innerJoin(users, eq(users.id, capturedRequests.userId))
    .where(gte(capturedRequests.createdAt, since))
    .groupBy(endpoints.id, endpoints.name, endpoints.path, users.email)
    .orderBy(desc(sql`count(${capturedRequests.id})`))
    .limit(5);
  const userRows = await db
    .select({
      email: users.email,
      requests: sql<number>`count(${capturedRequests.id})`,
    })
    .from(capturedRequests)
    .innerJoin(users, eq(users.id, capturedRequests.userId))
    .where(gte(capturedRequests.createdAt, since))
    .groupBy(users.email)
    .orderBy(desc(sql`count(${capturedRequests.id})`))
    .limit(5);
  return {
    mocks: mockRows.map((row) => ({ ...row, requests: Number(row.requests) })),
    users: userRows.map((row) => ({ email: row.email, requests: Number(row.requests) })),
  };
}

export async function trimHealth(db: AppDb): Promise<void> {
  const cutoff = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  await db.delete(healthBuckets).where(sql`${healthBuckets.hour} < ${cutoff}`);
  await db.delete(recentErrors).where(sql`${recentErrors.createdAt} < ${cutoff}`);
}
