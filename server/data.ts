import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { applyBehavior, emptyRuntime } from "../shared/behavior";
import { chaosTriggers, generateMockResponse, matchOperation } from "../shared/generate";
import { checkMockAuth } from "../shared/mock-auth";
import { defaultRateLimit, validateMockSpec, type MockSpec } from "../shared/mock-spec";
import { nextRateSlot, rateLimitHeaders } from "../shared/rate-quota";
import { parseXml, localName, type XmlElement } from "../shared/xml";
import { gzipBytes, zipEntries } from "./pack";
import { singleByteRange } from "../shared/range";
import { openAuth, sealAuth, sealSecret } from "./mock-secrets";
import { loadRuntime, resetRuntime, saveRuntime } from "./runtime-state";
import { CATCH_ID_BYTES } from "../shared/surface";
import { ipInCidrs, validCidrList } from "../shared/cidr";
import { ENDPOINT_PATH_RE, POLICY } from "../shared/policy";
import { newMocksLocked } from "./site-settings";
import type { AppDb } from "../db/client";
import { apiTokens, capturedRequests, endpoints, sessions, users } from "../db/schema";
import { isFoundingAdmin, maxBodyBytes, maxStoredBodyChars, publicSiteUrl, rateMax } from "./config";
import { noteCatch } from "./health";
import {
  bodyForStorage,
  clampQuery,
  redactHeaders,
  sanitizeMockHeaders,
} from "./headers";
import { HttpError } from "./http";
import { trimEndpoint, trimUserCaptures } from "./maintenance";
import { enforceRateLimit } from "./rate-limit";
import type { PublicUser } from "./auth";
import { canRead, endpointAccess, requireAccess, snapshotSpec, writeAudit, type Access } from "./collab";

function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

export function randomPath(): string {
  return randomBytes(CATCH_ID_BYTES).toString("base64url");
}

function hashLock(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createEndpointForUser(
  db: AppDb,
  user: PublicUser,
  input: {
    name?: string;
    customPath?: string;
    description?: string;
    mockSpec?: unknown;
  },
) {
  const [existingCount] = await db
    .select({ value: count() })
    .from(endpoints)
    .where(eq(endpoints.userId, user.id));
  if (Number(existingCount?.value ?? 0) >= POLICY.maxEndpointsPerUser) {
    throw new HttpError(400, "Endpoint limit reached");
  }

  const name = (input.name || "Untitled endpoint").trim().slice(0, 80);
  if (!name) throw new HttpError(400, "Name is required");
  const description = input.description?.trim().slice(0, 500) || null;
  let path = input.customPath?.trim() || "";
  if (path && !ENDPOINT_PATH_RE.test(path)) {
    throw new HttpError(
      400,
      "Path must be 4–64 characters and use only letters, numbers, hyphens, and underscores.",
    );
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = path || randomPath();
    if (!ENDPOINT_PATH_RE.test(candidate)) continue;
    const [collision] = await db
      .select({ id: endpoints.id })
      .from(endpoints)
      .where(eq(endpoints.path, candidate))
      .limit(1);
    if (collision) {
      if (path) throw new HttpError(409, "Path already exists");
      continue;
    }
    const url = `${publicSiteUrl()}/catch/${candidate}`;
    const mockSpec = input.mockSpec ? sealSpec(parseSpec(input.mockSpec)) : null;
    const lock = (await newMocksLocked(db)) ? randomBytes(32).toString("base64url") : "";
    const [created] = await db
      .insert(endpoints)
      .values({
        name,
        path: candidate,
        url,
        description,
        userId: user.id,
        mockEnabled: Boolean(mockSpec),
        mockStatusCode: mockSpec ? 200 : null,
        mockSpec,
        lockTokenHash: lock ? hashLock(lock) : null,
      })
      .returning();
    return {
      ...toEndpointDto(created, 0, { access: "owner", ownerEmail: user.email }),
      ...(lock ? { lockToken: lock } : {}),
    };
  }
  throw new HttpError(409, "Could not allocate a path");
}

export async function listEndpoints(db: AppDb, user: PublicUser) {
  const [me] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const rows = await db
    .select({
      endpoint: endpoints,
      requests: sql<number>`cast(count(${capturedRequests.id}) as int)`,
      ownerEmail: users.email,
    })
    .from(endpoints)
    .leftJoin(capturedRequests, eq(capturedRequests.endpointId, endpoints.id))
    .innerJoin(users, eq(users.id, endpoints.userId))
    .groupBy(endpoints.id, users.email)
    .orderBy(desc(endpoints.createdAt));
  const visible = [];
  for (const row of rows) {
    const access = await endpointAccess(db, { ...user, email: me?.email || user.email }, row.endpoint.id);
    if (!access) continue;
    visible.push(toEndpointDto(row.endpoint, Number(row.requests ?? 0), { access, ownerEmail: row.ownerEmail }));
  }
  return visible;
}

export async function deleteEndpointForUser(
  db: AppDb,
  userId: string,
  endpointId: string,
) {
  const deleted = await db
    .delete(endpoints)
    .where(and(eq(endpoints.id, endpointId), eq(endpoints.userId, userId)))
    .returning({ id: endpoints.id });
  if (deleted.length === 0) throw new HttpError(404, "Endpoint not found");
}

export async function configureMock(
  db: AppDb,
  userId: string,
  endpointId: string,
  input: {
    statusCode?: number;
    headers?: unknown;
    body?: string;
    delay?: number;
    enabled?: boolean;
  },
) {
  const [endpoint] = await db
    .select()
    .from(endpoints)
    .where(and(eq(endpoints.id, endpointId), eq(endpoints.userId, userId)))
    .limit(1);
  if (!endpoint) throw new HttpError(404, "Endpoint not found");

  const enabled = input.enabled !== false;
  const statusCode = input.statusCode ?? 200;
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599 || statusCode === 101) {
    throw new HttpError(400, "Status code must be between 100 and 599");
  }
  const delay = Math.min(
    POLICY.maxMockDelayMs,
    Math.max(0, Math.floor(input.delay ?? 0)),
  );
  const body = input.body ?? "";
  if (Buffer.byteLength(body) > POLICY.maxMockBodyBytes) {
    throw new HttpError(400, "Mock body is too large");
  }
  const headers = sanitizeMockHeaders(
    input.headers ?? { "content-type": "application/json" },
  );

  await db
    .update(endpoints)
    .set({
      mockEnabled: enabled,
      mockStatusCode: statusCode,
      mockHeaders: headers,
      mockBody: body,
      mockDelay: delay,
      updatedAt: new Date(),
    })
    .where(eq(endpoints.id, endpoint.id));
}

