import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import type { AppDb } from "../db/client";
import { defaultBehavior, defaultChaos, defaultPagination, type MockSpec } from "../shared/mock-spec";
import { FETCH_EPOCH, formatTime } from "../shared/behavior";
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

const behavior = defaultBehavior();
behavior.state.enabled = true;
behavior.fetch.enabled = true;
behavior.fetch.perPoll = 2;
behavior.fetch.windowSeconds = 60;
behavior.scenario = {
  enabled: true,
  repeat: "last",
  steps: [{ name: "up", status: 200 }, { name: "down", status: 503, body: '{"error":"down"}' }],
};

const spec: MockSpec = {
  version: 1,
  source: { kind: "manual", name: "Incidents" },
  operations: [
    {
      id: "list",
      method: "GET",
      pathTemplate: "/incidents",
      status: 200,
      contentType: "application/json; charset=utf-8",
      headers: {},
      list: true,
      envelope: { type: "array" },
      pagination: { ...defaultPagination(), style: "none" },
      record: { name: "incident", kind: "object", children: [{ name: "name", kind: "string" }, { name: "id", kind: "id" }] },
    },
    {
      id: "one",
      method: "GET",
      pathTemplate: "/incidents/{id}",
      status: 200,
      contentType: "application/json; charset=utf-8",
      headers: {},
      list: false,
      envelope: { type: "object" },
      pagination: { ...defaultPagination(), style: "none" },
      record: { name: "incident", kind: "object", children: [{ name: "name", kind: "string" }, { name: "id", kind: "id" }] },
    },
    {
      id: "create",
      method: "POST",
      pathTemplate: "/incidents",
      status: 200,
      contentType: "application/json; charset=utf-8",
      headers: {},
      list: false,
      envelope: { type: "object" },
      pagination: { ...defaultPagination(), style: "none" },
      record: { name: "incident", kind: "object", children: [{ name: "name", kind: "string" }, { name: "id", kind: "id" }] },
    },
  ],
  chaos: defaultChaos(),
  totalRecords: 5,
  behavior,
};

describe("catch URL state, sequence, and fetch", () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const app = createServer({ db: db as unknown as AppDb });
  let cookie = "";

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
    cookie = (verified.headers.get("set-cookie") || "").split(";")[0];
    const created = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Incidents", customPath: "incidents", mockSpec: spec }),
    });
    expect(created.status).toBe(200);
  });

  it("creates a record, reads it back, then follows the scenario and fetch window", async () => {
    const created = await app.request("/catch/incidents/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Phishing" }),
    });
    expect(created.status).toBe(200);
    expect((await created.json()).name).toBe("Phishing");

    const again = await app.request("/catch/incidents/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Phishing" }),
    });
    expect(again.status).toBe(503);

    await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Stateful",
        customPath: "stateful",
        mockSpec: { ...spec, behavior: { ...behavior, scenario: { ...behavior.scenario, enabled: false } } },
      }),
    });
    const saved = await app.request("/catch/stateful/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Phishing" }),
    });
    expect(saved.status).toBe(201);
    const incident = await saved.json();
    expect(incident.name).toBe("Phishing");
    const read = await app.request(`/catch/stateful/incidents/${incident.id}`);
    expect((await read.json()).name).toBe("Phishing");

    const since = formatTime(FETCH_EPOCH, undefined);
    const first = await app.request(`/catch/stateful/incidents?since=${encodeURIComponent(since)}`);
    const firstRows = await first.json();
    expect(firstRows.length).toBeGreaterThan(0);
    const replay = await app.request(`/catch/stateful/incidents?since=${encodeURIComponent(since)}`);
    expect(await replay.json()).toEqual([]);
  });
});
