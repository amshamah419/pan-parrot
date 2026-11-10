import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Context, Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { parse as parseYaml } from "yaml";
import { capturedRequests, endpoints } from "../db/schema";
import { mockFromGraphql, looksLikeGraphql } from "../shared/graphql-mock";
import { specFromDocument } from "../shared/openapi";
import { POLICY } from "../shared/policy";
import { validateMockSpec, type MockSpec, type XsoarIntegration } from "../shared/mock-spec";
import { specFromXml } from "../shared/wsdl";
import { instanceGuide } from "../shared/xsoar-instance";
import { buildIntegrationMock, type TestDataFile } from "../shared/xsoar-workflow";
import { isOpenApiDocument, isXsoarIntegration } from "../shared/xsoar-yaml";
import type { AppEnv } from "./app";
import { createEndpointForUser, getEndpointForUser, saveMockSpec, deleteEndpointForUser } from "./data";
import { HttpError, readJson } from "./http";
import { limitAuthed, limitToken } from "./rate-limit";
import { resolveApiToken, type ResolvedToken, type TokenScope } from "./tokens";

const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;

export function registerV1(app: Hono<AppEnv>) {
  app.use("/api/v1/*", async (c, next) => {
    const header = c.req.header("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    const resolved = token ? await resolveApiToken(c.get("db"), token) : null;
    if (!resolved) return quietText(c);
    c.set("apiToken", resolved);
    await limitToken(c.get("db"), resolved.id);
    await limitAuthed(c.get("db"), resolved.user.id);
    await next();
  });

  app.get("/api/v1/openapi.json", (c) => {
    requireScope(c, "mocks:read");
    return c.json(openApiDocument());
  });

  app.get("/api/v1/presets", async (c) => {
    requireScope(c, "mocks:read");
    const q = (c.req.query("q") || "").trim().toLowerCase();
    const rows = await presetIndex();
    const matched = rows.filter((row) => {
      if (!q) return true;
      return `${row.id} ${row.name} ${row.pack || ""} ${row.summary || ""}`.toLowerCase().includes(q);
    });
    return c.json({
      presets: matched.slice(0, 50).map((row) => ({
        id: row.id,
        name: row.name,
        pack: row.pack,
        fidelity: row.fidelity,
        summary: row.summary,
        operations: row.operations,
        commandCoverage: row.commandCoverage,
      })),
    });
  });

  app.get("/api/v1/mocks", async (c) => {
    requireScope(c, "mocks:read");
    const user = c.get("apiToken")!.user;
    const rows = await c.get("db").select().from(endpoints).where(eq(endpoints.userId, user.id)).orderBy(desc(endpoints.updatedAt));
    return c.json({
      mocks: rows.map((row) => ({
        id: row.id,
        name: row.name,
        url: row.url,
        integrationId: row.integrationId,
        version: row.integrationVersion,
        updated: row.updatedAt.toISOString(),
      })),
    });
  });

  app.post("/api/v1/mocks", async (c) => {
    requireScope(c, "mocks:write");
    const body = await readBody(c);
    const built = await specFromUpload(body);
    const user = c.get("apiToken")!.user;
    const existing = built.integrationId
      ? await findIntegration(c, user.id, built.integrationId, built.version)
      : null;
    if (existing) {
      await saveMockSpec(c.get("db"), user.id, existing.id, built.spec);
      if (body.name) {
        await c.get("db").update(endpoints).set({ name: String(body.name).trim().slice(0, 80), updatedAt: new Date() }).where(eq(endpoints.id, existing.id));
      }
      const endpoint = await getEndpointForUser(c.get("db"), user.id, existing.id);
      return c.json({ ...mockView(endpoint, built), created: false, warnings: built.warnings, routes: routesOf(built.spec) });
    }
    const created = await createEndpointForUser(c.get("db"), user, {
      name: built.name,
      mockSpec: built.spec,
    });
    if (built.integrationId) {
      await c.get("db").update(endpoints).set({
        integrationId: built.integrationId,
        integrationVersion: built.version,
      }).where(eq(endpoints.id, created.id));
    }
    return c.json({ ...mockView(created, built), created: true, warnings: built.warnings, routes: routesOf(built.spec) }, 201);
  });

  app.get("/api/v1/mocks/:id", async (c) => {
    requireScope(c, "mocks:read");
    const user = c.get("apiToken")!.user;
    const endpoint = await getEndpointForUser(c.get("db"), user.id, c.req.param("id"));
    return c.json({
      id: endpoint.id,
      name: endpoint.name,
      url: endpoint.url,
      integrationId: endpoint.integrationId,
      version: endpoint.integrationVersion,
      spec: endpoint.mockSpec,
    });
  });

  app.put("/api/v1/mocks/:id", async (c) => {
    requireScope(c, "mocks:write");
    const user = c.get("apiToken")!.user;
    const id = c.req.param("id");
    await getEndpointForUser(c.get("db"), user.id, id);
    const body = await readBody(c);
    const built = await specFromUpload(body);
    await saveMockSpec(c.get("db"), user.id, id, built.spec);
    if (built.integrationId) {
      await c.get("db").update(endpoints).set({
        integrationId: built.integrationId,
        integrationVersion: built.version,
        updatedAt: new Date(),
      }).where(and(eq(endpoints.id, id), eq(endpoints.userId, user.id)));
    }
    const endpoint = await getEndpointForUser(c.get("db"), user.id, id);
    return c.json({ ...mockView(endpoint, built), created: false, warnings: built.warnings, routes: routesOf(built.spec) });
  });

  app.delete("/api/v1/mocks/:id", async (c) => {
    requireScope(c, "mocks:write");
    const user = c.get("apiToken")!.user;
    await deleteEndpointForUser(c.get("db"), user.id, c.req.param("id"));
    return c.json({ ok: true });
  });

  app.get("/api/v1/mocks/:id/logs", async (c) => {
    requireScope(c, "mocks:read");
    const user = c.get("apiToken")!.user;
    const id = c.req.param("id");
    await getEndpointForUser(c.get("db"), user.id, id);
    const rows = await c.get("db")
      .select({
        id: capturedRequests.id,
        method: capturedRequests.method,
        path: capturedRequests.path,
        status: capturedRequests.status,
        createdAt: capturedRequests.createdAt,
      })
      .from(capturedRequests)
      .where(and(eq(capturedRequests.endpointId, id), eq(capturedRequests.userId, user.id)))
      .orderBy(desc(capturedRequests.createdAt))
      .limit(50);
    return c.json({
      logs: rows.map((row) => ({
        id: row.id,
        method: row.method,
        path: row.path,
        status: row.status,
        created: row.createdAt.toISOString(),
      })),
    });
  });

  app.get("/api/v1/mocks/:id/instance-config", async (c) => {
    requireScope(c, "mocks:read");
    const user = c.get("apiToken")!.user;
    const endpoint = await getEndpointForUser(c.get("db"), user.id, c.req.param("id"));
    const spec = endpoint.mockSpec ? validateMockSpec(endpoint.mockSpec) : null;
    let integration = spec?.source.xsoar;
    if (!integration && endpoint.integrationId) {
      const catalog = await instanceCatalog();
      integration = catalog[endpoint.integrationId];
    }
    const guide = instanceGuide(integration, spec?.auth, endpoint.url);
    const typeByName = new Map((integration?.params || []).map((param) => [param.name, param]));
    const params = (guide?.values || []).map((item) => {
      const known = typeByName.get(item.name);
      return {
        name: item.name,
        type: known?.type ?? 0,
        display: known?.display || item.name,
        value: item.value,
      };
    });
    return c.json({
      baseUrl: endpoint.url,
      integrationId: endpoint.integrationId,
      brand: guide?.brand || integration?.brand || endpoint.integrationId || "",
      display: guide?.display || integration?.display || endpoint.name,
      params,
    });
  });
}

function requireScope(c: Context<AppEnv>, scope: TokenScope) {
  const token = c.get("apiToken");
  if (!token?.scopes.includes(scope)) throw new HttpError(403, `Missing scope ${scope}`);
}

function quietText(c: Context<AppEnv>) {
  return c.text("Not found", 404, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow, noarchive",
    "x-content-type-options": "nosniff",
  });
}