export async function listEndpointCaptures(db: AppDb, endpointId: string) {
  const rows = await db
    .select()
    .from(capturedRequests)
    .where(eq(capturedRequests.endpointId, endpointId))
    .orderBy(capturedRequests.createdAt)
    .limit(19);
  return rows.map((request) => ({
    method: request.method,
    path: request.path,
    status: request.status,
    responsePreview: request.responsePreview,
    truncated: request.truncated,
  }));
}

export async function listRequests(db: AppDb, userId: string) {
  const rows = await db
    .select({
      request: capturedRequests,
      endpointPath: endpoints.path,
    })
    .from(capturedRequests)
    .leftJoin(endpoints, eq(endpoints.id, capturedRequests.endpointId))
    .where(eq(capturedRequests.userId, userId))
    .orderBy(desc(capturedRequests.createdAt))
    .limit(100);
  return rows.map((row) => toRequestDto(row.request, row.endpointPath));
}

export async function getRequest(db: AppDb, userId: string, requestId: string) {
  const [row] = await db
    .select({
      request: capturedRequests,
      endpointPath: endpoints.path,
    })
    .from(capturedRequests)
    .leftJoin(endpoints, eq(endpoints.id, capturedRequests.endpointId))
    .where(and(eq(capturedRequests.id, requestId), eq(capturedRequests.userId, userId)))
    .limit(1);
  if (!row) throw new HttpError(404, "Request not found");
  return toRequestDto(row.request, row.endpointPath);
}

export async function resetEndpointRuntime(
  db: AppDb,
  userId: string,
  endpointId: string,
) {
  const [endpoint] = await db
    .select({ id: endpoints.id })
    .from(endpoints)
    .where(and(eq(endpoints.id, endpointId), eq(endpoints.userId, userId)))
    .limit(1);
  if (!endpoint) throw new HttpError(404, "Endpoint not found");
  await resetRuntime(db, endpoint.id);
}

