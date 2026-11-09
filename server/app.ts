import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { mockFromSample } from "../shared/infer";
import { specFromDocument } from "../shared/openapi";
import { specFromXml } from "../shared/wsdl";
import { readZip, zipEntries } from "./pack";
import { POLICY } from "../shared/policy";
import { parse as parseYaml } from "yaml";
import { exportFixture } from "../shared/export-fixture";
import { validateMockSpec } from "../shared/mock-spec";
import { isOpenApiDocument, isXsoarIntegration, mockFromIntegrationYaml } from "../shared/xsoar-yaml";
import {
  adminUsage,
  listAdminAudit,
  listCatalog,
  listEndpointAudit,
  listShares,
  listVersions,
  purgeUserData,
  revertToVersion,
  setPublished,
  shareEndpoint,
  unshareEndpoint,
} from "./collab";
import { listPushDeliveries, pushEndpointNow, pushScheduleHandler } from "./push";
import { recordUpstream } from "./record";
import { fetchPublicSpec } from "./ssrf";
import { createToken, listTokens, revokeToken, userFromApiToken } from "./tokens";
import type { AppDb } from "../db/client";
import { getDb } from "../db/client";
import {
  destroySession,
  requestSignIn,
  secureCookie,
  userFromCookie,
  verifySignIn,
  type PublicUser,
} from "./auth";
import {
  cookieIsSecure,
  isAllowedOrigin,
  rateMax,
} from "./config";
import {
  captureOnPath,
  configureMock,
  createEndpointForUser,
  deleteEndpointForUser,
  deleteUserAsAdmin,
  getEndpointForUser,
  getRequest,
  cloneEndpointForUser,
  listEndpoints,
  listRequests,
  listUsers,
  resetEndpointRuntime,
  saveMockSpec,
  updateUserAsAdmin,
} from "./data";
import { clientIp, HttpError, readJson } from "./http";
import { runMaintenance } from "./maintenance";
import { adminSignals, readHealth } from "./ops";
import { enforceRateLimit, limitAuthed, limitPing } from "./rate-limit";
import { sessionCookieOptions } from "./session";

export type AppEnv = {
  Variables: {
    db: AppDb;
    user: PublicUser;
    ip: string;
  };
};

const createEndpointSchema = z.object({
  name: z.string().trim().max(80).optional(),
  customPath: z.string().trim().max(64).optional(),
  description: z.string().trim().max(500).optional(),
  mockSpec: z.unknown().optional(),
});

const mockSchema = z.object({
  statusCode: z.number().int().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
  delay: z.number().optional(),
  enabled: z.boolean().optional(),
});

const recordSchema = z
  .object({
    url: z.string().trim().min(1).max(2000),
    method: z.string().trim().max(10).optional(),
    headers: z.record(z.string(), z.string().max(2048)).optional(),
    body: z.string().max(16_384).optional(),
  })
  .strict();

const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    role: z.enum(["user", "admin"]).optional(),
    active: z.boolean().optional(),
  })
  .strict();