async function readBody(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  const body = await readJson(c.req.raw, POLICY.specJsonBytes);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "JSON object required");
  return body as Record<string, unknown>;
}

async function findIntegration(c: Context<AppEnv>, userId: string, integrationId: string, version: string) {
  const [row] = await c.get("db").select({ id: endpoints.id }).from(endpoints).where(and(
    eq(endpoints.userId, userId),
    eq(endpoints.integrationId, integrationId),
    eq(endpoints.integrationVersion, version),
  )).limit(1);
  return row;
}

function mockView(endpoint: { id: string; name: string; url: string }, built: Built) {
  return {
    id: endpoint.id,
    name: endpoint.name,
    url: endpoint.url,
    integrationId: built.integrationId,
    version: built.version,
  };
}

interface Built {
  spec: MockSpec;
  warnings: string[];
  name: string;
  integrationId?: string;
  version: string;
}

async function specFromUpload(body: Record<string, unknown>): Promise<Built> {
  const kinds = ["preset", "openapi", "yaml", "mockSpec"].filter((key) => body[key] != null && body[key] !== "");
  if (kinds.length !== 1) throw new HttpError(400, "Provide one of preset, openapi, yaml, or mockSpec");
  const version = cleanVersion(body.version);
  let integrationId = cleanId(body.integrationId);
  let name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  let warnings: string[] = [];
  let spec: MockSpec;
  try {
  if (typeof body.preset === "string") {
    const preset = await loadPreset(body.preset);
    spec = validateMockSpec(preset.spec);
    name = name || String(preset.name || body.preset).slice(0, 80);
    integrationId = integrationId || cleanId(preset.id);
    if (!spec.source.xsoar) {
      const catalog = await instanceCatalog();
      if (catalog[preset.id]) spec = validateMockSpec({ ...spec, source: { ...spec.source, xsoar: catalog[preset.id] } });
    }
  } else if (typeof body.openapi === "string") {
    const imported = specFromText(body.openapi);
    spec = imported.spec;
    warnings = imported.warnings;
    name = name || spec.source.name;
  } else if (typeof body.yaml === "string") {
    const testData = normalizeTestData(body.testData);
    const parsed = parseDocument(body.yaml);
    const identity = yamlIdentity(parsed);
    integrationId = integrationId || identity.id;
    const built = buildIntegrationMock({ yaml: body.yaml, testData, clientSource: clientSourceOf(body) });
    spec = built.spec;
    warnings = built.warnings;
    name = name || spec.source.name;
  } else {
    spec = validateMockSpec(body.mockSpec);
    name = name || spec.source.name;
    integrationId = integrationId || cleanId(spec.source.id);
  }
  if (!name) throw new HttpError(400, "Name is required");
  return { spec, warnings, name, integrationId, version };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, error instanceof Error ? error.message : "Could not build the mock");
  }
}