export async function saveMockSpec(
  db: AppDb,
  userId: string,
  endpointId: string,
  mockSpec: unknown,
) {
  const [person] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const actor = { id: userId, email: person?.email || "", name: person?.name || "", role: "user" as const };
  await requireAccess(db, actor, endpointId, true);
  const [existing] = await db.select().from(endpoints).where(eq(endpoints.id, endpointId)).limit(1);
  if (!existing) throw new HttpError(404, "Endpoint not found");
  const next = parseSpec(mockSpec);
  if (next.push && !next.push.secret) {
    const previous = existing.mockSpec as MockSpec | null;
    if (previous?.push?.secret && next.push.signing !== "none") next.push.secret = previous.push.secret;
  }
  if (existing.mockSpec) await snapshotSpec(db, endpointId, actor.email, "Saved", existing.mockSpec);
  const spec = sealSpec(next);
  const [updated] = await db
    .update(endpoints)
    .set({
      mockSpec: spec,
      mockEnabled: true,
      mockStatusCode: spec.operations[0]?.status ?? 200,
      updatedAt: new Date(),
    })
    .where(eq(endpoints.id, endpointId))
    .returning();
  await writeAudit(db, actor.email, "save", endpointId, updated.name);
  const access = await endpointAccess(db, actor, endpointId);
  return toEndpointDto(updated, 0, { access: access || "edit" });
}

export async function getEndpointForUser(
  db: AppDb,
  userId: string,
  endpointId: string,
) {
  const [person] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const actor = { id: userId, email: person?.email || "", name: person?.name || "", role: "user" as const };
  const access = await canRead(db, actor, endpointId);
  if (!access) throw new HttpError(404, "Endpoint not found");
  const [endpoint] = await db.select().from(endpoints).where(eq(endpoints.id, endpointId)).limit(1);
  if (!endpoint) throw new HttpError(404, "Endpoint not found");
  const [owner] = await db.select().from(users).where(eq(users.id, endpoint.userId)).limit(1);
  return toEndpointDto(endpoint, 0, { access, ownerEmail: owner?.email });
}

export async function cloneEndpointForUser(db: AppDb, user: PublicUser, endpointId: string) {
  const access = await canRead(db, user, endpointId);
  if (!access) throw new HttpError(404, "Endpoint not found");
  const [endpoint] = await db.select().from(endpoints).where(eq(endpoints.id, endpointId)).limit(1);
  if (!endpoint) throw new HttpError(404, "Endpoint not found");
  const created = await createEndpointForUser(db, user, {
    name: `Copy of ${endpoint.name}`.slice(0, 80),
    description: endpoint.description || undefined,
    mockSpec: endpoint.mockSpec ? openSpec(endpoint.mockSpec) : undefined,
  });
  await writeAudit(db, user.email, "clone", endpoint.id, created.id);
  return { ...created, access: "owner" as const, ownerEmail: user.email };
}

export async function captureOnPath(
  db: AppDb,
  path: string,
  subpath: string,
  request: Request,
  ip: string,
): Promise<{
  status: number;
  body: string;
  bodyBytes?: Uint8Array;
  headers: Record<string, string>;
  json: boolean;
  stream?: boolean;
  dripMs?: number;
}> {
  const started = Date.now();
  if (!ENDPOINT_PATH_RE.test(path)) {
    throw new HttpError(404, "Not found");
  }
  const [endpoint] = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.path, path))
    .limit(1);
  if (!endpoint) throw new HttpError(404, "Not found");
  const presented = lockTokenFrom(request);
  if (endpoint.lockTokenHash || endpoint.lockCidrs) {
    const tokenOk = !endpoint.lockTokenHash || (presented !== "" && hashLock(presented) === endpoint.lockTokenHash);
    const ipOk = !endpoint.lockCidrs || ipInCidrs(ip, endpoint.lockCidrs);
    if (!tokenOk || !ipOk) throw new HttpError(404, "Not found");
  }
  const [owner] = await db.select().from(users).where(eq(users.id, endpoint.userId)).limit(1);
  if (!owner?.active || endpoint.disabled) {
    await noteCatch(db, 403, Date.now() - started);
    throw new HttpError(403, endpoint.disabled ? "This mock is disabled" : "This mock is unavailable");
  }

  await enforceRateLimit(
    db,
    `catch-ip:${ip}`,
    rateMax("RATE_CATCH_IP_MAX", 300),
    60_000,
  );
  await enforceRateLimit(
    db,
    `catch-endpoint:${endpoint.id}`,
    rateMax("RATE_CATCH_ENDPOINT_MAX", 600),
    60_000,
  );
  await enforceRateLimit(
    db,
    `catch-user:${endpoint.userId}`,
    rateMax("RATE_CATCH_USER_MAX", 1200),
    60_000,
  );

  const text = await readCatchBody(request);
  const storedBody = bodyForStorage(text, request.headers.get("content-type"));
  const url = new URL(request.url);
  const urlQuery = Object.fromEntries(url.searchParams.entries());
  const mergedQuery = clampQuery(
    mergeRequestFields(text, request.headers.get("content-type"), urlQuery),
  );
  delete mergedQuery.lock;
  const query = redactQuery(mergedQuery);
  const userAgent = (request.headers.get("user-agent") ?? "unknown").slice(0, 512);
  const produced = await produceResponse(
    db,
    endpoint,
    request,
    subpath,
    mergedQuery,
    url,
    text,
    urlQuery,
  );
  const durationMs = Date.now() - started;

  await db.insert(capturedRequests).values({
    method: request.method.slice(0, 16),
    path: subpath === "/" ? endpoint.path : `${endpoint.path}${subpath}`,
    status: produced.status,
    ip: ip.slice(0, 64),
    userAgent,
    headers: redactHeaders(request.headers),
    body: redactStoredBody(storedBody),
    query,
    truncated: produced.capped,
    responsePreview: (produced.preview || produced.body).slice(0, 2000),
    chaosEffects: produced.chaosEffects,
    recordCount: produced.recordCount,
    durationMs,
    userId: endpoint.userId,
    endpointId: endpoint.id,
  });
  await noteCatch(db, produced.status, durationMs);

  try {
    await trimEndpoint(db, endpoint.id);
    await trimUserCaptures(db, endpoint.userId);
  } catch (error) {
    console.error(
      "retention trim failed",
      error instanceof Error ? error.message : "",
    );
  }

  const delay = Math.min(
    POLICY.maxMockDelayMs,
    Math.max(endpoint.mockDelay || 0, produced.delayMs),
  );
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return {
    status: produced.status,
    body: produced.body,
    bodyBytes: produced.bodyBytes,
    headers: sanitizeMockHeaders(produced.headers),
    json: produced.json,
    stream: produced.stream,
    dripMs: produced.dripMs,
  };
}

