import { randomBytes } from "node:crypto";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { generateMockResponse, matchOperation } from "../shared/generate";
import { validateMockSpec, type MockSpec } from "../shared/mock-spec";
import { ENDPOINT_PATH_RE, POLICY } from "../shared/policy";
import type { AppDb } from "../db/client";
import { capturedRequests, endpoints, sessions, users } from "../db/schema";
import { maxBodyBytes, publicSiteUrl, rateMax } from "./config";
import {
  bodyForStorage,
  clampQuery,
  redactHeaders,
  sanitizeMockHeaders,
} from "./headers";
import { HttpError } from "./http";
import { trimEndpoint } from "./maintenance";
import { enforceRateLimit } from "./rate-limit";
import type { PublicUser } from "./auth";

function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

function randomPath(): string {
  return randomBytes(9).toString("base64url");
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
    const mockSpec = input.mockSpec ? validateMockSpec(input.mockSpec) : null;
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
      })
      .returning();
    return toEndpointDto(created, 0);
  }
  throw new HttpError(409, "Could not allocate a path");
}

export async function listEndpoints(db: AppDb, userId: string) {
  const rows = await db
    .select({
      endpoint: endpoints,
      requests: sql<number>`cast(count(${capturedRequests.id}) as int)`,
    })
    .from(endpoints)
    .leftJoin(capturedRequests, eq(capturedRequests.endpointId, endpoints.id))
    .where(eq(endpoints.userId, userId))
    .groupBy(endpoints.id)
    .orderBy(desc(endpoints.createdAt));
  return rows.map((row) => toEndpointDto(row.endpoint, Number(row.requests ?? 0)));
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

export async function saveMockSpec(
  db: AppDb,
  userId: string,
  endpointId: string,
  mockSpec: unknown,
) {
  const spec = validateMockSpec(mockSpec);
  const updated = await db
    .update(endpoints)
    .set({
      mockSpec: spec,
      mockEnabled: true,
      mockStatusCode: spec.operations[0]?.status ?? 200,
      updatedAt: new Date(),
    })
    .where(and(eq(endpoints.id, endpointId), eq(endpoints.userId, userId)))
    .returning();
  if (updated.length === 0) throw new HttpError(404, "Endpoint not found");
  return toEndpointDto(updated[0], 0);
}

export async function getEndpointForUser(
  db: AppDb,
  userId: string,
  endpointId: string,
) {
  const [endpoint] = await db
    .select()
    .from(endpoints)
    .where(and(eq(endpoints.id, endpointId), eq(endpoints.userId, userId)))
    .limit(1);
  if (!endpoint) throw new HttpError(404, "Endpoint not found");
  return toEndpointDto(endpoint, 0);
}

export async function captureOnPath(
  db: AppDb,
  path: string,
  subpath: string,
  request: Request,
  ip: string,
): Promise<{ status: number; body: string; headers: Record<string, string>; json: boolean }> {
  if (!ENDPOINT_PATH_RE.test(path)) {
    throw new HttpError(404, "Endpoint not found");
  }
  const [endpoint] = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.path, path))
    .limit(1);
  if (!endpoint) throw new HttpError(404, "Endpoint not found");

  await enforceRateLimit(
    db,
    `catch-endpoint:${endpoint.id}`,
    rateMax("RATE_CATCH_ENDPOINT_MAX", 600),
    60_000,
  );

  const text = await readCatchBody(request);
  const storedBody = bodyForStorage(text, request.headers.get("content-type"));
  const url = new URL(request.url);
  const query = clampQuery(Object.fromEntries(url.searchParams.entries()));
  const userAgent = (request.headers.get("user-agent") ?? "unknown").slice(0, 512);
  const produced = await produceResponse(db, endpoint, request.method, subpath, query);

  await db.insert(capturedRequests).values({
    method: request.method.slice(0, 16),
    path: subpath === "/" ? endpoint.path : `${endpoint.path}${subpath}`,
    status: produced.status,
    ip: ip.slice(0, 64),
    userAgent,
    headers: redactHeaders(request.headers),
    body: storedBody,
    query,
    truncated: produced.capped,
    responsePreview: produced.body.slice(0, 2000),
    chaosEffects: produced.chaosEffects,
    recordCount: produced.recordCount,
    userId: endpoint.userId,
    endpointId: endpoint.id,
  });

  try {
    await trimEndpoint(db, endpoint.id);
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
    headers: sanitizeMockHeaders(produced.headers),
    json: produced.json,
  };
}

async function produceResponse(
  db: AppDb,
  endpoint: typeof endpoints.$inferSelect,
  method: string,
  subpath: string,
  query: Record<string, string>,
): Promise<{
  status: number;
  body: string;
  headers: Record<string, string>;
  json: boolean;
  chaosEffects: string[];
  recordCount: number | null;
  delayMs: number;
  capped: boolean;
}> {
  if (endpoint.mockEnabled && endpoint.mockSpec) {
    let spec: MockSpec;
    try {
      spec = validateMockSpec(endpoint.mockSpec);
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
    const matched = matchOperation(spec, method, subpath);
    if (!matched) {
      return {
        status: 404,
        body: JSON.stringify({
          error: `No mock operation matches ${method.toUpperCase()} ${subpath}`,
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
    const generated = generateMockResponse({
      spec,
      operation: matched.operation,
      pathParams: matched.pathParams,
      query,
      requestIndex,
    });
    return { ...generated, json: false };
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
      method,
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

function toEndpointDto(
  endpoint: typeof endpoints.$inferSelect,
  requests: number,
) {
  return {
    id: endpoint.id,
    name: endpoint.name,
    path: endpoint.path,
    url: endpoint.url,
    description: endpoint.description,
    userId: endpoint.userId,
    created: iso(endpoint.createdAt),
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
    mockSpec: endpoint.mockSpec ?? null,
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

export async function listUsers(db: AppDb) {
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  return rows.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "ADMIN" ? "admin" : "user",
    created: iso(user.createdAt),
    lastLogin: iso(user.lastLogin),
    active: user.active,
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
  void actor;
  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role === "ADMIN" ? "admin" : "user",
    created: iso(updated.createdAt),
    lastLogin: iso(updated.lastLogin),
    active: updated.active,
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
  await assertKeepsAnAdmin(db, user, "USER", false);
  await db.delete(users).where(eq(users.id, user.id));
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