export function createServer(options?: {
  db?: AppDb;
  surface?: "all" | "api" | "catch";
}) {
  const app = new Hono<AppEnv>();

  app.onError((error, c) => {
    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status as 400);
    }
    if (error instanceof Error && error.message.startsWith("SESSION_SECRET")) {
      return c.json({ error: "Server is not configured" }, 500);
    }
    console.error(
      "request failed",
      error instanceof Error ? error.message : "unknown",
    );
    return c.json({ error: "Internal server error" }, 500);
  });

  app.use("*", async (c, next) => {
    c.set("db", options?.db ?? (await getDb()));
    c.set("ip", clientIp(c.req.raw.headers));
    await next();
    applySecurityHeaders(c);
  });

  app.use("/api/*", async (c, next) => {
    const origin = c.req.header("origin");
    if (c.req.method === "OPTIONS") {
      if (origin && !isAllowedOrigin(origin)) return c.body(null, 403);
      applyApiCors(c, origin);
      return c.body(null, 204);
    }
    if (origin && !isAllowedOrigin(origin)) {
      return c.json({ error: "Origin not allowed" }, 403);
    }
    if (c.req.header("sec-fetch-site") === "cross-site") {
      return c.json({ error: "Cross-site request blocked" }, 403);
    }
    await next();
    applyApiCors(c, origin);
  });

  app.use("/catch/*", async (c, next) => {
    if (c.req.method === "OPTIONS") {
      applyCatchCors(c);
      return c.body(null, 204);
    }
    await next();
    applyCatchCors(c);
    const cookies = c.res.headers.getSetCookie?.() ?? [];
    c.res.headers.delete("set-cookie");
    for (const cookie of cookies) {
      if (cookie.startsWith("pp-mock=")) c.res.headers.append("set-cookie", cookie);
    }
  });

  const surface = options?.surface ?? "all";
  if (surface === "catch") {
    registerCatch(app);
    app.notFound((c) => c.json({ error: "Not found" }, 404));
    return app;
  }

  const health = async (c: Context<AppEnv>) => {
    const db = c.get("db");
    try {
      await limitPing(db, c.get("ip"));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error("health check failed");
      return c.json({ ok: false, database: "down" }, 503);
    }
    const body = await readHealth(db);
    return c.json(body, body.ok ? 200 : 503);
  };
  app.get("/api/health", health);
  app.get("/api/ping", health);

  app.post("/api/auth/request", async (c) => {
    const body = await readJson(c.req.raw, POLICY.apiJsonBytes);
    const email = isRecord(body) ? body.email : undefined;
    const result = await requestSignIn(c.get("db"), email, c.get("ip"));
    return c.json(result);
  });

  app.post("/api/auth/verify", async (c) => {
    const body = await readJson(c.req.raw, POLICY.apiJsonBytes);
    const record = isRecord(body) ? body : {};
    const result = await verifySignIn(
      c.get("db"),
      { email: record.email, code: record.code, token: record.token },
      c.get("ip"),
    );
    setCookie(
      c,
      POLICY.sessionCookieName,
      result.cookieValue,
      sessionCookieOptions(secureCookie()),
    );
    return c.json({ user: result.user });
  });

  app.post("/api/auth/logout", async (c) => {
    const token = getCookie(c, POLICY.sessionCookieName);
    await destroySession(c.get("db"), token);
    deleteCookie(c, POLICY.sessionCookieName, {
      path: "/api",
      secure: cookieIsSecure(),
    });
    return c.json({ ok: true });
  });

  app.get("/api/auth/user", async (c) => {
    const user = await requireUser(c);
    return c.json(user);
  });

  app.post("/api/tokens", async (c) => {
    const user = await requireSession(c);
    await limitAuthed(c.get("db"), user.id);
    const body = await readJson(c.req.raw, POLICY.apiJsonBytes);
    const name = body && typeof body === "object" ? String((body as { name?: unknown }).name || "") : "";
    const created = await createToken(c.get("db"), user.id, name);
    return c.json(created);
  });

  app.get("/api/tokens", async (c) => {
    const user = await requireSession(c);
    await limitAuthed(c.get("db"), user.id);
    return c.json(await listTokens(c.get("db"), user.id));
  });

  app.delete("/api/tokens/:tokenId", async (c) => {
    const user = await requireSession(c);
    await limitAuthed(c.get("db"), user.id);
    await revokeToken(c.get("db"), user.id, c.req.param("tokenId"));
    return c.json({ ok: true });
  });

  app.get("/api/endpoints", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    return c.json(await listEndpoints(c.get("db"), user));
  });

  app.post("/api/endpoints", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    const parsed = createEndpointSchema.safeParse(
      await readJson(c.req.raw, POLICY.specJsonBytes),
    );
    if (!parsed.success) throw new HttpError(400, "Invalid request");
    const endpoint = await createEndpointForUser(c.get("db"), user, {
      name: parsed.data.name,
      customPath: parsed.data.customPath || undefined,
      description: parsed.data.description,
      mockSpec: parsed.data.mockSpec,
    });
    return c.json(endpoint);
  });

  app.get("/api/catalog", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    return c.json(await listCatalog(c.get("db")));
  });

  app.get("/api/endpoints/:endpointId/shares", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    return c.json(await listShares(c.get("db"), user, c.req.param("endpointId")));
  });

  app.post("/api/endpoints/:endpointId/shares", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    const body = (await readJson(c.req.raw, POLICY.apiJsonBytes)) as { email?: string; role?: string };
    return c.json(await shareEndpoint(c.get("db"), user, c.req.param("endpointId"), String(body.email || ""), String(body.role || "")));
  });

  app.delete("/api/endpoints/:endpointId/shares/:email", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    await unshareEndpoint(c.get("db"), user, c.req.param("endpointId"), decodeURIComponent(c.req.param("email")));
    return c.json({ ok: true });
  });

  app.post("/api/endpoints/:endpointId/publish", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    const body = (await readJson(c.req.raw, POLICY.apiJsonBytes)) as { published?: boolean };
    await setPublished(c.get("db"), user, c.req.param("endpointId"), Boolean(body.published));
    return c.json({ ok: true });
  });

  app.post("/api/endpoints/:endpointId/clone", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    return c.json(await cloneEndpointForUser(c.get("db"), user, c.req.param("endpointId")));
  });

  app.get("/api/endpoints/:endpointId/versions", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    return c.json(await listVersions(c.get("db"), user, c.req.param("endpointId")));
  });

  app.post("/api/endpoints/:endpointId/versions/:versionId/revert", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    await revertToVersion(c.get("db"), user, c.req.param("endpointId"), c.req.param("versionId"));
    return c.json({ ok: true });
  });

  app.get("/api/endpoints/:endpointId/audit", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    return c.json(await listEndpointAudit(c.get("db"), user, c.req.param("endpointId")));
  });

  app.get("/api/endpoints/:endpointId", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    return c.json(
      await getEndpointForUser(c.get("db"), user.id, c.req.param("endpointId")),
    );
  });

  app.put("/api/endpoints/:endpointId/spec", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    const body = await readJson(c.req.raw, POLICY.specJsonBytes);
    const record = body && typeof body === "object" ? (body as { mockSpec?: unknown }) : {};
    const endpoint = await saveMockSpec(
      c.get("db"),
      user.id,
      c.req.param("endpointId"),
      record.mockSpec,
    );
    return c.json(endpoint);
  });

  app.post("/api/endpoints/:endpointId/push", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    const outcome = await pushEndpointNow(c.get("db"), user.id, c.req.param("endpointId"));
    return c.json(outcome);
  });

  app.get("/api/endpoints/:endpointId/push", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    return c.json({ deliveries: await listPushDeliveries(c.get("db"), user.id, c.req.param("endpointId")) });
  });

  app.post("/api/endpoints/:endpointId/runtime/reset", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    await resetEndpointRuntime(c.get("db"), user.id, c.req.param("endpointId"));
    return c.json({ ok: true });
  });

  app.post("/api/record", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    const parsed = recordSchema.safeParse(await readJson(c.req.raw, POLICY.apiJsonBytes));
    if (!parsed.success) throw new HttpError(400, "Invalid request");
    return c.json(
      await recordUpstream({
        url: parsed.data.url,
        method: parsed.data.method,
        headers: parsed.data.headers,
        body: parsed.data.body,
      }),
    );
  });

  app.post("/api/specs/import", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    const body = (await readJson(c.req.raw, POLICY.specJsonBytes)) as {
      text?: string;
      url?: string;
      kind?: string;
      zipBase64?: string;
    };
    if (body.zipBase64) {
      const bytes = Buffer.from(body.zipBase64, "base64");
      const entries = readZip(bytes);
      const sample = entries.find((entry) => /\.(json|csv|log|txt|ndjson)$/i.test(entry.name));
      const text = sample ? sample.data.toString("utf8").slice(0, 100_000) : "";
      const imported = text.trim().startsWith("{") || text.trim().startsWith("[")
        ? mockFromSample(text)
        : mockFromSample(JSON.stringify({ file: sample?.name || "payload.bin", bytes: sample?.data.length || 0 }));
      imported.operations[0].pack = {
        format: "zip",
        filename: "upload.zip",
        entryName: (sample?.name || "payload.txt").split("/").pop() || "payload.txt",
        entryFormat: text.trim().startsWith("[") || text.trim().startsWith("{") ? "json" : "ndjson",
      };
      return c.json({ mockSpec: imported, warnings: [], unsupported: ["Only the first text entry was used as the shape."] });
    }
    const text = body.url
      ? await fetchPublicSpec(body.url)
      : String(body.text || "");
    if (!text.trim()) throw new HttpError(400, "Provide a spec or sample");
    if (text.length > POLICY.specJsonBytes) throw new HttpError(413, "Spec is too large");
    if (text.trim().startsWith("<")) {
      return c.json({ mockSpec: specFromXml(text), warnings: [], unsupported: [] });
    }
    if (body.kind === "sample") {
      return c.json({ mockSpec: mockFromSample(text), warnings: [], unsupported: [] });
    }
    let document: unknown;
    try {
      document = parseYaml(text);
    } catch {
      throw new HttpError(400, "Spec is not valid JSON or YAML");
    }
    try {
      if (!isOpenApiDocument(document) && isXsoarIntegration(document)) {
        return c.json({
          mockSpec: mockFromIntegrationYaml(text),
          warnings: ["Each command became an operation. Paths are /command-name unless the description contains METHOD /path."],
          unsupported: [],
        });
      }
      const imported = specFromDocument(document);
      return c.json({
        mockSpec: imported.spec,
        warnings: imported.warnings,
        unsupported: imported.unsupported,
      });
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Could not import spec");
    }
  });

  app.get("/api/endpoints/:endpointId/export", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    const endpoint = await getEndpointForUser(c.get("db"), user.id, c.req.param("endpointId"));
    if (!endpoint.mockSpec) throw new HttpError(400, "This endpoint has no mock");
    const files = exportFixture(validateMockSpec(endpoint.mockSpec), endpoint.url);
    if (c.req.query("format") === "zip") {
      const zip = zipEntries([
        { name: "test_pan_parrot.py", data: Buffer.from(files.pytest) },
        { name: "test_data.json", data: Buffer.from(files.testData) },
      ]);
      c.header("content-type", "application/zip");
      c.header("content-disposition", 'attachment; filename="pan-parrot-fixtures.zip"');
      return c.body(new Uint8Array(zip));
    }
    return c.json({
      files: {
        "test_pan_parrot.py": files.pytest,
        "test_data.json": files.testData,
      },
    });
  });

  app.delete("/api/endpoints/:endpointId", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    await deleteEndpointForUser(
      c.get("db"),
      user.id,
      c.req.param("endpointId"),
    );
    return c.json({ message: "Endpoint deleted" });
  });

  app.post("/api/endpoints/:endpointId/mock", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    const parsed = mockSchema.safeParse(
      await readJson(c.req.raw, POLICY.apiJsonBytes),
    );
    if (!parsed.success) throw new HttpError(400, "Invalid request");
    await configureMock(
      c.get("db"),
      user.id,
      c.req.param("endpointId"),
      parsed.data,
    );
    return c.json({ message: "Mock response configured" });
  });

  app.get("/api/requests", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    return c.json(await listRequests(c.get("db"), user.id));
  });

  app.get("/api/requests/:requestId", async (c) => {
    const user = await requireUser(c);
    await limitAuthed(c.get("db"), user.id);
    return c.json(
      await getRequest(c.get("db"), user.id, c.req.param("requestId")),
    );
  });

  app.get("/api/admin/signals", async (c) => {
    const user = await requireAdmin(c);
    await limitAuthed(c.get("db"), user.id);
    return c.json(await adminSignals(c.get("db")));
  });

  app.get("/api/admin/usage", async (c) => {
    const user = await requireAdmin(c);
    await limitAuthed(c.get("db"), user.id);
    return c.json(await adminUsage(c.get("db")));
  });

  app.get("/api/admin/audit", async (c) => {
    const user = await requireAdmin(c);
    await limitAuthed(c.get("db"), user.id);
    return c.json(await listAdminAudit(c.get("db")));
  });

  app.post("/api/admin/users/:userId/purge", async (c) => {
    const user = await requireAdmin(c);
    await limitAuthed(c.get("db"), user.id);
    await purgeUserData(c.get("db"), user, c.req.param("userId"));
    return c.json({ ok: true });
  });

  app.get("/api/admin/users", async (c) => {
    const user = await requireAdmin(c);
    await limitAuthed(c.get("db"), user.id);
    return c.json(await listUsers(c.get("db")));
  });

  app.put("/api/admin/users/:userId", updateAdminUser);
  app.patch("/api/admin/users/:userId", updateAdminUser);

  app.delete("/api/admin/users/:userId", async (c) => {
    const user = await requireAdmin(c);
    await limitAuthed(c.get("db"), user.id);
    await deleteUserAsAdmin(c.get("db"), user, c.req.param("userId"));
    return c.json({ message: "User deleted" });
  });

  if (surface === "all") registerCatch(app);

  app.notFound((c) => c.json({ error: "Not found" }, 404));
  return app;
}

