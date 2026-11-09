import { count, desc, eq, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { auditEvents, capturedRequests, endpoints, users } from "../db/schema";
import type { AdminSignals } from "../shared/api";
import {
  exposeDevCode,
  env,
  maxBodyBytes,
  maxRequestsPerEndpoint,
  publicSiteUrl,
  retentionDays,
  sessionSecret,
} from "./config";

export async function readHealth(db: AppDb): Promise<{ ok: boolean; database: "up" | "down" }> {
  try {
    await db.execute(sql`select 1`);
    return { ok: true, database: "up" };
  } catch {
    console.error("health check failed");
    return { ok: false, database: "down" };
  }
}

export async function adminSignals(db: AppDb): Promise<AdminSignals> {
  const configured = {
    email: env("RESEND_API_KEY") && env("EMAIL_FROM") ? "configured" as const : "missing" as const,
    siteUrl: publicSiteUrl(),
    devCodeExposed: exposeDevCode(),
    sessionSecret: secretStatus(),
    retentionDays: retentionDays(),
    maxRequestsPerEndpoint: maxRequestsPerEndpoint(),
    maxBodyBytes: maxBodyBytes(),
  };
  try {
    const health = await readHealth(db);
    const [people] = await db.select({ value: count() }).from(users);
    const [inactive] = await db.select({ value: count() }).from(users).where(eq(users.active, false));
    const [mocks] = await db.select({ value: count() }).from(endpoints);
    const [captures] = await db.select({ value: count() }).from(capturedRequests);
    const [events] = await db.select({ value: count() }).from(auditEvents);
    const [newest] = await db
      .select({ createdAt: auditEvents.createdAt })
      .from(auditEvents)
      .orderBy(desc(auditEvents.createdAt))
      .limit(1);
    return {
      ok: health.ok,
      database: health.database,
      ...configured,
      users: Number(people?.value ?? 0),
      inactiveUsers: Number(inactive?.value ?? 0),
      endpoints: Number(mocks?.value ?? 0),
      capturedRequests: Number(captures?.value ?? 0),
      auditEvents: Number(events?.value ?? 0),
      newestAudit: newest?.createdAt ? newest.createdAt.toISOString() : null,
    };
  } catch {
    console.error("admin signals failed");
    return {
      ok: false,
      database: "down",
      ...configured,
      users: 0,
      inactiveUsers: 0,
      endpoints: 0,
      capturedRequests: 0,
      auditEvents: 0,
      newestAudit: null,
    };
  }
}

function secretStatus(): "ok" | "missing" {
  try {
    sessionSecret();
    return "ok";
  } catch {
    return "missing";
  }
}
