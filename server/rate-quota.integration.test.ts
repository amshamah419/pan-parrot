import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import type { AppDb } from "../db/client";
import { validateMockSpec } from "../shared/mock-spec";
import { createServer } from "./app";
import { applySqlMigrations } from "./test/migrate";

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

const spec = validateMockSpec({
  version: 1,
  source: { name: "Backoff" },
  totalRecords: 4,
  rateLimit: { enabled: true, limit: 2, windowSeconds: 60, retryAfterSeconds: 3 },
  operations: [
    {
      id: "list",
      method: "GET",
      pathTemplate: "/incidents",
      list: true,
      record: { name: "incident", kind: "object", children: [{ name: "id", kind: "id" }] },
    },
  ],
});

describe("fetch backoff on the catch URL", () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const app = createServer({ db: db as unknown as AppDb });

  beforeAll(async () => {
    await applySqlMigrations(db as unknown as AppDb);
    const requested = await app.request("/api/auth/request", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.77" },
      body: JSON.stringify({ email: "ashamah@paloaltonetworks.com" }),
    });
    const pending = await requested.json();
    const verified = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ashamah@paloaltonetworks.com", code: pending.devCode }),
    });
    const cookie = (verified.headers.get("set-cookie") || "").split(";")[0];
    const created = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Backoff", customPath: "backoff", mockSpec: spec }),
    });
    expect(created.status).toBe(200);
  });

  afterAll(async () => {
    await client.close();
  });

  it("returns 429 with Retry-After and X-RateLimit headers after N calls", async () => {
    const first = await app.request("/catch/backoff/incidents?limit=1");
    const second = await app.request("/catch/backoff/incidents?limit=1");
    const third = await app.request("/catch/backoff/incidents?limit=1");
    expect(first.status).toBe(200);
    expect(first.headers.get("x-ratelimit-limit")).toBe("2");
    expect(first.headers.get("x-ratelimit-remaining")).toBe("1");
    expect(Number(first.headers.get("x-ratelimit-reset"))).toBeGreaterThan(1_700_000_000);
    expect(second.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(third.status).toBe(429);
    expect(third.headers.get("retry-after")).toBe("3");
    expect(third.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(await third.json()).toEqual({ error: "Too Many Requests", status: 429 });
  });
});
