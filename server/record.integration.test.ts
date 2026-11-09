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

describe("record route", () => {
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

  it("refuses a private URL and does not echo the credential", async () => {
    const secret = "Bearer super-secret-token-xyz";
    const response = await app.request("/api/record", {
      method: "POST",
      headers: { cookie, "content-type": "application/json", origin: "http://localhost:8080" },
      body: JSON.stringify({
        url: "https://127.0.0.1/latest/meta-data",
        method: "GET",
        headers: { Authorization: secret },
      }),
    });
    const text = await response.text();
    expect(response.status).toBe(400);
    expect(text).not.toContain("super-secret-token-xyz");
    expect(text).not.toContain("meta-data");
  });
});
