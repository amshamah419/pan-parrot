import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  auditEvents,
  capturedRequests,
  endpointRuntime,
  endpointShares,
  endpoints,
  endpointVersions,
  users,
} from "../db/schema";
import { normalizePanEmail } from "../shared/email";
import { revertDiff } from "../shared/spec-diff";
import type { PublicUser } from "./auth";
import { HttpError } from "./http";

export type Access = "owner" | "edit" | "view";

export async function endpointAccess(
  db: AppDb,
  user: PublicUser,
  endpointId: string,
): Promise<Access | null> {
  const [endpoint] = await db.select().from(endpoints).where(eq(endpoints.id, endpointId)).limit(1);
  if (!endpoint) return null;
  if (endpoint.userId === user.id) return "owner";
  const [share] = await db
    .select()
    .from(endpointShares)
    .where(and(eq(endpointShares.endpointId, endpointId), eq(endpointShares.email, user.email)))
    .limit(1);
  if (share?.role === "edit" || share?.role === "view") return share.role;
  return null;
}

export async function canRead(db: AppDb, user: PublicUser, endpointId: string): Promise<Access | null> {
  const access = await endpointAccess(db, user, endpointId);
  if (access) return access;
  const [endpoint] = await db.select({ published: endpoints.published }).from(endpoints).where(eq(endpoints.id, endpointId)).limit(1);
  return endpoint?.published ? "view" : null;
}

export async function requireAccess(db: AppDb, user: PublicUser, endpointId: string, edit = false): Promise<Access> {
  const access = await canRead(db, user, endpointId);
  if (!access) throw new HttpError(404, "Endpoint not found");
  if (edit && access === "view") throw new HttpError(403, "You can view this mock but not change it");
  return access;
}

export async function listShares(db: AppDb, user: PublicUser, endpointId: string) {
  await requireOwner(db, user, endpointId);
  const rows = await db.select().from(endpointShares).where(eq(endpointShares.endpointId, endpointId));
  return rows.map((row) => ({ email: row.email, role: row.role, created: row.createdAt.toISOString() }));
}

export async function shareEndpoint(
  db: AppDb,
  user: PublicUser,
  endpointId: string,
  emailInput: string,
  role: string,
) {
  await requireOwner(db, user, endpointId);
  const email = normalizePanEmail(emailInput);
  if (!email) throw new HttpError(400, "Share with a @paloaltonetworks.com address");
  if (email === user.email) throw new HttpError(400, "You already own this mock");
  if (role !== "view" && role !== "edit") throw new HttpError(400, "Role must be view or edit");
  const existing = await db.select().from(endpointShares).where(eq(endpointShares.endpointId, endpointId));
  if (existing.length >= 20 && !existing.some((row) => row.email === email)) {
    throw new HttpError(400, "At most 20 people can be added to a mock");
  }
  await db.delete(endpointShares).where(and(eq(endpointShares.endpointId, endpointId), eq(endpointShares.email, email)));
  await db.insert(endpointShares).values({ endpointId, email, role });
  await writeAudit(db, user.email, "share", endpointId, `${role} ${email}`);
  return listShares(db, user, endpointId);
}

export async function unshareEndpoint(db: AppDb, user: PublicUser, endpointId: string, emailInput: string) {
  await requireOwner(db, user, endpointId);
  const email = normalizePanEmail(emailInput);
  if (!email) throw new HttpError(400, "Share with a @paloaltonetworks.com address");
  await db.delete(endpointShares).where(and(eq(endpointShares.endpointId, endpointId), eq(endpointShares.email, email)));
  await writeAudit(db, user.email, "unshare", endpointId, email);
}

export async function setPublished(db: AppDb, user: PublicUser, endpointId: string, published: boolean) {
  await requireOwner(db, user, endpointId);
  await db.update(endpoints).set({ published, updatedAt: new Date() }).where(eq(endpoints.id, endpointId));
  await writeAudit(db, user.email, published ? "publish" : "unpublish", endpointId, published ? "catalog" : "private");
}

export async function listCatalog(db: AppDb) {
  const rows = await db
    .select({ endpoint: endpoints, email: users.email })
    .from(endpoints)
    .innerJoin(users, eq(users.id, endpoints.userId))
    .where(eq(endpoints.published, true))
    .orderBy(desc(endpoints.updatedAt))
    .limit(50);
  return rows.map((row) => ({
    id: row.endpoint.id,
    name: row.endpoint.name,
    description: row.endpoint.description,
    ownerEmail: row.email,
  }));
}