function applyRange(
  bytes: Uint8Array,
  header: string | null,
  enabled: boolean,
  streaming: boolean,
): { status: number; bytes: Uint8Array; headers: Record<string, string> } | null {
  if (!enabled || streaming || !header) return null;
  const range = singleByteRange(bytes.byteLength, header);
  if (range === "invalid") {
    return {
      status: 416,
      bytes: new Uint8Array(),
      headers: { "content-range": `bytes */${bytes.byteLength}` },
    };
  }
  if (!range) return null;
  return {
    status: 206,
    bytes: bytes.slice(range.start, range.end + 1),
    headers: { "content-range": `bytes ${range.start}-${range.end}/${bytes.byteLength}` },
  };
}

async function produceResponse(
  db: AppDb,
  endpoint: typeof endpoints.$inferSelect,
  request: Request,
  subpath: string,
  query: Record<string, string>,
  url: URL,
  bodyText: string,
  urlQuery: Record<string, string> = {},
): Promise<{
  status: number;
  body: string;
  bodyBytes?: Uint8Array;
  preview?: string;
  headers: Record<string, string>;
  json: boolean;
  chaosEffects: string[];
  recordCount: number | null;
  delayMs: number;
  capped: boolean;
  stream?: boolean;
  dripMs?: number;
}> {
  if (endpoint.mockEnabled && endpoint.mockSpec) {
    let spec: MockSpec;
    try {
      spec = validateMockSpec(openSpec(endpoint.mockSpec));
    } catch {
      return {
        status: 500,
        body: JSON.stringify({ error: "Saved mock spec is invalid" }),
        headers: { "content-type": "application/json; charset=utf-8" },
        json: true,
        chaosEffects: [],
        recordCount: null,
        delayMs: 0,
        capped: false,
      };
    }
    const requestIndex = await nextRequestCount(db, endpoint.id);
    const headerMap = headersOf(request);
    const chaos = chaosTriggers(spec.chaos, requestIndex) ? spec.chaos : null;
    const auth = checkMockAuth(
      spec,
      {
        method: request.method,
        path: url.pathname,
        query,
        urlQuery,
        headers: headerMap,
        body: bodyText,
        scheme: url.protocol.replace(":", ""),
        host: headerMap.host || url.host,
      },
      Date.now(),
      chaos,
    );
    if (!auth.ok || auth.handled) {
      return {
        status: auth.status,
        body: auth.body,
        headers: auth.headers,
        json: false,
        chaosEffects: auth.chaosEffects,
        recordCount: 0,
        delayMs: 0,
        capped: false,
      };
    }
    const hint = {
      ...xmlHint(bodyText, headerMap),
      headers: headerMap,
      body: bodyText,
    };
    const matched = matchOperation(spec, request.method, subpath, query, hint);
    if (!matched) {
      return {
        status: 404,
        body: JSON.stringify({
          error: `No mock operation matches ${request.method.toUpperCase()} ${subpath}`,
          operations: spec.operations.map(
            (operation) => `${operation.method} ${operation.pathTemplate}`,
          ),
        }),
        headers: { "content-type": "application/json; charset=utf-8" },
        json: true,
        chaosEffects: [],
        recordCount: 0,
        delayMs: 0,
        capped: false,
      };
    }
    const quota = spec.rateLimit ?? defaultRateLimit();
    const trackRuntime = quota.enabled || behaviorActive(spec);
    let state = trackRuntime ? await loadRuntime(db, endpoint.id) : emptyRuntime();
    const slot = nextRateSlot({
      quota,
      count: state.rateCount || 0,
      windowStart: state.rateWindowStart || 0,
      now: Date.now(),
    });
    if (quota.enabled) {
      state = { ...state, rateCount: slot.count, rateWindowStart: slot.windowStart };
    }
    const quotaHeaders = rateLimitHeaders(quota, slot);
    if (slot.limited) {
      await saveRuntime(db, endpoint.id, state);
      return {
        status: 429,
        body: JSON.stringify({ error: "Too Many Requests", status: 429 }),
        headers: { "content-type": "application/json; charset=utf-8", ...quotaHeaders },
        json: true,
        chaosEffects: [],
        recordCount: 0,
        delayMs: 0,
        capped: false,
      };
    }
    let generated = generateMockResponse({
      spec,
      operation: matched.operation,
      pathParams: matched.pathParams,
      query,
      requestIndex,
      requestUrl: url.origin + url.pathname,
      soapAction: hint.soapAction,
      requestElement: hint.requestElement,
      body: bodyText,
    });
    if (behaviorActive(spec)) {
      const applied = applyBehavior({
        spec,
        operation: matched.operation,
        method: request.method,
        pathParams: matched.pathParams,
        query,
        bodyText,
        requestIndex,
        generated,
        state,
      });
      generated = applied.result;
      state = applied.state;
    }
    if (trackRuntime) await saveRuntime(db, endpoint.id, state);
    const packed = packBody(generated.pack);
    const ranged = applyRange(
      packed?.bytes ?? new TextEncoder().encode(generated.body),
      request.headers.get("range"),
      Boolean(packed) || Boolean(matched.operation.downloadBytes),
      Boolean(generated.stream),
    );
    return {
      ...generated,
      status: ranged?.status ?? generated.status,
      body: ranged ? new TextDecoder().decode(ranged.bytes) : generated.body,
      bodyBytes: packed || ranged ? (ranged?.bytes ?? packed?.bytes) : undefined,
      preview: (packed?.preview || generated.body).slice(0, 2000),
      headers: {
        ...(packed ? { ...generated.headers, ...packed.headers } : generated.headers),
        ...(ranged?.headers ?? {}),
        ...quotaHeaders,
      },
      json: false,
      stream: generated.stream && !packed && !ranged,
      dripMs: generated.dripMs,
    };
  }

  if (endpoint.mockEnabled && endpoint.mockBody != null) {
    return {
      status: endpoint.mockStatusCode || 200,
      body: endpoint.mockBody,
      headers: sanitizeMockHeaders(endpoint.mockHeaders ?? {}),
      json: false,
      chaosEffects: [],
      recordCount: null,
      delayMs: 0,
      capped: false,
    };
  }

  return {
    status: 200,
    body: JSON.stringify({
      message: "Captured by PAN Parrot.",
      notice:
        "Unofficial personal tool, not a Palo Alto Networks service. Do not send secrets or customer data.",
      captured: true,
      method: request.method,
      endpoint: endpoint.path,
    }),
    headers: { "content-type": "application/json; charset=utf-8" },
    json: true,
    chaosEffects: [],
    recordCount: null,
    delayMs: 0,
    capped: false,
  };
}

