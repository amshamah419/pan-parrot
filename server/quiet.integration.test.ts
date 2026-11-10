import { count } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import type { AppDb } from "../db/client";
import { SIGN_IN_MESSAGE } from "./auth";
import { verifyGate } from "../shared/gate-cookie";
import { createServer } from "./app";
import { randomPath } from "./data";
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
  "RATE_CATCH_USER_MAX",
  "RATE_PING_MAX",
]) {
  process.env[key] = "10000";
}

describe("quiet public surface", () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const app = createServer({ db: db as unknown as AppDb });

  beforeAll(async () => {
    await applySqlMigrations(db as unknown as AppDb);
  });

  afterAll(async () => {
    await client.close();
  });

  it("gives the same sign-in response for an allowed and a rejected address", async () => {
    const headers = { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" };
    const allowed = await app.request("/api/auth/request", {
      method: "POST",
      headers,
      body: JSON.stringify({ email: "quiet.allowed@paloaltonetworks.com" }),
    });
    const rejected = await app.request("/api/auth/request", {
      method: "POST",
      headers: { ...headers, "x-forwarded-for": "203.0.113.11" },
      body: JSON.stringify({ email: "person@gmail.com" }),
    });
    expect(allowed.status).toBe(200);
    expect(rejected.status).toBe(200);
    const allowedBody = await allowed.json();
    const rejectedBody = await rejected.json();
    expect(allowedBody.message).toBe(SIGN_IN_MESSAGE);
    expect(rejectedBody.message).toBe(SIGN_IN_MESSAGE);
    expect(rejectedBody.devCode).toBeUndefined();
    expect(allowedBody.devCode).toMatch(/^\d{8}$/);
    const people = await db.select().from(schema.users);
    expect(people).toHaveLength(0);
  });

  it("locks an IP out after repeated failures", async () => {
    const ip = "203.0.113.40";
    const headers = { "content-type": "application/json", "x-forwarded-for": ip };
    await app.request("/api/auth/request", {
      method: "POST",
      headers,
      body: JSON.stringify({ email: "lockout@paloaltonetworks.com" }),
    });
    for (let i = 0; i < 5; i += 1) {
      const response = await app.request("/api/auth/verify", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: "lockout@paloaltonetworks.com", code: "00000000" }),
      });
      expect(response.status).toBe(401);
    }
    const locked = await app.request("/api/auth/request", {
      method: "POST",
      headers,
      body: JSON.stringify({ email: "someone.else@paloaltonetworks.com" }),
    });
    expect(locked.status).toBe(429);
  });

  it("mints 128-bit catch ids and hides a locked mock behind the same 404", async () => {
    expect(randomPath()).toHaveLength(22);
    const cookie = await signIn(app, "ashamah@paloaltonetworks.com");
    const created = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Quiet", customPath: "quietpath" }),
    });
    const endpoint = await created.json();
    expect(endpoint.path).toBe("quietpath");
    const locked = await app.request(`/api/endpoints/${endpoint.id}/lock`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ enabled: true, cidrs: "198.51.100.0/24" }),
    });
    const lock = await locked.json();
    expect(lock.lockToken).toBeTruthy();

    const before = await db.select({ value: count() }).from(schema.capturedRequests);
    const missing = await app.request("/catch/not-a-real-catch-id");
    const denied = await app.request("/catch/quietpath");
    const wrongNet = await app.request("/catch/quietpath", { headers: { "x-pan-parrot-lock": lock.lockToken, "x-forwarded-for": "203.0.113.9" } });
    expect(missing.status).toBe(404);
    expect(denied.status).toBe(404);
    expect(wrongNet.status).toBe(404);
    expect(await missing.json()).toEqual(await denied.json());
    const after = await db.select({ value: count() }).from(schema.capturedRequests);
    expect(Number(after[0]?.value ?? 0)).toBe(Number(before[0]?.value ?? 0));

    const opened = await app.request(`/catch/quietpath?lock=${encodeURIComponent(lock.lockToken)}`, {
      headers: { "x-forwarded-for": "198.51.100.8" },
    });
    expect(opened.status).toBe(200);

    await app.request("/api/admin/settings", {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ newMocksLocked: true }),
    });
    const fresh = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Locked by default" }),
    });
    const body = await fresh.json();
    expect(body.path).toHaveLength(22);
    expect(body.lockToken).toBeTruthy();
    expect(body.locked).toBe(true);
    await app.request("/api/admin/settings", {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ newMocksLocked: false }),
    });
  });

  it("hides admin from an address outside the allowlist and rejects scanner paths", async () => {
    const cookie = await signIn(app, "ashamah@paloaltonetworks.com");
    process.env.ADMIN_IP_ALLOWLIST = "198.51.100.50/32";
    try {
      const hidden = await app.request("/api/admin/health", {
        headers: { cookie, "x-forwarded-for": "203.0.113.77" },
      });
      expect(hidden.status).toBe(404);
      const hiddenInvites = await app.request("/api/admin/invites", {
        headers: { cookie, "x-forwarded-for": "203.0.113.77" },
      });
      expect(hiddenInvites.status).toBe(404);
      const allowed = await app.request("/api/admin/health", {
        headers: { cookie, "x-forwarded-for": "198.51.100.50" },
      });
      expect(allowed.status).toBe(200);
      const health = await allowed.json();
      expect(health.functions.database).toBe("up");
    } finally {
      delete process.env.ADMIN_IP_ALLOWLIST;
    }
    const scanner = await app.request("/.env", { headers: { "user-agent": "sqlmap" } });
    expect(scanner.status).toBe(404);
    expect(scanner.headers.get("x-powered-by")).toBeNull();
    expect(scanner.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("lets an invite link through the gate with the same sign-in message", async () => {
    const admin = await signIn(app, "ashamah@paloaltonetworks.com");
    const sent = await app.request("/api/admin/invites", {
      method: "POST",
      headers: { cookie: admin, "content-type": "application/json", "x-forwarded-for": "198.51.100.80" },
      body: JSON.stringify({ emails: ["quiet.invitee@paloaltonetworks.com"] }),
    });
    expect(sent.status).toBe(200);
    const link = new URL((await sent.json()).devLinks[0].url);
    expect(link.pathname).toBe("/login");
    expect(link.searchParams.get("invite")).toBeTruthy();

    await app.request("/api/admin/invites/settings", {
      method: "PUT",
      headers: { cookie: admin, "content-type": "application/json" },
      body: JSON.stringify({ inviteOnly: true }),
    });
    const blocked = await app.request("/api/auth/request", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.81" },
      body: JSON.stringify({ email: "quiet.stranger@paloaltonetworks.com" }),
    });
    const invited = await app.request("/api/auth/request", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.82" },
      body: JSON.stringify({ email: "quiet.invitee@paloaltonetworks.com" }),
    });
    expect(blocked.status).toBe(200);
    expect(invited.status).toBe(200);
    const blockedBody = await blocked.json();
    const invitedBody = await invited.json();
    expect(blockedBody.message).toBe(SIGN_IN_MESSAGE);
    expect(invitedBody.message).toBe(SIGN_IN_MESSAGE);
    expect(blockedBody.devCode).toBeUndefined();
    expect(invitedBody.devCode).toMatch(/^\d{8}$/);

    const bad = await app.request("/api/auth/invite", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.83" },
      body: JSON.stringify({ token: "not-a-real-invite" }),
    });
    expect(bad.status).toBe(401);
    expect((await bad.json()).error).toBe("Invalid or expired code");

    const accepted = await app.request("/api/auth/invite", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.84" },
      body: JSON.stringify({ token: link.searchParams.get("invite") }),
    });
    expect(accepted.status).toBe(200);
    const cookies = accepted.headers.getSetCookie();
    const gate = cookies.find((item) => item.startsWith("pp_gate="));
    const session = cookies.find((item) => item.startsWith("pp_session="));
    expect(gate).toBeTruthy();
    expect(session).toBeTruthy();
    const gateValue = gate?.split(";")[0]?.slice("pp_gate=".length) ?? "";
    expect(await verifyGate(decodeURIComponent(gateValue), process.env.SESSION_SECRET || "")).toBe(true);
    const studio = await app.request("/api/endpoints", {
      headers: { cookie: session?.split(";")[0] ?? "" },
    });
    expect(studio.status).toBe(200);
    await app.request("/api/admin/invites/settings", {
      method: "PUT",
      headers: { cookie: admin, "content-type": "application/json" },
      body: JSON.stringify({ inviteOnly: false }),
    });
  });

  it("asks for a captcha without saying whether the address is allowed", async () => {
    process.env.CAPTCHA_PROVIDER = "turnstile";
    process.env.CAPTCHA_SITE_KEY = "site-key";
    process.env.CAPTCHA_SECRET_KEY = "secret";
    process.env.CAPTCHA_ALWAYS = "true";
    try {
      const response = await app.request("/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.70" },
        body: JSON.stringify({ email: "person@gmail.com" }),
      });
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.message).toBe(SIGN_IN_MESSAGE);
      expect(body.captchaRequired).toBe(true);
      expect(body.captchaProvider).toBe("turnstile");
      expect(body.devCode).toBeUndefined();
    } finally {
      delete process.env.CAPTCHA_PROVIDER;
      delete process.env.CAPTCHA_SITE_KEY;
      delete process.env.CAPTCHA_SECRET_KEY;
      delete process.env.CAPTCHA_ALWAYS;
    }
  });
});

async function signIn(app: ReturnType<typeof createServer>, email: string): Promise<string> {
  const requested = await app.request("/api/auth/request", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${email.length % 200}` },
    body: JSON.stringify({ email }),
  });
  const pending = await requested.json();
  const verified = await app.request("/api/auth/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, code: pending.devCode }),
  });
  const cookie = verified.headers.get("set-cookie") ?? "";
  if (!cookie.includes("pp_session")) throw new Error(`sign-in failed ${verified.status}`);
  const match = cookie.match(/pp_session=[^;]+/);
  return match ? match[0] : cookie.split(";")[0];
}
