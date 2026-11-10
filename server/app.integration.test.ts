import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import type { AppDb } from "../db/client";
import { createServer } from "./app";
import { runMaintenance } from "./maintenance";
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
process.env.RATE_PING_MAX = "10000";
process.env.MAX_REQUESTS_PER_ENDPOINT = "200";
process.env.MAX_BODY_BYTES = "262144";

const rejected = [
  "person@gmail.com",
  "ashamah@mail.paloaltonetworks.com",
  "ashamah@paloaltonetworks.com.evil.com",
  "ashamah@paloaltonetworks.com.",
  "ashamah@paloaltonetworks.com+evil.com",
  "ashamah@p\u0430loaltonetworks.com",
];

describe("sign-in, sessions, and capture", () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const app = createServer({ db: db as unknown as AppDb });

  beforeAll(async () => {
    await applySqlMigrations(db as unknown as AppDb);
  });

  afterAll(async () => {
    await client.close();
  });

  it("rejects non-PAN addresses before creating a user", async () => {
    for (const email of rejected) {
      const response = await app.request("/api/auth/request", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.20",
        },
        body: JSON.stringify({ email }),
      });
      expect(response.status, email).toBe(400);
    }
    const rows = await db.select().from(schema.users);
    expect(rows).toHaveLength(0);
  });

  it("signs in a PAN address with a one-time code and an httpOnly cookie", async () => {
    const requested = await app.request("/api/auth/request", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.21",
      },
      body: JSON.stringify({ email: "Ashamah@PaloAltoNetworks.com" }),
    });
    expect(requested.status).toBe(200);
    const pending = await requested.json();
    expect(pending.devCode).toMatch(/^\d{8}$/);
    expect(await db.select().from(schema.users)).toHaveLength(0);

    const wrong = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "ashamah@paloaltonetworks.com",
        code: "00000000",
      }),
    });
    expect(wrong.status).toBe(401);

    const verified = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "ashamah@paloaltonetworks.com",
        code: pending.devCode,
      }),
    });
    expect(verified.status).toBe(200);
    const body = await verified.json();
    expect(body.token).toBeUndefined();
    expect(body.user.role).toBe("admin");
    expect(body.user.email).toBe("ashamah@paloaltonetworks.com");
    const cookie = verified.headers.get("set-cookie") ?? "";
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("path=/api");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie.toLowerCase()).not.toContain("secure");

    const reuse = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "ashamah@paloaltonetworks.com",
        code: pending.devCode,
      }),
    });
    expect(reuse.status).toBe(401);
  });

  it("does not put the code in the response when production mode is on", async () => {
    process.env.NODE_ENV = "production";
    try {
      const response = await app.request("/api/auth/request", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.22",
        },
        body: JSON.stringify({ email: "devnull@paloaltonetworks.com" }),
      });
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.devCode).toBeUndefined();
      expect(body.devToken).toBeUndefined();
    } finally {
      process.env.NODE_ENV = "test";
    }
  });

  it("captures a request, redacts secrets, and serves a mock without executable HTML", async () => {
    const cookie = await signIn(app, "ashamah@paloaltonetworks.com");
    const created = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "hooks", customPath: "hooks" }),
    });
    expect(created.status).toBe(200);
    const endpoint = await created.json();
    expect(endpoint.url).toBe("http://localhost:8080/catch/hooks");

    const unauthenticated = await app.request("/api/endpoints");
    expect(unauthenticated.status).toBe(401);

    const captured = await app.request("/catch/hooks", {
      method: "POST",
      headers: {
        authorization: "Bearer super-secret",
        "content-type": "application/json",
        "x-nf-client-connection-ip": "203.0.113.10",
      },
      body: JSON.stringify({ html: "<script>alert(1)</script>" }),
    });
    expect(captured.status).toBe(200);
    expect(captured.headers.get("content-type")).toContain("application/json");
    expect(captured.headers.get("content-security-policy")).toContain("sandbox");
    expect(captured.headers.get("set-cookie")).toBeNull();
    const capturedBody = await captured.json();
    expect(capturedBody.html).toBeUndefined();

    const list = await app.request("/api/requests", { headers: { cookie } });
    expect(list.headers.get("content-type")).toContain("application/json");
    expect(list.headers.get("x-content-type-options")).toBe("nosniff");
    const requests = await list.json();
    expect(requests[0].headers.authorization).toBe("[redacted]");
    expect(requests[0].body.html).toBe("<script>alert(1)</script>");
    expect(requests[0].ip).toBe("203.0.113.10");

    const mocked = await app.request(`/api/endpoints/${endpoint.id}/mock`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        statusCode: 201,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "stolen=1",
          "X-Demo": "ok",
        },
        body: "{\"ok\":true}",
        delay: 0,
      }),
    });
    expect(mocked.status).toBe(200);

    const replay = await app.request("/catch/hooks", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hello",
    });
    expect(replay.status).toBe(201);
    expect(await replay.text()).toBe("{\"ok\":true}");
    expect(replay.headers.get("set-cookie")).toBeNull();
    expect(replay.headers.get("x-demo")).toBe("ok");
    expect(replay.headers.get("content-security-policy")).toContain("sandbox");
  });

  it("hides one user's captures from another and blocks cross-site API calls", async () => {
    const owner = await signIn(app, "ashamah@paloaltonetworks.com");
    const other = await signIn(app, "teammate@paloaltonetworks.com");
    const otherUser = await (
      await app.request("/api/auth/user", { headers: { cookie: other } })
    ).json();
    expect(otherUser.role).toBe("user");

    const foreign = await app.request("/api/requests", { headers: { cookie: other } });
    expect(await foreign.json()).toEqual([]);

    const adminOnly = await app.request("/api/admin/users", {
      headers: { cookie: other },
    });
    expect(adminOnly.status).toBe(403);

    const blocked = await app.request("/api/endpoints", {
      method: "POST",
      headers: {
        cookie: owner,
        origin: "https://evil.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "nope" }),
    });
    expect(blocked.status).toBe(403);

    const users = await app.request("/api/admin/users", { headers: { cookie: owner } });
    expect(users.status).toBe(200);
    const listed = await users.json();
    const teammate = listed.find(
      (user: { email: string }) => user.email === "teammate@paloaltonetworks.com",
    );
    const disabled = await app.request(`/api/admin/users/${teammate.id}`, {
      method: "PATCH",
      headers: { cookie: owner, "content-type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    expect(disabled.status).toBe(200);
    const after = await app.request("/api/auth/user", { headers: { cookie: other } });
    expect(after.status).toBe(401);
  });

  it("caps stored requests and drops old ones", async () => {
    process.env.MAX_REQUESTS_PER_ENDPOINT = "2";
    const cookie = await signIn(app, "ashamah@paloaltonetworks.com");
    const created = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "cap", customPath: "capme" }),
    });
    const endpoint = await created.json();
    for (const body of ["one", "two", "three"]) {
      const response = await app.request("/catch/capme", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body,
      });
      expect(response.status).toBe(200);
    }
    const list = await app.request("/api/requests", { headers: { cookie } });
    const mine = (await list.json()).filter(
      (request: { endpoint: string }) => request.endpoint === "/catch/capme",
    );
    expect(mine).toHaveLength(2);

    const [owner] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "ashamah@paloaltonetworks.com"));
    await db.insert(schema.capturedRequests).values({
      method: "GET",
      path: "capme",
      headers: {},
      userId: owner.id,
      endpointId: endpoint.id,
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });
    await runMaintenance(db as unknown as AppDb);
    const old = await db
      .select()
      .from(schema.capturedRequests)
      .where(eq(schema.capturedRequests.endpointId, endpoint.id));
    expect(old.every((row) => row.createdAt.getTime() > Date.now() - 20 * 86400000)).toBe(
      true,
    );
    process.env.MAX_REQUESTS_PER_ENDPOINT = "200";
  });

  it("refuses oversized capture bodies", async () => {
    process.env.MAX_BODY_BYTES = "64";
    try {
      const response = await app.request("/catch/hooks", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "x".repeat(2000),
      });
      expect(response.status).toBe(413);
    } finally {
      process.env.MAX_BODY_BYTES = "262144";
    }
  });

  it("folds plus-addressed sign-in into one mailbox quota", async () => {
    process.env.RATE_AUTH_EMAIL_MAX = "2";
    try {
      const headers = {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.88",
      };
      const send = (email: string) =>
        app.request("/api/auth/request", {
          method: "POST",
          headers,
          body: JSON.stringify({ email }),
        });
      expect((await send("quota.box+a@paloaltonetworks.com")).status).toBe(200);
      expect((await send("quota.box+b@paloaltonetworks.com")).status).toBe(200);
      expect((await send("quota.box@paloaltonetworks.com")).status).toBe(429);
    } finally {
      process.env.RATE_AUTH_EMAIL_MAX = "10000";
    }
  });

  it("sets session cookie flags and blocks a cross-site mutation", async () => {
    const requested = await app.request("/api/auth/request", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.90",
      },
      body: JSON.stringify({ email: "cookie.flags@paloaltonetworks.com" }),
    });
    const pending = await requested.json();
    const verified = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "cookie.flags@paloaltonetworks.com", code: pending.devCode }),
    });
    const setCookie = verified.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\/api/i);
    expect(setCookie).toMatch(/Max-Age=/i);
    const cookie = setCookie.split(";")[0];
    const crossed = await app.request("/api/endpoints", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify({ name: "nope" }),
    });
    expect(crossed.status).toBe(403);
    const anonymous = await app.request("/api/admin/users");
    expect(anonymous.status).toBe(401);
    const ping = await app.request("/api/ping");
    expect(ping.headers.get("x-content-type-options")).toBe("nosniff");
    expect(ping.headers.get("referrer-policy")).toBe("no-referrer");
    expect(ping.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(ping.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("downloads catch HTML instead of rendering it", async () => {
    const cookie = await signIn(app, "html.guard@paloaltonetworks.com");
    const created = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "html", customPath: "htmlpage" }),
    });
    const endpoint = await created.json();
    await app.request(`/api/endpoints/${endpoint.id}/mock`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        statusCode: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": "inline" },
        body: "<html><script>alert(1)</script><h1>Sign in</h1></html>",
        delay: 0,
      }),
    });
    const page = await app.request("/catch/htmlpage");
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(page.headers.get("content-disposition")).toContain("attachment");
    expect(page.headers.get("content-security-policy")).toContain("sandbox");
    expect(page.headers.get("x-frame-options")).toBe("DENY");
    expect(await page.text()).toContain("<script>alert(1)</script>");
  });

  it("caps captured requests per user across mocks", async () => {
    process.env.MAX_REQUESTS_PER_USER = "2";
    try {
      const cookie = await signIn(app, "storage.cap@paloaltonetworks.com");
      const created = await app.request("/api/endpoints", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "store", customPath: "storecap" }),
      });
      expect(created.status).toBe(200);
      for (const body of ["one", "two", "three"]) {
        const response = await app.request("/catch/storecap", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body,
        });
        expect(response.status).toBe(200);
      }
      const list = await app.request("/api/requests", { headers: { cookie } });
      const rows = await list.json();
      expect(rows).toHaveLength(2);
    } finally {
      process.env.MAX_REQUESTS_PER_USER = "1000";
    }
  });

  it("rate limits sign-in requests", async () => {
    process.env.RATE_AUTH_EMAIL_MAX = "2";
    try {
      const headers = {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.77",
      };
      const body = JSON.stringify({ email: "rate.limit@paloaltonetworks.com" });
      expect((await app.request("/api/auth/request", { method: "POST", headers, body })).status).toBe(200);
      expect((await app.request("/api/auth/request", { method: "POST", headers, body })).status).toBe(200);
      expect((await app.request("/api/auth/request", { method: "POST", headers, body })).status).toBe(429);
    } finally {
      process.env.RATE_AUTH_EMAIL_MAX = "10000";
    }
  });
});

async function signIn(
  app: ReturnType<typeof createServer>,
  email: string,
): Promise<string> {
  const requested = await app.request("/api/auth/request", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `198.51.100.${email.length}`,
    },
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
