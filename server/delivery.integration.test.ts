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

const operation = {
  id: "rows",
  method: "GET",
  pathTemplate: "/rows",
  status: 200,
  contentType: "application/json",
  list: true,
  envelope: { type: "array" },
  record: { name: "row", kind: "object", children: [{ name: "id", kind: "const", constValue: "row" }] },
};

function mockSpec(extra: Record<string, unknown>) {
  return {
    version: 1,
    source: { kind: "manual", name: "Delivery" },
    operations: [{ ...operation, ...extra }],
    chaos: { enabled: false },
    totalRecords: 3,
  };
}

describe("catch URL streams and ranges", () => {
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

  it("returns chunked NDJSON and a 206 for one byte range", async () => {
    const stream = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json", origin: "http://localhost:8080" },
      body: JSON.stringify({ name: "Stream", customPath: "streamdemo", mockSpec: mockSpec({ stream: true }) }),
    });
    expect(stream.status).toBe(200);
    const streamed = await app.request("/catch/streamdemo/rows?limit=2");
    expect(streamed.headers.get("content-type")).toContain("ndjson");
    const lines = (await streamed.text()).split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(1);
    expect(() => JSON.parse(lines[0])).not.toThrow();

    const file = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json", origin: "http://localhost:8080" },
      body: JSON.stringify({ name: "File", customPath: "filedemo", mockSpec: mockSpec({ downloadBytes: 400 }) }),
    });
    expect(file.status).toBe(200);
    const full = await app.request("/catch/filedemo/rows");
    const fullBytes = new Uint8Array(await full.arrayBuffer());
    expect(fullBytes.byteLength).toBe(400);
    expect(full.headers.get("accept-ranges")).toBe("bytes");
    const part = await app.request("/catch/filedemo/rows", { headers: { range: "bytes=0-3" } });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 0-3/400");
    expect((await part.arrayBuffer()).byteLength).toBe(4);
    const bad = await app.request("/catch/filedemo/rows", { headers: { range: "bytes=0-1,2-3" } });
    expect(bad.status).toBe(416);
  });
});
