import { createHash } from "node:crypto";
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

  it("serves the CLI wheel to a session or a token and stays quiet otherwise", async () => {
    const hidden = await app.request("/api/v1/cli");
    expect(hidden.status).toBe(404);
    expect(await hidden.text()).toBe("Not found");
    const presets = await app.request("/api/v1/presets", { headers: { cookie } });
    expect(presets.status).toBe(404);
    expect(await presets.text()).toBe("Not found");

    const session = await app.request("/api/v1/cli", { headers: { cookie } });
    expect(session.status).toBe(200);
    const meta = await session.json();
    expect(meta.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(meta.filename).toBe(`panparrot-${meta.version}-py3-none-any.whl`);

    const issued = await mint(["mocks:read"], "cli-wheel");
    const basic = Buffer.from(`${issued.token}:`).toString("base64");
    const downloaded = await app.request(`/api/v1/cli/${meta.filename}`, {
      headers: { authorization: `Basic ${basic}` },
    });
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get("cache-control")).toContain("no-store");
    expect(downloaded.headers.get("content-disposition")).toContain(meta.filename);
    const bytes = Buffer.from(await downloaded.arrayBuffer());
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
    expect(createHash("sha256").update(new Uint8Array(bytes)).digest("hex")).toBe(meta.sha256);

    const wrong = await app.request("/api/v1/cli/panparrot-9.9.9-py3-none-any.whl", {
      headers: { authorization: `Bearer ${issued.token}` },
    });
    expect(wrong.status).toBe(404);
    expect(await wrong.text()).toBe("Not found");
    const revoked = await app.request(`/api/tokens/${issued.id}`, {
      method: "DELETE",
      headers: { cookie, origin: "http://localhost:8080" },
    });
    expect(revoked.status).toBe(200);
  });

  it("lets an install link download the wheel and nothing else", async () => {
    const ids: string[] = [];
    try {
      const download = await app.request("/api/tokens", {
        method: "POST",
        headers: { cookie, "content-type": "application/json", origin: "http://localhost:8080" },
        body: JSON.stringify({ name: "CLI install", scopes: ["cli:download"] }),
      });
      expect(download.status).toBe(200);
      const issued = await download.json();
      ids.push(issued.id);
      expect(issued.scopes).toEqual(["cli:download"]);
      const ttl = new Date(issued.expires).getTime() - Date.now();
      expect(ttl).toBeGreaterThan(50 * 60 * 1000);
      expect(ttl).toBeLessThan(70 * 60 * 1000);

      const basic = Buffer.from(`${issued.token}:`).toString("base64");
      const wheel = await app.request("/api/v1/cli/panparrot-0.1.0-py3-none-any.whl", {
        headers: { authorization: `Basic ${basic}` },
      });
      expect(wheel.status).toBe(200);
      const mocks = await app.request("/api/v1/mocks", { headers: { authorization: `Bearer ${issued.token}` } });
      expect(mocks.status).toBe(403);
      const write = await app.request("/api/v1/mocks", {
        method: "POST",
        headers: { authorization: `Bearer ${issued.token}`, "content-type": "application/json" },
        body: JSON.stringify({ name: "Nope", yaml: "name: Nope\n", integrationId: "Nope", version: "1" }),
      });
      expect(write.status).toBe(403);

      const mixed = await app.request("/api/tokens", {
        method: "POST",
        headers: { cookie, "content-type": "application/json", origin: "http://localhost:8080" },
        body: JSON.stringify({ name: "mixed", scopes: ["cli:download", "mocks:write"] }),
      });
      expect(mixed.status).toBe(400);

      const reader = await mint(["mocks:read"], "still-reads");
      ids.push(reader.id);
      const presets = await app.request("/api/v1/presets?q=github", { headers: { authorization: `Bearer ${reader.token}` } });
      expect(presets.status).toBe(200);
      const withFullToken = await app.request("/api/v1/cli/panparrot-0.1.0-py3-none-any.whl", {
        headers: { authorization: `Bearer ${reader.token}` },
      });
      expect(withFullToken.status).toBe(200);
      for (let index = 0; index < 4; index += 1) {
        const filler = await mint(["mocks:read"], `fill-${index}`);
        ids.push(filler.id);
      }
      const blocked = await app.request("/api/tokens", {
        method: "POST",
        headers: { cookie, "content-type": "application/json", origin: "http://localhost:8080" },
        body: JSON.stringify({ name: "sixth", scopes: ["mocks:read"] }),
      });
      expect(blocked.status).toBe(400);
      const another = await app.request("/api/tokens", {
        method: "POST",
        headers: { cookie, "content-type": "application/json", origin: "http://localhost:8080" },
        body: JSON.stringify({ name: "CLI install", scopes: ["cli:download"] }),
      });
      expect(another.status).toBe(200);
      const second = await another.json();
      ids.push(second.id);
      const secondWheel = await app.request("/api/v1/cli", { headers: { authorization: `Bearer ${second.token}` } });
      expect(secondWheel.status).toBe(200);

      const listed = await app.request("/api/tokens", { headers: { cookie } });
      const rows = (await listed.json()) as Array<{ id: string; scopes: string[] }>;
      const mockCount = rows.filter((row) => !row.scopes.includes("cli:download")).length;
      expect(mockCount).toBeLessThanOrEqual(5);

      await db.update(schema.apiTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.apiTokens.id, issued.id));
      const expired = await app.request("/api/v1/cli", { headers: { authorization: `Bearer ${issued.token}` } });
      expect(expired.status).toBe(404);
      expect(await expired.text()).toBe("Not found");
    } finally {
      for (const id of ids) {
        await app.request(`/api/tokens/${id}`, { method: "DELETE", headers: { cookie, origin: "http://localhost:8080" } });
      }
    }
  });

  it("scores a local integration YAML command by command", async () => {
    const issued = await mint(["mocks:read"], "coverage");
    const response = await app.request("/api/v1/coverage", {
      method: "POST",
      headers: { authorization: `Bearer ${issued.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        yaml: `
name: GitHub
commonfields:
  id: GitHub
script:
  commands:
    - name: GitHub-get-branch
    - name: GitHub-create-issue
    - name: GitHub-not-scored
`,
      }),
    });
    expect(response.status).toBe(200);
    const report = await response.json();
    expect(report.presetId).toBe("github-github");
    expect(report.commands).toEqual([
      { command: "GitHub-get-branch", status: "vendor" },
      { command: "GitHub-create-issue", status: "missing" },
      { command: "GitHub-not-scored", status: "missing" },
    ]);
    const hidden = await app.request("/api/v1/coverage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ yaml: "name: GitHub\n" }),
    });
    expect(hidden.status).toBe(404);
    expect(await hidden.text()).toBe("Not found");
    const revoked = await app.request(`/api/tokens/${issued.id}`, {
      method: "DELETE",
      headers: { cookie, origin: "http://localhost:8080" },
    });
    expect(revoked.status).toBe(200);
  });

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

  it("builds routes from the integration Python and returns instance params", async () => {
    const issued = await mint(["mocks:read", "mocks:write"], "from-integration");
    const created = await app.request("/api/v1/mocks", {
      method: "POST",
      headers: { authorization: `Bearer ${issued.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        yaml: YAML.replace("HelloWorld", "RouteWorld").replace("hello-world", "route-world"),
        clientSource: `
def route_world_command(client, args):
    return client.fetch()

class Client:
    def fetch(self):
        return self._http_request("GET", "/v1/routes/{id}")
`,
      }),
    });
    expect(created.status).toBe(201);
    const mock = await created.json();
    expect(mock.routes).toEqual([
      expect.objectContaining({ command: "route-world", method: "GET", path: "/v1/routes/{id}", pathFrom: "client" }),
    ]);
    const config = await app.request(`/api/v1/mocks/${mock.id}/instance-config`, {
      headers: { authorization: `Bearer ${issued.token}` },
    });
    expect(config.status).toBe(200);
    const guide = await config.json();
    expect(guide.baseUrl).toBe(mock.url);
    expect(guide.params.find((row: { name: string }) => row.name === "url").value).toBe(mock.url);
  });

  it("turns on a fetch window without replacing the routes", async () => {
    const issued = await mint(["mocks:read", "mocks:write"], "fetch-window");
    const created = await app.request("/api/v1/mocks", {
      method: "POST",
      headers: { authorization: `Bearer ${issued.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        yaml: YAML.replace("HelloWorld", "FetchWorld").replace("hello-world", "fetch-world"),
        integrationId: "FetchWorld",
        version: "1",
      }),
    });
    expect(created.status).toBe(201);
    const mock = await created.json();
    const turned = await app.request(`/api/v1/mocks/${mock.id}`, {
      method: "PUT",
      headers: { authorization: `Bearer ${issued.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        fetch: { enabled: true, windowSeconds: 60, perPoll: 2, sinceParam: "since" },
        reset: true,
      }),
    });
    expect(turned.status).toBe(200);
    const settings = await turned.json();
    expect(settings.fetch).toMatchObject({ enabled: true, windowSeconds: 60, perPoll: 2, dedup: true });
    expect(settings.reset).toBe(true);
    expect(settings.url).toBe(mock.url);

    const read = await app.request(`/api/v1/mocks/${mock.id}`, {
      headers: { authorization: `Bearer ${issued.token}` },
    });
    const spec = await read.json();
    expect(spec.spec.operations.some((operation: { pathTemplate: string }) => operation.pathTemplate === "/hello")).toBe(true);
    expect(spec.spec.behavior.fetch.enabled).toBe(true);

    const path = new URL(mock.url).pathname;
    const since = "2024-01-01T00:00:00Z";
    const first = await app.request(`${path}/hello?since=${encodeURIComponent(since)}`);
    expect(first.status).toBe(200);
    expect(first.headers.get("x-pan-parrot-effects")).toContain("fetch-new");
    expect(await first.json()).toHaveLength(2);
    const replay = await app.request(`${path}/hello?since=${encodeURIComponent(since)}`);
    expect(replay.headers.get("x-pan-parrot-effects")).toContain("fetch-empty");
    expect(await replay.json()).toEqual([]);

    const rejected = await app.request(`/api/v1/mocks/${mock.id}`, {
      method: "PUT",
      headers: { authorization: `Bearer ${issued.token}`, "content-type": "application/json" },
      body: JSON.stringify({ fetch: { enabled: true, extra: true } }),
    });
    expect(rejected.status).toBe(400);
  });

  it("keeps a created record for get and delete without replacing routes", async () => {
    const issued = await mint(["mocks:read", "mocks:write"], "saved-records");
    const created = await app.request("/api/v1/mocks", {
      method: "POST",
      headers: { authorization: `Bearer ${issued.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        yaml: `
name: StateWorld
display: State World
commonfields:
  id: StateWorld
configuration:
  - display: Server URL
    name: url
    type: 0
    required: true
script:
  commands:
    - name: state-create
      description: POST /items
      outputs:
        - contextPath: Item.Name
          type: String
    - name: state-get
      description: GET /items/{id}
      outputs:
        - contextPath: Item.Name
          type: String
    - name: state-delete
      description: DELETE /items/{id}
      outputs:
        - contextPath: Item.Name
          type: String
`,
        integrationId: "StateWorld",
        version: "1",
      }),
    });
    expect(created.status).toBe(201);
    const mock = await created.json();
    const headers = { authorization: `Bearer ${issued.token}`, "content-type": "application/json" };
    const fetchOn = await app.request(`/api/v1/mocks/${mock.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ fetch: { enabled: true, windowSeconds: 60, perPoll: 1 } }),
    });
    expect(fetchOn.status).toBe(200);
    const turned = await app.request(`/api/v1/mocks/${mock.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ state: { enabled: true, idField: "id" }, reset: true }),
    });
    expect(turned.status).toBe(200);
    expect(await turned.json()).toMatchObject({ state: { enabled: true, idField: "id" }, reset: true, url: mock.url });

    const read = await app.request(`/api/v1/mocks/${mock.id}`, { headers: { authorization: `Bearer ${issued.token}` } });
    const spec = await read.json();
    expect(spec.spec.behavior.fetch.enabled).toBe(true);
    expect(spec.spec.behavior.state.enabled).toBe(true);
    expect(spec.spec.operations.map((operation: { method: string; pathTemplate: string }) => `${operation.method} ${operation.pathTemplate}`)).toEqual([
      "POST /items",
      "GET /items/{id}",
      "DELETE /items/{id}",
    ]);

    const path = new URL(mock.url).pathname;
    const posted = await app.request(`${path}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "lab" }),
    });
    expect(posted.status).toBe(201);
    expect(posted.headers.get("x-pan-parrot-effects")).toContain("state-created");
    const item = await posted.json();
    expect(item.id).toBeTruthy();
    expect(item.name).toBe("lab");

    const got = await app.request(`${path}/items/${item.id}`);
    expect(got.headers.get("x-pan-parrot-effects")).toContain("state-read");
    expect(await got.json()).toMatchObject({ id: item.id, name: "lab" });

    const removed = await app.request(`${path}/items/${item.id}`, { method: "DELETE" });
    expect(removed.status).toBe(200);
    expect(removed.headers.get("x-pan-parrot-effects")).toContain("state-deleted");
    const missing = await app.request(`${path}/items/${item.id}`);
    expect(missing.status).toBe(404);
    expect(missing.headers.get("x-pan-parrot-effects")).toContain("state-missing");

    const rejected = await app.request(`/api/v1/mocks/${mock.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ state: { enabled: true, extra: true } }),
    });
    expect(rejected.status).toBe(400);
    const revoked = await app.request(`/api/tokens/${issued.id}`, {
      method: "DELETE",
      headers: { cookie, origin: "http://localhost:8080" },
    });
    expect(revoked.status).toBe(200);
  });

  it("plays scenario steps in order and then loops", async () => {
    const issued = await mint(["mocks:read", "mocks:write"], "scenario");
    const created = await app.request("/api/v1/mocks", {
      method: "POST",
      headers: { authorization: `Bearer ${issued.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        yaml: YAML.replace(/HelloWorld/g, "ScenarioWorld").replace("hello-world", "scenario-world"),
        integrationId: "ScenarioWorld",
        version: "1",
      }),
    });
    expect(created.status).toBe(201);
    const mock = await created.json();
    const turned = await app.request(`/api/v1/mocks/${mock.id}`, {
      method: "PUT",
      headers: { authorization: `Bearer ${issued.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        scenario: {
          enabled: true,
          repeat: "loop",
          steps: [
            { status: 202, body: "{\"job\":\"pending\"}" },
            { status: 200, body: "{\"job\":\"done\"}" },
          ],
        },
        reset: true,
      }),
    });
    expect(turned.status).toBe(200);
    const settings = await turned.json();
    expect(settings.scenario.repeat).toBe("loop");
    expect(settings.scenario.steps).toHaveLength(2);
    expect(settings.reset).toBe(true);

    const path = new URL(mock.url).pathname;
    const statuses = [];
    for (const effect of ["scenario-1", "scenario-2", "scenario-1"]) {
      const response = await app.request(`${path}/hello`);
      statuses.push(response.status);
      expect(response.headers.get("x-pan-parrot-effects")).toContain(effect);
    }
    expect(statuses).toEqual([202, 200, 202]);
    expect(await (await app.request(`${path}/hello`)).json()).toEqual({ job: "done" });

    const rejected = await app.request(`/api/v1/mocks/${mock.id}`, {
      method: "PUT",
      headers: { authorization: `Bearer ${issued.token}`, "content-type": "application/json" },
      body: JSON.stringify({ scenario: { enabled: true, steps: [] } }),
    });
    expect(rejected.status).toBe(400);
    const revoked = await app.request(`/api/tokens/${issued.id}`, {
      method: "DELETE",
      headers: { cookie, origin: "http://localhost:8080" },
    });
    expect(revoked.status).toBe(200);
  });

  it("returns query and body on captured logs and leaves headers off", async () => {
    const issued = await mint(["mocks:read", "mocks:write"], "assert-logs");
    const created = await app.request("/api/v1/mocks", {
      method: "POST",
      headers: { authorization: `Bearer ${issued.token}`, "content-type": "application/json" },
      body: JSON.stringify({ preset: "github-github", name: "Assert logs" }),
    });
    expect(created.status).toBe(201);
    const mock = await created.json();
    const [owner] = await db.select().from(schema.users).limit(1);
    await db.insert(schema.capturedRequests).values({
      method: "GET",
      path: "catchpath/hello",
      status: 200,
      headers: { authorization: "Bearer secret" },
      query: { since: "2020-01-01T00:00:00Z" },
      body: { title: "lab" },
      userId: owner.id,
      endpointId: mock.id,
    });
    const logs = await app.request(`/api/v1/mocks/${mock.id}/logs?limit=200`, {
      headers: { authorization: `Bearer ${issued.token}` },
    });
    expect(logs.status).toBe(200);
    const row = (await logs.json()).logs[0];
    expect(row.query.since).toBe("2020-01-01T00:00:00Z");
    expect(row.body).toContain("lab");
    expect(row.headers).toBeUndefined();
    expect(JSON.stringify(row)).not.toContain("Bearer secret");
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
