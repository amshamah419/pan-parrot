import { and, eq, lt, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  capturedRequests,
  loginChallenges,
  rateLimits,
  sessions,
} from "../db/schema";
import { maxRequestsPerEndpoint, maxRequestsPerUser, retentionDays } from "./config";

export async function trimEndpoint(
  db: AppDb,
  endpointId: string,
): Promise<void> {
  const cutoff = new Date(Date.now() - retentionDays() * 24 * 60 * 60 * 1000);
  const cap = maxRequestsPerEndpoint();
  await db
    .delete(capturedRequests)
    .where(
      and(
        eq(capturedRequests.endpointId, endpointId),
        lt(capturedRequests.createdAt, cutoff),
      ),
    );
  await db.execute(sql`
    DELETE FROM captured_requests
    WHERE endpoint_id = ${endpointId}
      AND id IN (
        SELECT id FROM captured_requests
        WHERE endpoint_id = ${endpointId}
        ORDER BY created_at DESC
        OFFSET ${cap}
      )
  `);
}

export async function trimUserCaptures(db: AppDb, userId: string): Promise<void> {
  const cap = maxRequestsPerUser();
  await db.execute(sql`
    DELETE FROM captured_requests
    WHERE user_id = ${userId}
      AND id IN (
        SELECT id FROM captured_requests
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        OFFSET ${cap}
      )
  `);
}

/** Daily backstop for idle endpoints, expired sessions, and rate-limit rows. */
export async function runMaintenance(db: AppDb): Promise<{
  deletedRequests: number;
}> {
  const cutoff = new Date(Date.now() - retentionDays() * 24 * 60 * 60 * 1000);
  const cap = maxRequestsPerEndpoint();
  const deleted = await db
    .delete(capturedRequests)
    .where(lt(capturedRequests.createdAt, cutoff))
    .returning({ id: capturedRequests.id });

  await db.execute(sql`
    DELETE FROM captured_requests
    WHERE id IN (
      SELECT id FROM (
        SELECT
          id,
          row_number() OVER (
            PARTITION BY endpoint_id
            ORDER BY created_at DESC
          ) AS rn
        FROM captured_requests
      ) ranked
      WHERE ranked.rn > ${cap}
    )
  `);
  const userCap = maxRequestsPerUser();
  await db.execute(sql`
    DELETE FROM captured_requests
    WHERE id IN (
      SELECT id FROM (
        SELECT
          id,
          row_number() OVER (
            PARTITION BY user_id
            ORDER BY created_at DESC
          ) AS rn
        FROM captured_requests
      ) ranked
      WHERE ranked.rn > ${userCap}
    )
  `);

  const now = new Date();
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  await db.delete(loginChallenges).where(lt(loginChallenges.expiresAt, now));
  const rateCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, rateCutoff));

  return { deletedRequests: deleted.length };
}