export async function snapshotSpec(
  db: AppDb,
  endpointId: string,
  actorEmail: string,
  summary: string,
  mockSpec: unknown,
) {
  if (!mockSpec) return;
  await db.insert(endpointVersions).values({
    id: randomUUID(),
    endpointId,
    actorEmail,
    summary: summary.slice(0, 120),
    mockSpec,
  });
  await db.execute(sql`
    DELETE FROM endpoint_versions
    WHERE endpoint_id = ${endpointId}
      AND id IN (
        SELECT id FROM endpoint_versions
        WHERE endpoint_id = ${endpointId}
        ORDER BY created_at DESC
        OFFSET 15
      )
  `);
}

export async function listVersions(db: AppDb, user: PublicUser, endpointId: string) {
  await requireAccess(db, user, endpointId);
  const [endpoint] = await db.select().from(endpoints).where(eq(endpoints.id, endpointId)).limit(1);
  const rows = await db
    .select()
    .from(endpointVersions)
    .where(eq(endpointVersions.endpointId, endpointId))
    .orderBy(desc(endpointVersions.createdAt))
    .limit(15);
  return rows.map((row) => ({
    id: row.id,
    summary: row.summary,
    actorEmail: row.actorEmail,
    created: row.createdAt.toISOString(),
    changes: revertDiff(endpoint?.mockSpec, row.mockSpec),
  }));
}

export async function revertToVersion(db: AppDb, user: PublicUser, endpointId: string, versionId: string) {
  await requireAccess(db, user, endpointId, true);
  const [version] = await db
    .select()
    .from(endpointVersions)
    .where(and(eq(endpointVersions.id, versionId), eq(endpointVersions.endpointId, endpointId)))
    .limit(1);
  if (!version) throw new HttpError(404, "Version not found");
  const [existing] = await db.select().from(endpoints).where(eq(endpoints.id, endpointId)).limit(1);
  if (!existing) throw new HttpError(404, "Endpoint not found");
  if (existing.mockSpec) await snapshotSpec(db, endpointId, user.email, "Before revert", existing.mockSpec);
  await db.update(endpoints).set({ mockSpec: version.mockSpec, updatedAt: new Date() }).where(eq(endpoints.id, endpointId));
  await writeAudit(db, user.email, "revert", endpointId, version.summary);
}

export async function listEndpointAudit(db: AppDb, user: PublicUser, endpointId: string) {
  await requireAccess(db, user, endpointId);
  const rows = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.endpointId, endpointId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(30);
  return rows.map(auditDto);
}

export async function listAdminAudit(db: AppDb) {
  const rows = await db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(50);
  return rows.map(auditDto);
}

export async function adminUsage(db: AppDb) {
  const people = await db.select().from(users).orderBy(desc(users.createdAt));
  const endpointRows = await db.select({ userId: endpoints.userId }).from(endpoints);
  const requestRows = await db.select({ userId: capturedRequests.userId }).from(capturedRequests);
  return people.map((person) => ({
    id: person.id,
    email: person.email,
    active: person.active,
    role: person.role === "ADMIN" ? "admin" : "user",
    endpoints: endpointRows.filter((row) => row.userId === person.id).length,
    requests: requestRows.filter((row) => row.userId === person.id).length,
  }));
}

export async function purgeUserData(db: AppDb, actor: PublicUser, userId: string) {
  if (actor.id === userId) throw new HttpError(400, "Purge another account, not your own");
  const [person] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!person) throw new HttpError(404, "User not found");
  const owned = await db.select({ id: endpoints.id }).from(endpoints).where(eq(endpoints.userId, userId));
  await db.delete(capturedRequests).where(eq(capturedRequests.userId, userId));
  for (const endpoint of owned) {
    await db.delete(endpointRuntime).where(eq(endpointRuntime.endpointId, endpoint.id));
  }
  await writeAudit(db, actor.email, "purge", null, person.email);
}

export async function writeAudit(
  db: AppDb,
  actorEmail: string,
  action: string,
  endpointId: string | null,
  detail: string,
) {
  await db.insert(auditEvents).values({
    id: randomUUID(),
    actorEmail,
    action: action.slice(0, 40),
    endpointId,
    detail: detail.slice(0, 200),
  });
  await db.execute(sql`
    DELETE FROM audit_events
    WHERE id IN (
      SELECT id FROM audit_events
      ORDER BY created_at DESC
      OFFSET 400
    )
  `);
}

async function requireOwner(db: AppDb, user: PublicUser, endpointId: string) {
  const access = await endpointAccess(db, user, endpointId);
  if (access !== "owner") throw new HttpError(access ? 403 : 404, access ? "Only the owner can share this mock" : "Endpoint not found");
}

function auditDto(row: typeof auditEvents.$inferSelect) {
  return {
    id: row.id,
    actorEmail: row.actorEmail,
    action: row.action,
    endpointId: row.endpointId,
    detail: row.detail,
    created: row.createdAt.toISOString(),
  };
}