function chunkedText(body: string, dripMs: number): ReadableStream<Uint8Array> {
  const lines = body.split("\n");
  const encoder = new TextEncoder();
  let index = 0;
  let pauses = 0;
  return new ReadableStream({
    async pull(controller) {
      if (index >= lines.length) {
        controller.close();
        return;
      }
      const suffix = index < lines.length - 1 ? "\n" : "";
      controller.enqueue(encoder.encode(lines[index] + suffix));
      index += 1;
      if (dripMs > 0 && pauses < 8 && index < lines.length) {
        pauses += 1;
        await new Promise((resolve) => setTimeout(resolve, dripMs));
      }
    },
  });
}

function registerCatch(app: Hono<AppEnv>) {
  app.all("/catch/*", async (c) => {
    const db = c.get("db");
    await enforceRateLimit(
      db,
      `catch-ip:${c.get("ip")}`,
      rateMax("RATE_CATCH_IP_MAX", 300),
      60_000,
    );
    const url = new URL(c.req.url);
    const matched = url.pathname.match(/^\/catch\/([^/]+)(\/.*)?$/);
    if (!matched) return c.json({ error: "Not found" }, 404);
    const result = await captureOnPath(
      db,
      matched[1],
      matched[2] || "/",
      c.req.raw,
      c.get("ip"),
    );
    for (const [key, value] of Object.entries(result.headers)) {
      c.header(key, value);
    }
    if (result.stream) return c.body(chunkedText(result.body, result.dripMs || 0), result.status as 200);
    if (result.bodyBytes) return c.body(new Uint8Array(result.bodyBytes), result.status as 200);
    return c.body(result.body, result.status as 200);
  });
}

