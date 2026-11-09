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

function spec(value: string) {
  return {
    version: 1,
    source: { kind: "manual", name: "Shared" },
    operations: [
      {
        id: "rows",
        method: "GET",
        pathTemplate: "/rows",
        status: 200,
        contentType: "application/json",
        list: true,
        envelope: { type: "array" },
        record: { name: "row", kind: "object", children: [{ name: "id", kind: "const", constValue: value }] },
      },
    ],
    chaos: { enabled: false },
    totalRecords: 1,
  };
}

describe("sharing, catalog, versions, and purge", () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const app = createServer({ db: db as unknown as AppDb });
  let owner = "";
  let colleague = "";

  beforeAll(async () => {
    await applySqlMigrations(db as unknown as AppDb);
    owner = await signIn(app, "ashamah@paloaltonetworks.com");
    colleague = await signIn(app, "colleague@paloaltonetworks.com");
  });

  it("shares view then edit, reverts a save, publishes, clones, and purges captured data", async () => {
    const created = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie: owner, "content-type": "application/json" },
      body: JSON.stringify({ name: "Shared rows", customPath: "sharedrows", mockSpec: spec("one") }),
    });
    expect(created.status).toBe(200);
    const endpoint = await created.json();

    const hidden = await app.request(`/api/endpoints/${endpoint.id}`, { headers: { cookie: colleague } });
    expect(hidden.status).toBe(404);

    const badShare = await app.request(`/api/endpoints/${endpoint.id}/shares`, {
      method: "POST",
      headers: { cookie: owner, "content-type": "application/json" },
      body: JSON.stringify({ email: "person@gmail.com", role: "view" }),
    });
    expect(badShare.status).toBe(400);

    const shared = await app.request(`/api/endpoints/${endpoint.id}/shares`, {
      method: "POST",
      headers: { cookie: owner, "content-type": "application/json" },
      body: JSON.stringify({ email: "colleague@paloaltonetworks.com", role: "view" }),
    });
    expect(shared.status).toBe(200);
    expect((await shared.json())[0].role).toBe("view");

    const viewed = await app.request(`/api/endpoints/${endpoint.id}`, { headers: { cookie: colleague } });
    expect(viewed.status).toBe(200);
    expect((await viewed.json()).access).toBe("view");
    const blocked = await app.request(`/api/endpoints/${endpoint.id}/spec`, {
      method: "PUT",
      headers: { cookie: colleague, "content-type": "application/json" },
      body: JSON.stringify({ mockSpec: spec("nope") }),
    });
    expect(blocked.status).toBe(403);

    const edited = await app.request(`/api/endpoints/${endpoint.id}/shares`, {
      method: "POST",
      headers: { cookie: owner, "content-type": "application/json" },
      body: JSON.stringify({ email: "Colleague@PaloAltoNetworks.com", role: "edit" }),
    });
    expect((await edited.json())).toHaveLength(1);

    const saved = await app.request(`/api/endpoints/${endpoint.id}/spec`, {
      method: "PUT",
      headers: { cookie: colleague, "content-type": "application/json" },
      body: JSON.stringify({ mockSpec: spec("two") }),
    });
    expect(saved.status).toBe(200);
    const versions = await app.request(`/api/endpoints/${endpoint.id}/versions`, { headers: { cookie: owner } });
    const history = await versions.json();
    expect(history[0].summary).toBe("Saved");
    const reverted = await app.request(`/api/endpoints/${endpoint.id}/versions/${history[0].id}/revert`, {
      method: "POST",
      headers: { cookie: owner, "content-type": "application/json" },
    });
    expect(reverted.status).toBe(200);
    const restored = await app.request(`/api/endpoints/${endpoint.id}`, { headers: { cookie: owner } });
    const restoredSpec = (await restored.json()).mockSpec;
    expect(JSON.stringify(restoredSpec)).toContain("one");

    const published = await app.request(`/api/endpoints/${endpoint.id}/publish`, {
      method: "POST",
      headers: { cookie: owner, "content-type": "application/json" },
      body: JSON.stringify({ published: true }),
    });
    expect(published.status).toBe(200);
    const catalog = await app.request("/api/catalog", { headers: { cookie: colleague } });
    const listed = await catalog.json();
    expect(listed.some((item: { id: string }) => item.id === endpoint.id)).toBe(true);

    const outsider = await signIn(app, "outsider@paloaltonetworks.com");
    const readable = await app.request(`/api/endpoints/${endpoint.id}`, { headers: { cookie: outsider } });
    expect((await readable.json()).access).toBe("view");
    const mine = await app.request("/api/endpoints", { headers: { cookie: outsider } });
    expect((await mine.json()).some((item: { id: string }) => item.id === endpoint.id)).toBe(false);
    const cloned = await app.request(`/api/endpoints/${endpoint.id}/clone`, {
      method: "POST",
      headers: { cookie: outsider, "content-type": "application/json" },
    });
    expect(cloned.status).toBe(200);
    const copy = await cloned.json();
    expect(copy.id).not.toBe(endpoint.id);
    expect(copy.access).toBe("owner");
    expect(copy.published).toBe(false);

    await app.request(`/catch/${copy.path}`);
    const before = await app.request("/api/requests", { headers: { cookie: outsider } });
    expect((await before.json()).length).toBeGreaterThan(0);
    const users = await app.request("/api/admin/users", { headers: { cookie: owner } });
    const outsiderUser = (await users.json()).find((user: { email: string }) => user.email === "outsider@paloaltonetworks.com");
    const denied = await app.request(`/api/admin/users/${outsiderUser.id}/purge`, {
      method: "POST",
      headers: { cookie: colleague },
    });
    expect(denied.status).toBe(403);
    const purged = await app.request(`/api/admin/users/${outsiderUser.id}/purge`, {
      method: "POST",
      headers: { cookie: owner },
    });
    expect(purged.status).toBe(200);
    const after = await app.request("/api/requests", { headers: { cookie: outsider } });
    expect(await after.json()).toEqual([]);
    const stillThere = await app.request(`/api/endpoints/${copy.id}`, { headers: { cookie: outsider } });
    expect(stillThere.status).toBe(200);

    const usage = await app.request("/api/admin/usage", { headers: { cookie: owner } });
    const usageRows = await usage.json();
    expect(usageRows.find((row: { email: string }) => row.email === "ashamah@paloaltonetworks.com").endpoints).toBeGreaterThan(0);
    const audit = await app.request("/api/admin/audit", { headers: { cookie: owner } });
    const actions = (await audit.json()).map((event: { action: string }) => event.action);
    expect(actions).toEqual(expect.arrayContaining(["share", "save", "revert", "publish", "clone", "purge"]));
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
