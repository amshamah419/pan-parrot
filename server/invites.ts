import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { appSettings, invites, users } from "../db/schema";
import { FOUNDING_ADMIN, POLICY } from "../shared/policy";
import { normalizePanEmail } from "../shared/email";
import { exposeDevCode, publicSiteUrl } from "./config";
import { sendInviteEmail } from "./email-delivery";
import { HttpError } from "./http";
import { mac } from "./session";
import { writeAudit } from "./collab";

const INVITE_ONLY = "invite_only";

export async function inviteOnlyEnabled(db: AppDb): Promise<boolean> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, INVITE_ONLY)).limit(1);
  return row?.value === "true";
}

export async function setInviteOnly(db: AppDb, actorEmail: string, enabled: boolean): Promise<boolean> {
  const value = enabled ? "true" : "false";
  await db.execute(sql`
    INSERT INTO app_settings (key, value) VALUES (${INVITE_ONLY}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = excluded.value
  `);
  await writeAudit(db, actorEmail, "invite-only", null, enabled ? "on" : "off");
  return enabled;
}

export async function maySignUp(db: AppDb, email: string): Promise<boolean> {
  if (email === FOUNDING_ADMIN) return true;
  if (!(await inviteOnlyEnabled(db))) return true;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return true;
  const pending = await openInvite(db, email);
  return Boolean(pending);
}

export async function createInvites(db: AppDb, actorEmail: string, rawEmails: string[]) {
  const unique = [...new Set(rawEmails.map((value) => value.trim()).filter(Boolean))];
  if (!unique.length) throw new HttpError(400, "Enter at least one email address");
  if (unique.length > 20) throw new HttpError(400, "Invite at most 20 addresses at a time");
  const emails = unique.map((value) => normalizePanEmail(value));
  if (emails.some((email) => !email)) {
    throw new HttpError(
      400,
      "Sign-in is limited to verified @paloaltonetworks.com email addresses.",
    );
  }
  const created = [];
  const devLinks: Array<{ email: string; url: string }> = [];
  for (const email of emails) {
    if (!email) continue;
    const token = randomBytes(32).toString("base64url");
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + POLICY.inviteTtlMs);
    await db.delete(invites).where(and(eq(invites.email, email), eq(invites.status, "pending")));
    await db.insert(invites).values({
      id,
      email,
      tokenHash: mac(token),
      status: "pending",
      invitedBy: actorEmail,
      expiresAt,
    });
    const url = `${publicSiteUrl()}/login?invite=${encodeURIComponent(token)}`;
    await sendInviteEmail({ to: email, link: url });
    created.push(await inviteDto(db, id));
    if (exposeDevCode()) devLinks.push({ email, url });
  }
  await writeAudit(db, actorEmail, "invite", null, emails.filter(Boolean).join(", ").slice(0, 200));
  return { invites: created, ...(devLinks.length ? { devLinks } : {}) };
}

export async function listInvites(db: AppDb) {
  const rows = await db.select().from(invites).orderBy(desc(invites.createdAt)).limit(100);
  return rows.map(presentInvite);
}

export async function resendInvite(db: AppDb, actorEmail: string, inviteId: string) {
  const [row] = await db.select().from(invites).where(eq(invites.id, inviteId)).limit(1);
  if (!row) throw new HttpError(404, "Invite not found");
  if (row.status === "revoked") throw new HttpError(400, "That invite was revoked");
  if (row.status === "accepted") throw new HttpError(400, "That invite was already accepted");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + POLICY.inviteTtlMs);
  await db
    .update(invites)
    .set({ tokenHash: mac(token), status: "pending", expiresAt })
    .where(eq(invites.id, row.id));
  const url = `${publicSiteUrl()}/login?invite=${encodeURIComponent(token)}`;
  await sendInviteEmail({ to: row.email, link: url });
  await writeAudit(db, actorEmail, "invite-resend", null, row.email);
  const invite = presentInvite({ ...row, status: "pending", expiresAt });
  return { invite, ...(exposeDevCode() ? { devLink: url } : {}) };
}

export async function revokeInvite(db: AppDb, actorEmail: string, inviteId: string) {
  const [row] = await db.select().from(invites).where(eq(invites.id, inviteId)).limit(1);
  if (!row) throw new HttpError(404, "Invite not found");
  if (row.status === "accepted") throw new HttpError(400, "That invite was already accepted");
  await db.update(invites).set({ status: "revoked" }).where(eq(invites.id, row.id));
  await writeAudit(db, actorEmail, "invite-revoke", null, row.email);
  return presentInvite({ ...row, status: "revoked" });
}

export async function consumeInviteToken(db: AppDb, token: string): Promise<string> {
  if (!token || token.length > 200) throw new HttpError(401, "Invalid or expired code");
  const [row] = await db.select().from(invites).where(eq(invites.tokenHash, mac(token))).limit(1);
  if (!row || row.status !== "pending") throw new HttpError(401, "Invalid or expired code");
  if (row.expiresAt.getTime() <= Date.now()) throw new HttpError(401, "Invalid or expired code");
  await db
    .update(invites)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(invites.id, row.id));
  return row.email;
}

export async function markEmailInvitesAccepted(db: AppDb, email: string): Promise<void> {
  await db
    .update(invites)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(and(eq(invites.email, email), eq(invites.status, "pending")));
}

async function openInvite(db: AppDb, email: string) {
  const rows = await db
    .select()
    .from(invites)
    .where(and(eq(invites.email, email), eq(invites.status, "pending")));
  return rows.find((row) => row.expiresAt.getTime() > Date.now());
}

async function inviteDto(db: AppDb, id: string) {
  const [row] = await db.select().from(invites).where(eq(invites.id, id)).limit(1);
  if (!row) throw new HttpError(500, "Invite was not saved");
  return presentInvite(row);
}

function presentInvite(row: typeof invites.$inferSelect) {
  const expired = row.status === "pending" && row.expiresAt.getTime() <= Date.now();
  return {
    id: row.id,
    email: row.email,
    status: expired ? "expired" as const : (row.status as "pending" | "accepted" | "revoked"),
    invitedBy: row.invitedBy,
    expires: row.expiresAt.toISOString(),
    created: row.createdAt.toISOString(),
    accepted: row.acceptedAt ? row.acceptedAt.toISOString() : null,
  };
}