async function updateAdminUser(c: Context<AppEnv>) {
  const actor = await requireAdmin(c);
  await limitAuthed(c.get("db"), actor.id);
  const parsed = updateUserSchema.safeParse(
    await readJson(c.req.raw, POLICY.apiJsonBytes),
  );
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  const user = await updateUserAsAdmin(
    c.get("db"),
    actor,
    c.req.param("userId"),
    parsed.data,
  );
  return c.json({ message: "User updated", user });
}

async function requireSession(c: Context<AppEnv>): Promise<PublicUser> {
  const user = await userFromCookie(
    c.get("db"),
    getCookie(c, POLICY.sessionCookieName),
  );
  if (!user) throw new HttpError(401, "Authentication required");
  c.set("user", user);
  return user;
}

async function requireUser(c: Context<AppEnv>): Promise<PublicUser> {
  const header = c.req.header("authorization") || "";
  if (header.startsWith("Bearer pp_")) {
    const user = await userFromApiToken(c.get("db"), header.slice("Bearer ".length).trim());
    if (!user) throw new HttpError(401, "Authentication required");
    c.set("user", user);
    return user;
  }
  return requireSession(c);
}

async function requireAdmin(c: Context<AppEnv>): Promise<PublicUser> {
  const user = await requireUser(c);
  if (user.role !== "admin") throw new HttpError(403, "Admin access required");
  return user;
}