async function nextRequestCount(db: AppDb, endpointId: string): Promise<number> {
  const result = await db.execute(sql`
    UPDATE endpoints
    SET mock_request_count = mock_request_count + 1
    WHERE id = ${endpointId}
    RETURNING mock_request_count
  `);
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? []);
  const count = Number((rows[0] as { mock_request_count?: unknown } | undefined)?.mock_request_count);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

async function readCatchBody(request: Request): Promise<string> {
  const { readLimitedText } = await import("./http");
  if (request.method === "GET" || request.method === "HEAD") return "";
  return readLimitedText(request, maxBodyBytes());
}

function lockTokenFrom(request: Request): string {
  const header = request.headers.get("x-pan-parrot-lock")?.trim() || "";
  if (header) return header.slice(0, 200);
  const query = new URL(request.url).searchParams.get("lock")?.trim() || "";
  return query.slice(0, 200);
}

export async function setEndpointLock(
  db: AppDb,
  user: PublicUser,
  endpointId: string,
  input: { enabled: boolean; cidrs?: string },
) {
  const access = await endpointAccess(db, user, endpointId);
  if (access !== "owner" && access !== "edit") {
    throw new HttpError(access ? 403 : 404, access ? "Only the owner can lock this mock" : "Not found");
  }
  const [endpoint] = await db.select().from(endpoints).where(eq(endpoints.id, endpointId)).limit(1);
  if (!endpoint) throw new HttpError(404, "Not found");
  if (!input.enabled) {
    await db
      .update(endpoints)
      .set({ lockTokenHash: null, lockCidrs: null, updatedAt: new Date() })
      .where(eq(endpoints.id, endpoint.id));
    return { locked: false };
  }
  const cidrs = input.cidrs?.trim() || "";
  if (cidrs && !validCidrList(cidrs)) throw new HttpError(400, "Enter IPv4 addresses or CIDR blocks");
  const token = randomBytes(32).toString("base64url");
  await db
    .update(endpoints)
    .set({
      lockTokenHash: hashLock(token),
      lockCidrs: cidrs || null,
      updatedAt: new Date(),
    })
    .where(eq(endpoints.id, endpoint.id));
  return { locked: true, lockToken: token };
}

