import { readFileSync } from "node:fs";
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

const akamai = validateMockSpec(
  JSON.parse(readFileSync("public/presets/integrations/akamai-waf-siem.json", "utf8")).spec,
);

describe("generated mocks on the catch URL", () => {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  const app = createServer({ db: db as unknown as AppDb });
  let cookie = "";
  let endpointId = "";

  beforeAll(async () => {
    await applySqlMigrations(db as unknown as AppDb);
    const requested = await app.request("/api/auth/request", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.40",
      },
      body: JSON.stringify({ email: "ashamah@paloaltonetworks.com" }),
    });
    const pending = await requested.json();
    const verified = await app.request("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "ashamah@paloaltonetworks.com",
        code: pending.devCode,
      }),
    });
    cookie = (verified.headers.get("set-cookie") || "").split(";")[0];
    const created = await app.request("/api/endpoints", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Akamai WAF SIEM",
        customPath: "akamai",
        mockSpec: { ...akamai, auth: { mode: "none" }, totalRecords: 1000, chaos: { ...akamai.chaos, seed: "load" } },
      }),
    });
    expect(created.status).toBe(200);
    endpointId = (await created.json()).id;
  });

  afterAll(async () => {
    await client.close();
  });

  it("returns 1000 unique events across two capped pages", async () => {
    const first = await app.request("/catch/akamai/siem/v1/configs/50170?limit=500");
    expect(first.status).toBe(200);
    const firstLines = (await first.text()).split("\n");
    const trailer = JSON.parse(firstLines.at(-1) || "{}");
    const second = await app.request(
      `/catch/akamai/siem/v1/configs/50170?limit=500&offset=${trailer.offset}`,
    );
    const secondLines = (await second.text()).split("\n");
    const ids = [...firstLines.slice(0, -1), ...secondLines.slice(0, -1)].map(
      (line) => JSON.parse(line).httpMessage.requestId as string,
    );
    expect(ids).toHaveLength(1000);
    expect(new Set(ids).size).toBe(1000);
    expect(first.headers.get("content-security-policy")).toContain("sandbox");
  });

  it("records a deterministic flaky response on the request log", async () => {
    const flaky = validateMockSpec({
      ...akamai,
      auth: { mode: "none" },
      chaos: {
        ...akamai.chaos,
        enabled: true,
        mode: "every-nth",
        everyNth: 1,
        randomErrors: true,
        seed: "bug",
      },
    });
    const saved = await app.request(`/api/endpoints/${endpointId}/spec`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ mockSpec: flaky }),
    });
    expect(saved.status).toBe(200);
    const response = await app.request("/catch/akamai/siem/v1/configs/50170?limit=1");
    expect([429, 500, 503]).toContain(response.status);
    if (response.status === 429 || response.status === 503) {
      expect(response.headers.get("retry-after")).toBeTruthy();
    }
    const list = await app.request("/api/requests", { headers: { cookie } });
    const rows = await list.json();
    const logged = rows.find((row: { endpoint?: string; chaosEffects?: string[] }) =>
      String(row.endpoint || "").includes("configs") && (row.chaosEffects || []).length > 0,
    );
    expect(logged).toBeTruthy();
    expect(logged.chaosEffects.some((effect: string) => effect.startsWith("http-"))).toBe(true);
    expect(logged.responsePreview.length).toBeGreaterThan(0);
  });
});
