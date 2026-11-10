import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import type { AppDb } from "../db/client";
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
  "RATE_API_TOKEN_MAX",
  "RATE_CATCH_IP_MAX",
  "RATE_CATCH_ENDPOINT_MAX",
]) {
  process.env[key] = "10000";
}

const YAML = `
name: HelloWorld
display: Hello World
commonfields:
  id: HelloWorld
configuration:
  - display: Server URL
    name: url
    type: 0
    required: true
  - display: Trust any certificate (not secure)
    name: insecure
    type: 8
    required: false
  - display: Use system proxy settings
    name: proxy
    type: 8
    required: false
script:
  commands:
    - name: hello-world
      description: GET /hello
      outputs:
        - contextPath: Hello.Message
          type: String
`;

describe("agent API", () => {
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
  });

  async function mint(scopes: string[], name = "agent") {
    const created = await app.request("/api/tokens", {
      method: "POST",
      headers: { cookie, "content-type": "application/json", origin: "http://localhost:8080" },
      body: JSON.stringify({ name, days: 90, scopes }),
    });
    expect(created.status).toBe(200);
    return created.json() as Promise<{ id: string; token: string; scopes: string[]; expires: string }>;
  }

  it("hides /api/v1 until a real token is presented", async () => {
    const hidden = await app.request("/api/v1/openapi.json");
    expect(hidden.status).toBe(404);
    expect(hidden.headers.get("content-type")).toContain("text/plain");
    expect(await hidden.text()).toBe("Not found");
    const forged = await app.request("/api/v1/presets", {
      headers: { authorization: `Bearer pp_${"a".repeat(43)}` },
    });
    expect(forged.status).toBe(404);
    expect(await forged.text()).toBe("Not found");
  });

  it("serves the OpenAPI document and a preset search to a read token", async () => {
    const issued = await mint(["mocks:read"], "reader");
    const spec = await app.request("/api/v1/openapi.json", {
      headers: { authorization: `Bearer ${issued.token}` },
    });
    expect(spec.status).toBe(200);
    expect((await spec.json()).openapi).toBe("3.0.3");
    const presets = await app.request("/api/v1/presets?q=github", {
      headers: { authorization: `Bearer ${issued.token}` },
    });
    expect(presets.status).toBe(200);
    const body = await presets.json();
    expect(body.presets.some((row: { id: string }) => row.id.includes("github"))).toBe(true);
    const github = body.presets.find((row: { id: string }) => row.id === "github-github");
    expect(github.commandCoverage).toMatchObject({ vendor: 33, approximate: 0, missing: 64, total: 97 });
    const denied = await app.request("/api/v1/mocks", {
      method: "POST",
      headers: { authorization: `Bearer ${issued.token}`, "content-type": "application/json" },
      body: JSON.stringify({ name: "Nope", yaml: YAML, integrationId: "HelloWorld", version: "1" }),
    });
    expect(denied.status).toBe(403);
  });

  it("upserts a YAML mock, returns instance config, and dies when revoked or the user is disabled", async () => {
    const issued = await mint(["mocks:read", "mocks:write"], "writer");
    const first = await app.request("/api/v1/mocks", {
      method: "POST",
      headers: { authorization: `Bearer ${issued.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        yaml: YAML,
        integrationId: "HelloWorld",
        version: "1",
        testData: [{ name: "hello-world.json", text: JSON.stringify({ Hello: { Message: "hi" } }) }],
      }),
    });
    expect(first.status).toBe(201);
    const created = await first.json();
    expect(created.created).toBe(true);
    expect(created.url).toContain("/catch/");
    const second = await app.request("/api/v1/mocks", {
      method: "POST",
      headers: { authorization: `Bearer ${issued.token}`, "content-type": "application/json" },
      body: JSON.stringify({ yaml: YAML, integrationId: "HelloWorld", version: "1" }),
    });
    expect(second.status).toBe(200);
    const updated = await second.json();
    expect(updated.created).toBe(false);
    expect(updated.id).toBe(created.id);

    const config = await app.request(`/api/v1/mocks/${created.id}/instance-config`, {
      headers: { authorization: `Bearer ${issued.token}` },
    });
    expect(config.status).toBe(200);
    const guide = await config.json();
    expect(guide.baseUrl).toBe(created.url);
    const url = guide.params.find((param: { name: string }) => param.name === "url");
    const insecure = guide.params.find((param: { name: string }) => param.name === "insecure");
    const proxy = guide.params.find((param: { name: string }) => param.name === "proxy");
    expect(url.value).toBe(created.url);
    expect(url.type).toBe(0);
    expect(insecure.value).toBe(true);
    expect(proxy.value).toBe(false);

    const logs = await app.request(`/api/v1/mocks/${created.id}/logs`, {
      headers: { authorization: `Bearer ${issued.token}` },
    });
    expect(logs.status).toBe(200);
    expect(Array.isArray((await logs.json()).logs)).toBe(true);

    await db.update(schema.users).set({ active: false }).where(eq(schema.users.email, "ashamah@paloaltonetworks.com"));
    const disabled = await app.request("/api/v1/mocks", {
      headers: { authorization: `Bearer ${issued.token}` },
    });
    expect(disabled.status).toBe(404);
    await db.update(schema.users).set({ active: true }).where(eq(schema.users.email, "ashamah@paloaltonetworks.com"));

    const revoked = await app.request(`/api/tokens/${issued.id}`, {
      method: "DELETE",
      headers: { cookie, origin: "http://localhost:8080" },
    });
    expect(revoked.status).toBe(200);
    const after = await app.request("/api/v1/mocks", {
      headers: { authorization: `Bearer ${issued.token}` },
    });
    expect(after.status).toBe(404);
    expect(await after.text()).toBe("Not found");
  });

  it("lets an admin see and revoke every token", async () => {
    const issued = await mint(["mocks:read"], "borrowed");
    const list = await app.request("/api/admin/tokens", { headers: { cookie } });
    expect(list.status).toBe(200);
    const rows = await list.json();
    expect(rows.some((row: { id: string }) => row.id === issued.id)).toBe(true);
    const removed = await app.request(`/api/admin/tokens/${issued.id}`, { method: "DELETE", headers: { cookie } });
    expect(removed.status).toBe(200);
    const hidden = await app.request("/api/v1/presets", { headers: { authorization: `Bearer ${issued.token}` } });
    expect(hidden.status).toBe(404);
  });
});
