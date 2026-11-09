import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import type { AppDb } from "../db/client";
import { createServer } from "./app";
import { runSmoke } from "./smoke";
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
  "RATE_PING_MAX",
]) {
  process.env[key] = "10000";
}

describe("deployed-site smoke checks", () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const app = createServer({ db: db as unknown as AppDb });

  beforeAll(async () => {
    await applySqlMigrations(db as unknown as AppDb);
  });

  function fetchImpl(): typeof fetch {
    return async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const path = `${new URL(url).pathname}${new URL(url).search}`;
      if (path === "/") {
        return new Response('<title>PAN Parrot</title><meta name="robots" content="noindex">Unofficial personal tool', { status: 200 });
      }
      if (path === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { status: 200 });
      return app.request(path, init);
    };
  }

  it("checks health, headers, the closed studio, and a rejected email", async () => {
    const report = await runSmoke("http://127.0.0.1:8080", { fetchImpl: fetchImpl() });
    const failed = report.checks.filter((check) => !check.ok);
    expect(failed, JSON.stringify(failed)).toEqual([]);
  });

  it("requires HSTS when the site URL is https", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ ok: true, database: "up" }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
          "x-content-type-options": "nosniff",
          "x-frame-options": "DENY",
          "cache-control": "no-store",
        },
      });
    const missing = await runSmoke("https://parrot.example", { fetchImpl });
    expect(missing.checks[0]?.detail).toBe("missing HSTS");
    const present = await runSmoke("https://parrot.example", {
      fetchImpl: async (input, init) => {
        const response = await fetchImpl(input, init);
        response.headers.set("strict-transport-security", "max-age=31536000");
        return response;
      },
    });
    expect(present.checks.find((check) => check.name === "health")?.ok).toBe(true);
  });

  it("creates and deletes a mock when a personal token is set", async () => {
    const cookie = await signIn(app, "ashamah@paloaltonetworks.com");
    const minted = await app.request("/api/tokens", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "smoke" }),
    });
    expect(minted.status).toBe(200);
    const token = (await minted.json()).token as string;
    const report = await runSmoke("http://127.0.0.1:8080", {
      token,
      fetchImpl: fetchImpl(),
    });
    const failed = report.checks.filter((check) => !check.ok);
    expect(failed, JSON.stringify(failed)).toEqual([]);
    const signals = await app.request("/api/admin/signals", { headers: { cookie } });
    expect(signals.status).toBe(200);
    const body = await signals.json();
    expect(body.database).toBe("up");
    expect(body.sessionSecret).toBe("ok");
    expect(body.devCodeExposed).toBe(true);
    expect(body.email).toBe("missing");
    const stranger = await signIn(app, "colleague@paloaltonetworks.com");
    const denied = await app.request("/api/admin/signals", { headers: { cookie: stranger } });
    expect(denied.status).toBe(403);
  });
});

async function signIn(app: ReturnType<typeof createServer>, email: string): Promise<string> {
  const requested = await app.request("/api/auth/request", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${email.length}` },
    body: JSON.stringify({ email }),
  });
  const pending = await requested.json();
  const verified = await app.request("/api/auth/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code: pending.devCode }),
  });
  const cookie = verified.headers.get("set-cookie") ?? "";
  if (!cookie) throw new Error(`sign-in failed for ${email}: ${verified.status}`);
  return cookie.split(";")[0];
}
