import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "../db/schema";
import type { AppDb } from "../db/client";
import { createServer } from "./app";
import { runDuePushes } from "./push";
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

const mockSpec = {
  version: 1,
  source: { kind: "manual", name: "Push" },
  operations: [
    {
      id: "op",
      method: "POST",
      pathTemplate: "/events",
      status: 200,
      contentType: "application/json",
      list: false,
      envelope: { type: "object" },
      record: { name: "event", kind: "object", children: [{ name: "title", kind: "const", constValue: "alert" }] },
    },
  ],
  chaos: { enabled: false },
  totalRecords: 1,
  push: {
    enabled: true,
    url: "https://collector.example.com/hook",
    intervalMinutes: 15,
    batch: 1,
    retries: 1,
    signing: "bearer",
    secret: "super-secret-push",
  },
};

describe("push route and schedule", () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const app = createServer({ db: db as unknown as AppDb });
  let cookie = "";
  let endpointId = "";

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
    const created = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json", origin: "http://localhost:8080" },
      body: JSON.stringify({ name: "Push", customPath: "pushdemo", mockSpec }),
    });
    expect(created.status).toBe(200);
    endpointId = (await created.json()).id;
  });

  it("does not return the signing secret and records a blocked push", async () => {
    const loaded = await app.request(`/api/endpoints/${endpointId}`, {
      headers: { cookie, origin: "http://localhost:8080" },
    });
    const body = await loaded.json();
    expect(body.mockSpec.push.hasSecret).toBe(true);
    expect(body.mockSpec.push.secret).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("super-secret-push");

    const blocked = await app.request(`/api/endpoints/${endpointId}/spec`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json", origin: "http://localhost:8080" },
      body: JSON.stringify({
        mockSpec: { ...mockSpec, push: { ...mockSpec.push, url: "https://192.168.1.9/hook", secret: "" } },
      }),
    });
    expect(blocked.status).toBe(400);
    expect(await blocked.text()).not.toContain("super-secret-push");
  });

  it("sends a due mock once per interval", async () => {
    let calls = 0;
    const first = await runDuePushes(db as unknown as AppDb, async (_url, init) => {
      calls += 1;
      expect(init?.headers?.authorization).toBe("Bearer super-secret-push");
      return { status: 202, contentType: "application/json", body: "{}", truncated: false };
    });
    expect(first.sent).toBe(1);
    expect(calls).toBe(1);
    const second = await runDuePushes(db as unknown as AppDb, async () => {
      calls += 1;
      return { status: 202, contentType: "application/json", body: "{}", truncated: false };
    });
    expect(second.sent).toBe(0);
    expect(calls).toBe(1);
    const history = await app.request(`/api/endpoints/${endpointId}/push`, {
      headers: { cookie, origin: "http://localhost:8080" },
    });
    const text = await history.text();
    expect(text).not.toContain("super-secret-push");
    expect(text).toContain("202");
  });
});