function specFromText(text: string): { spec: MockSpec; warnings: string[] } {
  if (text.length > POLICY.specJsonBytes) throw new HttpError(413, "Spec is too large");
  if (looksLikeGraphql(text)) return { spec: mockFromGraphql(text), warnings: [] };
  if (text.trim().startsWith("<")) return { spec: specFromXml(text), warnings: [] };
  const document = parseDocument(text);
  if (isXsoarIntegration(document) && !isOpenApiDocument(document)) {
    const built = buildIntegrationMock({ yaml: text });
    return { spec: built.spec, warnings: built.warnings };
  }
  const imported = specFromDocument(document);
  return { spec: imported.spec, warnings: imported.warnings };
}

function parseDocument(text: string): unknown {
  if (text.length > POLICY.specJsonBytes) throw new HttpError(413, "Spec is too large");
  try {
    return parseYaml(text);
  } catch {
    throw new HttpError(400, "Spec is not valid JSON or YAML");
  }
}

function clientSourceOf(body: Record<string, unknown>): string | undefined {
  const source = body.clientSource;
  if (typeof source !== "string" || !source.trim()) return undefined;
  if (source.length > 200_000) throw new HttpError(413, "Python client is too large");
  if (source.includes("\0")) throw new HttpError(400, "Python client is not text");
  return source;
}

function routesOf(spec: MockSpec) {
  const operations = new Map(spec.operations.map((operation) => [operation.id, operation]));
  return (spec.source.coverage || []).map((row) => {
    const operation = row.operationId ? operations.get(row.operationId) : undefined;
    return {
      command: row.command,
      method: operation?.method,
      path: operation?.pathTemplate,
      pathFrom: row.pathFrom,
      response: row.response,
    };
  });
}

function yamlIdentity(document: unknown): { id?: string } {
  if (!document || typeof document !== "object") return {};
  const doc = document as { name?: string; commonfields?: { id?: string } };
  return { id: cleanId(doc.commonfields?.id || doc.name) };
}

