import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import type { AppDb } from "../db/client";
import { validateMockSpec } from "../shared/mock-spec";
import { createServer } from "./app";
import { applySqlMigrations } from "./test/migrate";
import { readZip } from "./pack";

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-session-secret-should-be-32b!!";
process.env.AUTH_DEV_EXPOSE_CODE = "true";
process.env.ADMIN_EMAILS = "ashamah@paloaltonetworks.com";
process.env.SITE_URL = "http://localhost:8080";
process.env.RATE_AUTH_IP_MAX = "10000";
process.env.RATE_AUTH_EMAIL_MAX = "10000";
process.env.RATE_AUTH_VERIFY_IP_MAX = "10000";
process.env.RATE_AUTH_VERIFY_EMAIL_MAX = "10000";
process.env.RATE_API_USER_MAX = "10000";
process.env.RATE_CATCH_IP_MAX = "10000";
process.env.RATE_CATCH_ENDPOINT_MAX = "10000";

describe("xml, zip, and mock credentials", () => {
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

  it("serves PAN-OS keygen, op, and log XML", async () => {
    const preset = JSON.parse(readFileSync("public/presets/integrations/pan-os-panorama.json", "utf8"));
    await create(app, cookie, "panos", preset.spec);
    const keygen = await app.request("/catch/panos/api?type=keygen&user=lab-admin&password=dummy-not-a-real-password");
    expect(keygen.status).toBe(200);
    expect(await keygen.text()).toContain("<key>dummy-panos-api-key</key>");
    const op = await app.request("/catch/panos/api?type=op&key=dummy-panos-api-key&cmd=%3Cshow%3E%3Csystem%3E%3Cinfo/%3E%3C/system%3E%3C/show%3E");
    const opBody = await op.text();
    expect(opBody).toContain('status="success"');
    expect(opBody).toContain("<hostname>firewall</hostname>");
    expect(opBody).toContain("<model>PA-3020</model>");
    const logs = await app.request("/catch/panos/api?type=log&action=get&job-id=1&nlogs=2&key=dummy-panos-api-key");
    const logBody = await logs.text();
    expect(logBody.match(/<entry /g)?.length).toBe(2);
    const denied = await app.request("/catch/panos/api?type=op");
    expect(denied.status).toBe(401);
  });

  it("serves a WildFire XML verdict only with the dummy key", async () => {
    const preset = JSON.parse(readFileSync("public/presets/integrations/palo-alto-networks-wildfire-palo-alto-networks-wildfire-v2.json", "utf8"));
    await create(app, cookie, "wildfire", preset.spec);
    const missing = await app.request("/catch/wildfire/publicapi/get/verdict", { method: "POST" });
    expect(missing.status).toBe(401);
    const verdict = await app.request("/catch/wildfire/publicapi/get/verdict", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "apikey=dummy-wildfire-key&hash=abc",
    });
    expect(await verdict.text()).toContain("<verdict>");
  });

  it("returns a Mimecast zip and pages with mc-siem-token", async () => {
    const preset = JSON.parse(readFileSync("public/presets/integrations/mimecast-mimecastv2.json", "utf8"));
    await create(app, cookie, "mimecast", preset.spec);
    const headers = {
      authorization: "MC dummy",
      "x-mc-date": "Mon, 09 Nov 2026 00:00:00 UTC",
      "x-mc-req-id": "8578FCFC-A305-4D9A-99CB-F4D5ECEFE297",
      "x-mc-app-id": "dummy-app",
      "content-type": "application/json",
    };
    const first = await app.request("/catch/mimecast/api/audit/get-siem-logs", {
      method: "POST",
      headers,
      body: JSON.stringify({ data: [{ type: "MTA" }] }),
    });
    expect(first.status).toBe(200);
    expect(first.headers.get("content-disposition")).toContain("siem.zip");
    const token = first.headers.get("mc-siem-token");
    expect(token).toBeTruthy();
    const zip = Buffer.from(await first.arrayBuffer());
    const entry = readZip(zip)[0];
    const parsed = JSON.parse(entry.data.toString()) as { type: string; data: unknown[] };
    expect(parsed.type).toBe("MTA");
    expect(parsed.data.length).toBeGreaterThan(0);
    const second = await app.request("/catch/mimecast/api/audit/get-siem-logs", {
      method: "POST",
      headers,
      body: JSON.stringify({ data: [{ type: "MTA", token }] }),
    });
    expect(second.headers.get("mc-siem-token")).not.toBe(token);
  });

  it("rejects an XML DTD and redacts the PAN-OS key in the log", async () => {
    const attack = await app.request("/catch/panos/api?type=op&key=dummy-panos-api-key", {
      method: "POST",
      headers: { "content-type": "text/xml" },
      body: `<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>`,
    });
    expect(attack.status).toBe(400);
    const list = await app.request("/api/requests", { headers: { cookie } });
    const rows = await list.json();
    const logged = rows.find((row: { query?: Record<string, string> }) => row.query?.key === "[redacted]");
    expect(logged).toBeTruthy();
  });
});

async function create(app: ReturnType<typeof createServer>, cookie: string, path: string, mockSpec: unknown) {
  validateMockSpec(mockSpec);
  const created = await app.request("/api/endpoints", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ name: path, customPath: path, mockSpec }),
  });
  expect(created.status).toBe(200);
}
