import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import type { AppDb } from "../db/client";
import { defaultChaos, defaultPagination, type MockOperation, type MockSpec } from "../shared/mock-spec";
import { createServer } from "./app";
import { applySqlMigrations } from "./test/migrate";

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-session-secret-should-be-32b!!";
process.env.AUTH_DEV_EXPOSE_CODE = "true";
process.env.ADMIN_EMAILS = "ashamah@paloaltonetworks.com";
process.env.SITE_URL = "http://localhost:8080";
for (const key of [
  "RATE_AUTH_IP_MAX",
  "RATE_AUTH_EMAIL_MAX",
  "RATE_AUTH_VERIFY_IP_MAX",
  "RATE_AUTH_VERIFY_EMAIL_MAX",
  "RATE_API_USER_MAX",
  "RATE_CATCH_IP_MAX",
  "RATE_CATCH_ENDPOINT_MAX",
]) {
  process.env[key] = "10000";
}

function op(partial: Partial<MockOperation>): MockOperation {
  return {
    id: "op",
    method: "POST",
    pathTemplate: "/incidents",
    status: 200,
    contentType: "application/json; charset=utf-8",
    headers: {},
    list: false,
    envelope: { type: "object" },
    pagination: { ...defaultPagination(), style: "none" },
    record: { name: "incident", kind: "object", children: [{ name: "title", kind: "const", constValue: "default" }] },
    ...partial,
  };
}

const spec: MockSpec = {
  version: 1,
  source: { kind: "manual", name: "Match" },
  operations: [
    op({ id: "fallback", fallback: true }),
    op({
      id: "closed",
      priority: 10,
      bodyMatch: { path: "$.status", equals: "closed" },
      record: { name: "incident", kind: "object", children: [{ name: "title", kind: "const", constValue: "closed-rule" }] },
    }),
    op({
      id: "lab",
      priority: 5,
      headerMatch: { "x-env": "lab" },
      record: { name: "incident", kind: "object", children: [{ name: "title", kind: "const", constValue: "lab-rule" }] },
    }),
    op({
      id: "filtered",
      priority: 8,
      bodyMatch: { path: '$.items[?(@.status=="closed")].id', equals: "b" },
      record: { name: "incident", kind: "object", children: [{ name: "title", kind: "const", constValue: "filtered-rule" }] },
    }),
  ],
  chaos: defaultChaos(),
  totalRecords: 1,
};

describe("catch URL request matching", () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const app = createServer({ db: db as unknown as AppDb });

  beforeAll(async () => {
    await applySqlMigrations(db as unknown as AppDb);
    const requested = await app.request("/api/auth/request", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:8080" },
      body: JSON.stringify({ email: "ashamah@paloaltonetworks.com" }),
    });
    const pending = await requested.json();
    const verified = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:8080" },
      body: JSON.stringify({ email: "ashamah@paloaltonetworks.com", code: pending.devCode }),
    });
    const cookie = (verified.headers.get("set-cookie") || "").split(";")[0];
    const created = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Match", customPath: "matchdemo", mockSpec: spec }),
    });
    expect(created.status).toBe(200);
  });

  it("uses the body rule, then the header rule, then the fallback", async () => {
    const closed = await app.request("/catch/matchdemo/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });
    expect((await closed.json()).title).toBe("closed-rule");
    const lab = await app.request("/catch/matchdemo/incidents", {
      method: "POST",
      headers: { "content-type": "application/json", "x-env": "lab" },
      body: JSON.stringify({ status: "open" }),
    });
    expect((await lab.json()).title).toBe("lab-rule");
    const fallback = await app.request("/catch/matchdemo/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "open" }),
    });
    expect((await fallback.json()).title).toBe("default");
    const filtered = await app.request("/catch/matchdemo/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [{ id: "a", status: "open" }, { id: "b", status: "closed" }] }),
    });
    expect((await filtered.json()).title).toBe("filtered-rule");
  });
});