function toEndpointDto(
  endpoint: typeof endpoints.$inferSelect,
  requests: number,
  extra: { access?: Access; ownerEmail?: string } = {},
) {
  return {
    id: endpoint.id,
    name: endpoint.name,
    path: endpoint.path,
    url: endpoint.url,
    description: endpoint.description,
    userId: endpoint.userId,
    created: iso(endpoint.createdAt),
    published: endpoint.published,
    locked: Boolean(endpoint.lockTokenHash || endpoint.lockCidrs),
    access: extra.access,
    ownerEmail: extra.ownerEmail,
    requests,
    mockResponse: endpoint.mockEnabled
      ? {
          statusCode: endpoint.mockStatusCode ?? 200,
          headers: endpoint.mockHeaders ?? {},
          body: endpoint.mockBody ?? "",
          delay: endpoint.mockDelay ?? 0,
          enabled: true,
        }
      : undefined,
    mockSpec: openSpec(endpoint.mockSpec),
  };
}

function toRequestDto(
  request: typeof capturedRequests.$inferSelect,
  endpointPath: string | null,
) {
  const stored = request.path || endpointPath || "";
  const endpoint = stored.startsWith("/catch/")
    ? stored
    : `/catch/${stored}`;
  return {
    id: request.id,
    method: request.method,
    endpoint,
    timestamp: iso(request.createdAt),
    status: request.status,
    ip: request.ip ?? "unknown",
    userAgent: request.userAgent ?? "unknown",
    headers: request.headers ?? {},
    body: request.body,
    query: request.query ?? {},
    userId: request.userId,
    truncated: request.truncated,
    responsePreview: request.responsePreview,
    chaosEffects: request.chaosEffects ?? [],
    recordCount: request.recordCount,
  };
}

function behaviorActive(spec: MockSpec): boolean {
  const behavior = spec.behavior;
  return Boolean(
    behavior &&
      (behavior.state.enabled || behavior.scenario.enabled || behavior.fetch.enabled),
  );
}

function parseSpec(input: unknown): MockSpec {
  try {
    return validateMockSpec(input);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, error instanceof Error ? error.message : "Invalid mock");
  }
}

function sealSpec(spec: MockSpec): MockSpec {
  const push = spec.push?.secret ? { ...spec.push, secret: sealSecret(spec.push.secret) } : spec.push;
  return { ...spec, auth: sealAuth(spec.auth), push };
}

function openSpec(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const spec = { ...(raw as MockSpec) };
  if (spec.auth) spec.auth = openAuth(spec.auth);
  if (spec.push) {
    const hasSecret = Boolean(spec.push.secret);
    spec.push = { ...spec.push, secret: undefined, hasSecret };
  }
  return spec;
}

function headersOf(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value.slice(0, 2048);
  });
  return headers;
}