function normalizeTestData(value: unknown): TestDataFile[] {
  if (!Array.isArray(value)) return [];
  const files: TestDataFile[] = [];
  for (const item of value.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const row = item as { name?: unknown; text?: unknown };
    const name = String(row.name || "sample.json").split("/").pop()?.slice(0, 80) || "sample.json";
    const text = String(row.text || "");
    if (text.length > 100_000) throw new HttpError(413, "A test_data file is too large");
    files.push({ name, text });
  }
  return files;
}

function cleanId(value: unknown): string | undefined {
  const text = String(value || "").trim();
  if (!text) return undefined;
  if (!ID_RE.test(text)) throw new HttpError(400, "Integration id is not valid");
  return text;
}

function cleanVersion(value: unknown): string {
  const text = String(value ?? "0").trim() || "0";
  if (!ID_RE.test(text)) throw new HttpError(400, "Version is not valid");
  return text.slice(0, 40);
}

async function loadPreset(id: string): Promise<{ id: string; name?: string; spec: unknown }> {
  const presetId = cleanId(id);
  if (!presetId || !/^[a-z0-9-]{1,80}$/.test(presetId)) throw new HttpError(400, "Preset id is not valid");
  try {
    const text = await readFile(path.resolve("public/presets/integrations", `${presetId}.json`), "utf8");
    const preset = JSON.parse(text) as { id: string; name?: string; spec: unknown };
    if (!preset.spec) throw new HttpError(404, "Preset was not found");
    return preset;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(404, "Preset was not found");
  }
}

let presets: Array<{
  id: string;
  name: string;
  pack?: string;
  fidelity?: string;
  summary?: string;
  operations?: number;
  commandCoverage?: { total: number; vendor: number; approximate: number; missing: number };
}> | null = null;
async function presetIndex() {
  if (!presets) {
    const text = await readFile(path.resolve("public/presets/index.json"), "utf8");
    presets = (JSON.parse(text) as { presets: typeof presets }).presets || [];
  }
  return presets;
}

let instances: Record<string, XsoarIntegration> | null = null;
async function instanceCatalog() {
  if (!instances) {
    try {
      instances = JSON.parse(await readFile(path.resolve("public/presets/instance-params.json"), "utf8")) as Record<string, XsoarIntegration>;
    } catch {
      instances = {};
    }
  }
  return instances;
}

function openApiDocument() {
  const json = { "application/json": { schema: { type: "object" } } };
  return {
    openapi: "3.0.3",
    info: {
      title: "PAN Parrot agent API",
      version: "1",
      description: "Create and update mocks, read logs, and fetch the XSOAR instance configuration. Send Authorization: Bearer pp_… . A missing or rejected token is a quiet 404.",
    },
    paths: {
      "/api/v1/presets": { get: { summary: "Search catalog presets", security: [{ bearer: ["mocks:read"] }], responses: { "200": { description: "Matching presets", content: json } } } },
      "/api/v1/mocks": {
        get: { summary: "List mocks", security: [{ bearer: ["mocks:read"] }], responses: { "200": { description: "Mocks", content: json } } },
        post: { summary: "Create or upsert a mock", security: [{ bearer: ["mocks:write"] }], responses: { "201": { description: "Created", content: json }, "200": { description: "Updated", content: json } } },
      },
      "/api/v1/mocks/{id}": {
        get: { summary: "Read a mock", security: [{ bearer: ["mocks:read"] }], responses: { "200": { description: "Mock", content: json } } },
        put: { summary: "Replace a mock definition", security: [{ bearer: ["mocks:write"] }], responses: { "200": { description: "Updated", content: json } } },
        delete: { summary: "Delete a mock", security: [{ bearer: ["mocks:write"] }], responses: { "200": { description: "Deleted", content: json } } },
      },
      "/api/v1/mocks/{id}/logs": { get: { summary: "Read captured requests", security: [{ bearer: ["mocks:read"] }], responses: { "200": { description: "Logs", content: json } } } },
      "/api/v1/mocks/{id}/instance-config": { get: { summary: "Catch URL and integration parameter values", security: [{ bearer: ["mocks:read"] }], responses: { "200": { description: "Instance config", content: json } } } },
      "/api/v1/openapi.json": { get: { summary: "This document", security: [{ bearer: ["mocks:read"] }], responses: { "200": { description: "OpenAPI", content: json } } } },
    },
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
    },
  };
}
