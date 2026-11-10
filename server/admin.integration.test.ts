import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import type { AppDb } from "../db/client";
import { SIGN_IN_MESSAGE } from "./auth";
import { createServer } from "./app";
import { bootstrapAdminEmails } from "./config";
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
process.env.RATE_CATCH_USER_MAX = "10000";

describe("admin health, people, and invites", () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const app = createServer({ db: db as unknown as AppDb });

  beforeAll(async () => {
    await applySqlMigrations(db as unknown as AppDb);
  });

  afterAll(async () => {
    await client.close();
  });

  it("keeps ashamah an admin when ADMIN_EMAILS is unset or lists someone else", () => {
    const previous = process.env.ADMIN_EMAILS;
    try {
      delete process.env.ADMIN_EMAILS;
      expect([...bootstrapAdminEmails()]).toEqual(["ashamah@paloaltonetworks.com"]);
      process.env.ADMIN_EMAILS = "other.admin@paloaltonetworks.com";
      expect(bootstrapAdminEmails().has("ashamah@paloaltonetworks.com")).toBe(true);
      expect(bootstrapAdminEmails().has("other.admin@paloaltonetworks.com")).toBe(true);
    } finally {
      process.env.ADMIN_EMAILS = previous;
    }
  });

  it("refuses to demote or delete the founding admin, and can promote someone else", async () => {
    const admin = await signIn(app, "ashamah@paloaltonetworks.com");
    const teammate = await signIn(app, "lab.admin.teammate@paloaltonetworks.com");
    const listed = await (await app.request("/api/admin/users?q=lab.admin", { headers: { cookie: admin } })).json();
    const person = listed.find((user: { email: string }) => user.email.startsWith("lab.admin"));
    const founder = (await (await app.request("/api/admin/users?q=ashamah", { headers: { cookie: admin } })).json())
      .find((user: { email: string }) => user.email === "ashamah@paloaltonetworks.com");
    expect(founder.permanentAdmin).toBe(true);
    expect(listed.some((user: { email: string }) => user.email === "ashamah@paloaltonetworks.com")).toBe(false);

    const demote = await app.request(`/api/admin/users/${founder.id}`, {
      method: "PATCH",
      headers: { cookie: admin, "content-type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    });
    expect(demote.status).toBe(400);

    const promoted = await app.request(`/api/admin/users/${person.id}`, {
      method: "PATCH",
      headers: { cookie: admin, "content-type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });
    expect(promoted.status).toBe(200);

    const removed = await app.request(`/api/admin/users/${founder.id}`, {
      method: "DELETE",
      headers: { cookie: admin },
    });
    expect(removed.status).toBe(400);

    const revoked = await app.request(`/api/admin/users/${person.id}/sessions/revoke`, {
      method: "POST",
      headers: { cookie: admin },
    });
    expect(revoked.status).toBe(200);
    expect((await app.request("/api/auth/user", { headers: { cookie: teammate } })).status).toBe(401);
  });

  it("suspends a user, blocks their catch URL, and disables a mock", async () => {
    const admin = await signIn(app, "ashamah@paloaltonetworks.com");
    const ownerCookie = await signIn(app, "catch.owner@paloaltonetworks.com");
    const created = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie: ownerCookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Lab hook", customPath: "labhook1" }),
    });
    const endpoint = await created.json();
    expect((await app.request("/catch/labhook1")).status).toBe(200);

    const people = await (await app.request("/api/admin/users?q=catch.owner", { headers: { cookie: admin } })).json();
    const owner = people[0];
    const suspended = await app.request(`/api/admin/users/${owner.id}`, {
      method: "PATCH",
      headers: { cookie: admin, "content-type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    expect(suspended.status).toBe(200);
    expect((await app.request("/catch/labhook1")).status).toBe(403);
    expect((await app.request("/api/auth/user", { headers: { cookie: ownerCookie } })).status).toBe(401);

    await app.request(`/api/admin/users/${owner.id}`, {
      method: "PATCH",
      headers: { cookie: admin, "content-type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    const disabled = await app.request(`/api/admin/mocks/${endpoint.id}`, {
      method: "PATCH",
      headers: { cookie: admin, "content-type": "application/json" },
      body: JSON.stringify({ disabled: true }),
    });
    expect(disabled.status).toBe(200);
    expect((await app.request("/catch/labhook1")).status).toBe(403);
    await app.request(`/api/admin/mocks/${endpoint.id}/purge`, { method: "POST", headers: { cookie: admin } });
    await app.request(`/api/admin/mocks/${endpoint.id}`, {
      method: "PATCH",
      headers: { cookie: admin, "content-type": "application/json" },
      body: JSON.stringify({ disabled: false }),
    });
    expect((await app.request("/catch/labhook1")).status).toBe(200);

    const health = await app.request("/api/admin/health", { headers: { cookie: admin } });
    expect(health.status).toBe(200);
    const body = await health.json();
    expect(body.functions.database).toBe("up");
    expect(body.functions.api).toBe("up");
    expect(body.windows.d7.requests).toBeGreaterThan(0);
    expect(body.version).toBeTruthy();
    expect(body.commit).toBeTruthy();
  });

  it("invites only PAN addresses, expires in the list, and can require an invite", async () => {
    const admin = await signIn(app, "ashamah@paloaltonetworks.com");
    const rejected = await app.request("/api/admin/invites", {
      method: "POST",
      headers: { cookie: admin, "content-type": "application/json" },
      body: JSON.stringify({ emails: ["person@gmail.com", "ok.person@paloaltonetworks.com"] }),
    });
    expect(rejected.status).toBe(400);

    const sent = await app.request("/api/admin/invites", {
      method: "POST",
      headers: { cookie: admin, "content-type": "application/json" },
      body: JSON.stringify({ emails: ["invited.one@paloaltonetworks.com", "invited.two@paloaltonetworks.com"] }),
    });
    expect(sent.status).toBe(200);
    const payload = await sent.json();
    expect(payload.devLinks).toHaveLength(2);

    const turnedOn = await app.request("/api/admin/invites/settings", {
      method: "PUT",
      headers: { cookie: admin, "content-type": "application/json" },
      body: JSON.stringify({ inviteOnly: true }),
    });
    expect(turnedOn.status).toBe(200);
    const stranger = await app.request("/api/auth/request", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.50" },
      body: JSON.stringify({ email: "stranger.invite@paloaltonetworks.com" }),
    });
    expect(stranger.status).toBe(200);
    const strangerBody = await stranger.json();
    expect(strangerBody.message).toBe(SIGN_IN_MESSAGE);
    expect(strangerBody.devCode).toBeUndefined();
    const founder = await app.request("/api/auth/request", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.51" },
      body: JSON.stringify({ email: "ashamah@paloaltonetworks.com" }),
    });
    expect(founder.status).toBe(200);
    const founderBody = await founder.json();
    expect(founderBody.message).toBe(strangerBody.message);
    expect(founderBody.devCode).toMatch(/^\d{8}$/);

    const link = new URL(payload.devLinks[0].url);
    const accepted = await app.request("/api/auth/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: link.searchParams.get("invite") }),
    });
    expect(accepted.status).toBe(200);
    expect((await accepted.json()).user.email).toBe("invited.one@paloaltonetworks.com");

    const list = await (await app.request("/api/admin/invites", { headers: { cookie: admin } })).json();
    const second = list.invites.find((invite: { email: string }) => invite.email === "invited.two@paloaltonetworks.com");
    await db.update(schema.invites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.invites.id, second.id));
    const after = await (await app.request("/api/admin/invites", { headers: { cookie: admin } })).json();
    expect(after.invites.find((invite: { id: string }) => invite.id === second.id).status).toBe("expired");
    const resent = await app.request(`/api/admin/invites/${second.id}/resend`, {
      method: "POST",
      headers: { cookie: admin },
    });
    expect(resent.status).toBe(200);
    const revoked = await app.request(`/api/admin/invites/${second.id}/revoke`, {
      method: "POST",
      headers: { cookie: admin },
    });
    expect(revoked.status).toBe(200);

    await app.request("/api/admin/invites/settings", {
      method: "PUT",
      headers: { cookie: admin, "content-type": "application/json" },
      body: JSON.stringify({ inviteOnly: false }),
    });
    const audit = await (await app.request("/api/admin/audit", { headers: { cookie: admin } })).json();
    const actions = audit.map((event: { action: string }) => event.action);
    expect(actions).toContain("invite");
    expect(actions).toContain("invite-only");
    expect(actions).toContain("suspend");
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
  if (!cookie) throw new Error(`sign-in failed for ${email}: ${verified.status} ${JSON.stringify(pending)}`);
  return cookie.split(";")[0];
}