function mergeRequestFields(
  body: string,
  contentType: string | null,
  query: Record<string, string>,
): Record<string, string> {
  const merged = { ...query };
  const type = (contentType || "").toLowerCase();
  if (!body) return merged;
  if (type.includes("json")) {
    try {
      const parsed = JSON.parse(body) as { token?: string; data?: Array<{ token?: string }> };
      const token = parsed.token || parsed.data?.[0]?.token;
      if (token && !merged.token) merged.token = String(token).slice(0, 200);
    } catch {
      return merged;
    }
  } else if (type.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(body);
    for (const [key, value] of params) {
      if (!merged[key]) merged[key] = value.slice(0, 2048);
    }
  }
  return merged;
}

function xmlHint(body: string, headers: Record<string, string>): { soapAction?: string; requestElement?: string } {
  const action = headers.soapaction?.replace(/"/g, "") || soapActionFromType(headers["content-type"]);
  if (!body.trim().startsWith("<")) return { soapAction: action };
  try {
    const root = parseXml(body.slice(0, 256 * 1024));
    const bodyElement = findLocal(root, "Body");
    const requestElement = bodyElement?.children[0] ? localName(bodyElement.children[0].name) : localName(root.name);
    return { soapAction: action, requestElement };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("DTD") || message.includes("entity")) {
      throw new HttpError(400, "XML DTD and entity declarations are not allowed");
    }
    return { soapAction: action };
  }
}

function soapActionFromType(contentType: string | undefined): string | undefined {
  const match = /action="?([^";]+)"?/i.exec(contentType || "");
  return match?.[1];
}

function findLocal(element: XmlElement, name: string): XmlElement | undefined {
  if (localName(element.name) === name) return element;
  for (const child of element.children) {
    const found = findLocal(child, name);
    if (found) return found;
  }
  return undefined;
}

function packBody(pack: { format: "zip" | "gzip" | "octet"; filename: string; entries: { name: string; text: string }[] } | undefined) {
  if (!pack || pack.entries.length === 0) return null;
  const preview = pack.entries.map((entry) => `${entry.name}\n${entry.text}`).join("\n").slice(0, 2000);
  if (pack.format === "zip") {
    return {
      bytes: new Uint8Array(zipEntries(pack.entries.map((entry) => ({ name: entry.name, data: Buffer.from(entry.text) })))),
      preview,
      headers: {},
    };
  }
  const first = Buffer.from(pack.entries[0].text);
  return {
    bytes: new Uint8Array(pack.format === "gzip" ? gzipBytes(first) : first),
    preview,
    headers: {},
  };
}

const SECRET_QUERY = /key|token|secret|password|credential/i;

function redactQuery(query: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    out[key] = SECRET_QUERY.test(key) ? "[redacted]" : value;
  }
  return out;
}

function redactStoredBody(body: unknown): unknown {
  if (Array.isArray(body)) return body.map((item) => redactStoredBody(item));
  if (body && typeof body === "object" && "raw" in body && typeof (body as { raw?: unknown }).raw === "string") {
    return {
      raw: String((body as { raw: string }).raw).replace(
        /<(key|password|apikey|apiKey)>([^<]*)<\/\1>/gi,
        "<$1>[redacted]</$1>",
      ),
    };
  }
  if (body && typeof body === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      out[key] = SECRET_QUERY.test(key) ? "[redacted]" : redactStoredBody(value);
    }
    return out;
  }
  return body;
}

export async function listUsers(db: AppDb, query = "") {
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  const needle = query.trim().toLowerCase().slice(0, 80);
  const filtered = needle
    ? rows.filter(
        (user) => user.email.toLowerCase().includes(needle) || user.name.toLowerCase().includes(needle),
      )
    : rows;
  return filtered.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "ADMIN" ? "admin" : "user",
    created: iso(user.createdAt),
    lastLogin: iso(user.lastLogin),
    active: user.active,
    permanentAdmin: isFoundingAdmin(user.email),
  }));
}

