import { describe, expect, it } from "vitest";
import type { AppDb } from "../db/client";
import { hostedDatabaseSkipped } from "../db/client";
import { createServer } from "./app";

function throwingDb(): AppDb {
  return new Proxy({} as AppDb, {
    get() {
      throw new Error("database was opened");
    },
  });
}

describe("idle database guard", () => {
  it("answers health and a junk catch path without touching the database", async () => {
    const app = createServer({ db: throwingDb() });
    const ping = await app.request("/api/ping");
    expect(ping.status).toBe(200);
    expect(await ping.json()).toEqual({ ok: true, database: "idle" });
    const health = await app.request("/api/health");
    expect(health.status).toBe(200);
    const junk = await app.request("/catch/wp-login.php");
    expect(junk.status).toBe(404);
    expect(await junk.text()).toContain("Not found");
    const scanner = await app.request("/.env");
    expect(scanner.status).toBe(404);
  });

  it("skips hosted database connections on deploy previews", () => {
    const previous = process.env.CONTEXT;
    process.env.CONTEXT = "deploy-preview";
    expect(hostedDatabaseSkipped()).toBe(true);
    process.env.CONTEXT = "branch-deploy";
    expect(hostedDatabaseSkipped()).toBe(true);
    process.env.CONTEXT = "production";
    expect(hostedDatabaseSkipped()).toBe(false);
    if (previous === undefined) delete process.env.CONTEXT;
    else process.env.CONTEXT = previous;
  });
});
