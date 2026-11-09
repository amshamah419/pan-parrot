import { createHmac, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { endpoints, pushDeliveries } from "../db/schema";
import { generateMockResponse } from "../shared/generate";
import { validateMockSpec, type MockSpec, type PushSpec } from "../shared/mock-spec";
import { HttpError } from "./http";
import { openSecret } from "./mock-secrets";
import { fetchPublic, type PublicFetchInit, type PublicFetchResult } from "./ssrf";

export interface PushOutcome {
  ok: boolean;
  status: number | null;
  attempts: number;
  error?: string;
}

export async function pushEndpointNow(
  db: AppDb,
  userId: string,
  endpointId: string,
  exchange: (raw: string, init?: PublicFetchInit) => Promise<PublicFetchResult> = fetchPublic,
): Promise<PushOutcome> {
  const row = await loadOwned(db, userId, endpointId);
  let spec: MockSpec;
  try {
    spec = specForSend(row.mockSpec);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, error instanceof Error ? safeError(error.message) : "Could not push");
  }
  const outcome = await deliverPush(spec, exchange);
  await recordDelivery(db, endpointId, userId, outcome);
  return outcome;
}

export async function listPushDeliveries(db: AppDb, userId: string, endpointId: string) {
  await loadOwned(db, userId, endpointId);
  const rows = await db
    .select()
    .from(pushDeliveries)
    .where(eq(pushDeliveries.endpointId, endpointId))
    .orderBy(desc(pushDeliveries.createdAt))
    .limit(20);
  return rows.map((row) => ({
    id: row.id,
    ok: row.ok,
    attempts: row.attempts,
    status: row.status,
    error: row.error,
    created: row.createdAt.toISOString(),
  }));
}

/** Scheduled runs send one event, at most one retry, and at most three mocks. */
export async function runDuePushes(
  db: AppDb,
  exchange: (raw: string, init?: PublicFetchInit) => Promise<PublicFetchResult> = fetchPublic,
): Promise<{ sent: number }> {
  const result = await db.execute(sql`
    SELECT id, user_id, mock_spec
    FROM endpoints
    WHERE coalesce(mock_spec #>> '{push,enabled}', 'false') = 'true'
      AND coalesce((mock_spec #>> '{push,intervalMinutes}')::int, 0) > 0
    LIMIT 25
  `);
  const rows = sqlRows(result);
  let sent = 0;
  for (const row of rows) {
    if (sent >= 3) break;
    const id = String(row.id || "");
    const userId = String(row.user_id || "");
    if (!id || !userId) continue;
    let spec: MockSpec;
    try {
      spec = specForSend(row.mock_spec);
    } catch {
      continue;
    }
    const interval = spec.push?.intervalMinutes || 0;
    if (!spec.push?.enabled || interval <= 0) continue;
    const [last] = await db
      .select({ createdAt: pushDeliveries.createdAt })
      .from(pushDeliveries)
      .where(eq(pushDeliveries.endpointId, id))
      .orderBy(desc(pushDeliveries.createdAt))
      .limit(1);
    if (last && Date.now() - last.createdAt.getTime() < interval * 60_000 - 60_000) continue;
    let outcome: PushOutcome;
    try {
      outcome = await deliverPush(
        { ...spec, push: { ...spec.push, batch: 1, retries: Math.min(spec.push.retries, 1) } },
        exchange,
      );
    } catch (error) {
      outcome = {
        ok: false,
        status: error instanceof HttpError ? error.status : null,
        attempts: 1,
        error: safeError(error instanceof Error ? error.message : "Could not push", spec.push.secret),
      };
    }
    await recordDelivery(db, id, userId, outcome);
    sent += 1;
  }
  return { sent };
}

