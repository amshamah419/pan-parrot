import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import type { AppDb } from "../db/client";
import { createServer } from "./app";
import { applySqlMigrations } from "./test/migrate";

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-session-secret-should-be-32b!!";
process.env.AUTH_DEV_EXPOSE_CODE = "true";
process.env.ADMIN_EMAILS = "ashamah@paloaltonetworks.com";
process.env.SITE_URL = "http://localhost:8080";
process.env.RESEND_API_KEY = "test-resend-key";
process.env.EMAIL_FROM = "notes@example.com";
process.env.RATE_FIRST_CATCH_EMAIL_MAX = "1";
for (const key of ["RATE_CATCH_IP_MAX", "RATE_CATCH_ENDPOINT_MAX", "RATE_CATCH_USER_MAX", "RATE_API_USER_MAX", "RATE_AUTH_IP_MAX", "RATE_AUTH_EMAIL_MAX", "RATE_AUTH_VERIFY_IP_MAX", "RATE_AUTH_VERIFY_EMAIL_MAX"]) {
  process.env[key] = "10000";
}

describe("first catch email", () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const app = createServer({ db: db as unknown as AppDb });
  const sent: Array<{ subject: string; text: string }> = [];
  const original = globalThis.fetch;

  beforeAll(async () => {
    await applySqlMigrations(db as unknown as AppDb);
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("api.resend.com")) {
        const body = JSON.parse(String(init?.body || "{}")) as { subject: string; text: string };
        sent.push(body);
        return new Response("{}", { status: 200 });
      }
      return original(input, init);
    }) as typeof fetch;
  });

  afterAll(async () => {
    globalThis.fetch = original;
    await client.close();
  });

  it("stays quiet until the owner opts in, sends once, and omits the request", async () => {
    const cookie = await signIn(app, "ashamah@paloaltonetworks.com");
    const created = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Quiet mock", customPath: "quietfirst" }),
    });
    const endpoint = await created.json();
    const secretBody = "TOP-SECRET-BODY";
    const quiet = await app.request("/catch/quietfirst", {
      method: "POST",
      headers: { "content-type": "application/json", "x-secret-header": "do-not-mail" },
      body: JSON.stringify({ body: secretBody }),
    });
    expect(quiet.status).toBe(200);
    expect(sent).toHaveLength(0);

    const enabled = await app.request(`/api/endpoints/${endpoint.id}/notify`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });
    expect(enabled.status).toBe(200);
    const again = await app.request("/catch/quietfirst", { method: "POST", body: secretBody });
    expect(again.status).toBe(200);
    expect(sent).toHaveLength(0);

    const second = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Noted mock", customPath: "notedfirst" }),
    });
    const noted = await second.json();
    await app.request(`/api/endpoints/${noted.id}/notify`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });
    const first = await app.request("/catch/notedfirst", {
      method: "POST",
      headers: { "x-request-header": "hide-me" },
      body: secretBody,
    });
    expect(first.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("Noted mock");
    expect(sent[0].text).toContain("Noted mock");
    expect(sent[0].text).toContain("/mock/");
    expect(sent[0].text).not.toContain(secretBody);
    expect(sent[0].text).not.toContain("hide-me");
    expect(sent[0].text).not.toContain("x-request-header");

    await app.request("/catch/notedfirst", { method: "POST", body: secretBody });
    expect(sent).toHaveLength(1);

    const third = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Limited mock", customPath: "limitedfirst" }),
    });
    const limited = await third.json();
    await app.request(`/api/endpoints/${limited.id}/notify`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });
    await app.request("/catch/limitedfirst");
    expect(sent).toHaveLength(1);
  });
});

async function signIn(app: ReturnType<typeof createServer>, email: string): Promise<string> {
  const requested = await app.request("/api/auth/request", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.40" },
    body: JSON.stringify({ email }),
  });
  const pending = await requested.json();
  const verified = await app.request("/api/auth/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code: pending.devCode }),
  });
  const cookie = verified.headers.get("set-cookie") || "";
  const match = cookie.match(/pp_session=[^;]+/);
  if (!match) throw new Error("sign-in failed");
  return match[0];
}
