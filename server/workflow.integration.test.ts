import { PGlite } from "@electric-sql/pglite";
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
  "RATE_CATCH_IP_MAX",
  "RATE_CATCH_ENDPOINT_MAX",
]) {
  process.env[key] = "10000";
}

const YAML = `
name: HelloWorld
display: Hello World
script:
  commands:
    - name: hello-world
      description: GET /hello
      outputs:
        - contextPath: Hello.Message
          type: String
`;

describe("tokens, YAML import, and pytest export", () => {
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

  it("lets a personal token create a YAML mock and export fixtures, then dies when revoked", async () => {
    const created = await app.request("/api/tokens", {
      method: "POST",
      headers: { cookie, "content-type": "application/json", origin: "http://localhost:8080" },
      body: JSON.stringify({ name: "laptop" }),
    });
    expect(created.status).toBe(200);
    const issued = await created.json();
    expect(issued.token.startsWith("pp_")).toBe(true);
    expect(issued.prefix).toBe(issued.token.slice(0, 11));

    const minted = await app.request("/api/tokens", {
      method: "POST",
      headers: {
        authorization: `Bearer ${issued.token}`,
        "content-type": "application/json",
        origin: "http://localhost:8080",
      },
      body: JSON.stringify({ name: "stolen" }),
    });
    expect(minted.status).toBe(401);

    const imported = await app.request("/api/specs/import", {
      method: "POST",
      headers: {
        authorization: `Bearer ${issued.token}`,
        "content-type": "application/json",
        origin: "http://localhost:8080",
      },
      body: JSON.stringify({ kind: "spec", text: YAML }),
    });
    expect(imported.status).toBe(200);
    const spec = await imported.json();
    const endpoint = await app.request("/api/endpoints", {
      method: "POST",
      headers: {
        authorization: `Bearer ${issued.token}`,
        "content-type": "application/json",
        origin: "http://localhost:8080",
      },
      body: JSON.stringify({ name: "Hello", customPath: "yamldemo", mockSpec: spec.mockSpec }),
    });
    expect(endpoint.status).toBe(200);
    const saved = await endpoint.json();

    const exported = await app.request(`/api/endpoints/${saved.id}/export`, {
      headers: { authorization: `Bearer ${issued.token}`, origin: "http://localhost:8080" },
    });
    const files = await exported.json();
    expect(files.files["test_pan_parrot.py"]).toContain("requests_mock");
    expect(files.files["test_data.json"]).toContain("/hello");
    expect(JSON.stringify(files)).not.toContain(issued.token);

    const zip = await app.request(`/api/endpoints/${saved.id}/export?format=zip`, {
      headers: { authorization: `Bearer ${issued.token}`, origin: "http://localhost:8080" },
    });
    const bytes = new Uint8Array(await zip.arrayBuffer());
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);

    const revoked = await app.request(`/api/tokens/${issued.id}`, {
      method: "DELETE",
      headers: { cookie, origin: "http://localhost:8080" },
    });
    expect(revoked.status).toBe(200);
    const again = await app.request("/api/endpoints", {
      headers: { authorization: `Bearer ${issued.token}`, origin: "http://localhost:8080" },
    });
    expect(again.status).toBe(401);
    expect(await again.text()).not.toContain(issued.token);
  });
});