export async function deliverPush(
  spec: MockSpec,
  exchange: (raw: string, init?: PublicFetchInit) => Promise<PublicFetchResult> = fetchPublic,
): Promise<PushOutcome> {
  const push = spec.push;
  if (!push?.url) throw new HttpError(400, "Push URL is required");
  if (push.signing !== "none" && !push.secret) throw new HttpError(400, "Push signing secret is required");
  const secret = push.secret;
  let attempts = 0;
  let last: PushOutcome = { ok: false, status: null, attempts: 0, error: "Push did not run" };
  const events = Math.max(1, Math.min(3, push.batch || 1));
  for (let index = 0; index < events; index += 1) {
    const body = payload(spec, index + 1);
    const headers = signedHeaders(push, body);
    let eventOk = false;
    for (let tryNumber = 0; tryNumber <= push.retries; tryNumber += 1) {
      attempts += 1;
      try {
        const response = await exchange(push.url, {
          method: "POST",
          headers,
          body,
          timeoutMs: 3000,
          followRedirects: false,
          maxBytes: 8_000,
          oversize: "truncate",
        });
        if (response.status >= 200 && response.status < 300) {
          eventOk = true;
          last = { ok: true, status: response.status, attempts };
          break;
        }
        last = {
          ok: false,
          status: response.status,
          attempts,
          error: response.status >= 300 && response.status < 400 ? "Push does not follow redirects" : `Upstream returned ${response.status}`,
        };
        if (response.status < 500) break;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not reach the URL";
        last = { ok: false, status: null, attempts, error: safeError(message, secret) };
        if (error instanceof HttpError && error.status < 500) break;
      }
    }
    if (!eventOk) return { ...last, attempts };
  }
  return { ...last, ok: true, attempts };
}

function payload(spec: MockSpec, requestIndex: number): string {
  const operation = spec.operations[0];
  const quiet = { ...spec, chaos: { ...spec.chaos, enabled: false } };
  const generated = generateMockResponse({
    spec: quiet,
    operation,
    query: { limit: "1", ...(operation.queryMatch || {}) },
    pathParams: {},
    requestIndex,
  });
  let event: unknown = generated.body;
  const trimmed = generated.body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      event = JSON.parse(generated.body) as unknown;
    } catch {
      event = { body: generated.body.slice(0, 4000) };
    }
  }
  return JSON.stringify({ source: "pan-parrot", sentAt: new Date().toISOString(), event });
}

function signedHeaders(push: PushSpec, body: string): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (push.signing === "hmac-sha256" && push.secret) {
    const digest = createHmac("sha256", push.secret).update(body).digest("hex");
    headers["x-pan-parrot-signature"] = `sha256=${digest}`;
  }
  if (push.signing === "bearer" && push.secret) {
    headers.authorization = `Bearer ${push.secret}`;
  }
  return headers;
}

function safeError(message: string, secret?: string): string {
  let text = message.slice(0, 180);
  if (secret && secret.length > 4) text = text.split(secret).join("[redacted]");
  return text;
}

async function loadOwned(db: AppDb, userId: string, endpointId: string) {
  const [row] = await db
    .select()
    .from(endpoints)
    .where(and(eq(endpoints.id, endpointId), eq(endpoints.userId, userId)))
    .limit(1);
  if (!row?.mockSpec) throw new HttpError(404, "Endpoint not found");
  return row;
}

export async function pushScheduleHandler(): Promise<Response> {
  const { getDb } = await import("../db/client");
  return Response.json(await runDuePushes(await getDb()));
}

function specForSend(raw: unknown): MockSpec {
  const copy = structuredClone(raw) as MockSpec;
  const sealed = copy.push?.secret;
  if (copy.push) copy.push = { ...copy.push, secret: undefined };
  const spec = validateMockSpec(copy);
  if (spec.push && sealed) spec.push.secret = openSecret(sealed);
  if (!spec.push?.url) throw new HttpError(400, "Push URL is required");
  return spec;
}

async function recordDelivery(db: AppDb, endpointId: string, userId: string, outcome: PushOutcome) {
  await db.insert(pushDeliveries).values({
    id: randomUUID(),
    endpointId,
    userId,
    ok: outcome.ok,
    attempts: outcome.attempts,
    status: outcome.status,
    error: outcome.error?.slice(0, 180) || null,
  });
  await db.execute(sql`
    DELETE FROM push_deliveries
    WHERE endpoint_id = ${endpointId}
      AND id IN (
        SELECT id FROM push_deliveries
        WHERE endpoint_id = ${endpointId}
        ORDER BY created_at DESC
        OFFSET 30
      )
  `);
}

function sqlRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const rows = (result as { rows?: Array<Record<string, unknown>> }).rows;
  return rows || [];
}