function applyApiCors(
  c: { req: { header: (name: string) => string | undefined }; header: (name: string, value: string) => void },
  origin: string | undefined,
) {
  if (!origin || !isAllowedOrigin(origin)) return;
  c.header("Access-Control-Allow-Origin", origin);
  c.header("Access-Control-Allow-Credentials", "true");
  c.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  c.header("Vary", "Origin");
}

function applyCatchCors(c: { header: (name: string, value: string) => void }) {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type");
}

function applySecurityHeaders(c: {
  req: { path: string };
  header: (name: string, value: string) => void;
}) {
  const catchRoute = c.req.path.startsWith("/catch/");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header("X-Robots-Tag", "noindex, nofollow, noarchive");
  c.header("Cache-Control", "no-store");
  c.header("Netlify-CDN-Cache-Control", "no-store");
  c.header(
    "Content-Security-Policy",
    catchRoute
      ? "default-src 'none'; sandbox; form-action 'none'; frame-ancestors 'none'; base-uri 'none'"
      : "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  );
  c.header(
    "Cross-Origin-Resource-Policy",
    catchRoute ? "cross-origin" : "same-origin",
  );
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (cookieIsSecure()) {
    c.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export { pushScheduleHandler };

export async function maintenanceHandler(): Promise<Response> {
  const db = await getDb();
  const result = await runMaintenance(db);
  console.info(`maintenance deleted_requests=${result.deletedRequests}`);
  return Response.json(result);
}