export async function updateUserAsAdmin(
  db: AppDb,
  actor: PublicUser,
  userId: string,
  input: { name?: string; role?: "user" | "admin"; active?: boolean },
) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new HttpError(404, "User not found");

  const nextRole =
    input.role === undefined
      ? user.role
      : input.role === "admin"
        ? "ADMIN"
        : "USER";
  const nextActive = input.active === undefined ? user.active : input.active;
  if (isFoundingAdmin(user.email) && (nextRole !== "ADMIN" || !nextActive)) {
    throw new HttpError(400, "ashamah@paloaltonetworks.com stays an admin");
  }
  await assertKeepsAnAdmin(db, user, nextRole, nextActive);

  const [updated] = await db
    .update(users)
    .set({
      name: input.name?.trim().slice(0, 80) || user.name,
      role: nextRole,
      active: nextActive,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning();

  if (!nextActive) {
    await db.delete(sessions).where(eq(sessions.userId, user.id));
  }
  if (nextActive !== user.active) {
    await writeAudit(db, actor.email, nextActive ? "unsuspend" : "suspend", null, user.email);
  }
  if (nextRole !== user.role) {
    await writeAudit(db, actor.email, nextRole === "ADMIN" ? "promote" : "demote", null, user.email);
  }
  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role === "ADMIN" ? "admin" : "user",
    created: iso(updated.createdAt),
    lastLogin: iso(updated.lastLogin),
    active: updated.active,
    permanentAdmin: isFoundingAdmin(updated.email),
  };
}

export async function deleteUserAsAdmin(
  db: AppDb,
  actor: PublicUser,
  userId: string,
) {
  if (actor.id === userId) {
    throw new HttpError(400, "Cannot delete your own account");
  }
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new HttpError(404, "User not found");
  if (isFoundingAdmin(user.email)) {
    throw new HttpError(400, "ashamah@paloaltonetworks.com stays an admin");
  }
  await assertKeepsAnAdmin(db, user, "USER", false);
  await writeAudit(db, actor.email, "delete-user", null, user.email);
  await db.delete(users).where(eq(users.id, user.id));
}

export async function revokeUserSessions(db: AppDb, actor: PublicUser, userId: string) {
  const user = await requireAdminTarget(db, userId);
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  await writeAudit(db, actor.email, "revoke-sessions", null, user.email);
}

export async function revokeUserTokens(db: AppDb, actor: PublicUser, userId: string) {
  const user = await requireAdminTarget(db, userId);
  await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.userId, user.id), isNull(apiTokens.revokedAt)));
  await writeAudit(db, actor.email, "revoke-tokens", null, user.email);
}

export async function listAdminMocks(db: AppDb, query = "") {
  const rows = await db
    .select({
      id: endpoints.id,
      name: endpoints.name,
      path: endpoints.path,
      disabled: endpoints.disabled,
      owner: users.email,
    })
    .from(endpoints)
    .innerJoin(users, eq(users.id, endpoints.userId))
    .orderBy(desc(endpoints.updatedAt));
  const needle = query.trim().toLowerCase().slice(0, 80);
  return (needle
    ? rows.filter(
        (row) =>
          row.name.toLowerCase().includes(needle) ||
          row.path.toLowerCase().includes(needle) ||
          row.owner.toLowerCase().includes(needle),
      )
    : rows
  ).slice(0, 100);
}

export async function setMockDisabled(db: AppDb, actor: PublicUser, endpointId: string, disabled: boolean) {
  const [endpoint] = await db.select().from(endpoints).where(eq(endpoints.id, endpointId)).limit(1);
  if (!endpoint) throw new HttpError(404, "Endpoint not found");
  await db.update(endpoints).set({ disabled, updatedAt: new Date() }).where(eq(endpoints.id, endpoint.id));
  await writeAudit(db, actor.email, disabled ? "disable-mock" : "enable-mock", endpoint.id, endpoint.path);
  return { id: endpoint.id, disabled };
}

export async function purgeMockRequests(db: AppDb, actor: PublicUser, endpointId: string) {
  const [endpoint] = await db.select().from(endpoints).where(eq(endpoints.id, endpointId)).limit(1);
  if (!endpoint) throw new HttpError(404, "Endpoint not found");
  await db.delete(capturedRequests).where(eq(capturedRequests.endpointId, endpoint.id));
  await writeAudit(db, actor.email, "purge-mock", endpoint.id, endpoint.path);
}

async function requireAdminTarget(db: AppDb, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new HttpError(404, "User not found");
  return user;
}

async function assertKeepsAnAdmin(
  db: AppDb,
  user: { role: "USER" | "ADMIN"; active: boolean },
  nextRole: "USER" | "ADMIN",
  nextActive: boolean,
) {
  const wasAdmin = user.role === "ADMIN" && user.active;
  const staysAdmin = nextRole === "ADMIN" && nextActive;
  if (!wasAdmin || staysAdmin) return;
  const [row] = await db
    .select({ value: count() })
    .from(users)
    .where(and(eq(users.role, "ADMIN"), eq(users.active, true)));
  if (Number(row?.value ?? 0) <= 1) {
    throw new HttpError(400, "Cannot remove the last admin");
  }
}
