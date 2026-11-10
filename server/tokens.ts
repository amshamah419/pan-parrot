import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { apiTokens, users } from "../db/schema";
import type { AppDb } from "../db/client";
import type { PublicUser } from "./auth";
import { HttpError } from "./http";

const MAX_ACTIVE = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
export const TOKEN_SCOPES = ["mocks:read", "mocks:write", "cli:download"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

export interface ResolvedToken {
  id: string;
  scopes: TokenScope[];
  user: PublicUser;
}

export function issueToken(): { token: string; hash: string; prefix: string } {
  const token = `pp_${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 11) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseScopes(value: string | null | undefined): TokenScope[] {
  const parts = (value || "mocks:read,mocks:write").split(",").map((part) => part.trim());
  return parts.filter((part): part is TokenScope => part === "mocks:read" || part === "mocks:write" || part === "cli:download");
}

function normalizeScopes(scopes: string[] | undefined): TokenScope[] {
  const picked = scopes?.length ? [...new Set(scopes)] : ["mocks:read", "mocks:write"];
  if (picked.length === 1 && picked[0] === "cli:download") return ["cli:download"];
  if (picked.includes("cli:download")) throw new HttpError(400, "cli:download cannot be combined with other scopes");
  if (!picked.length || picked.some((scope) => scope !== "mocks:read" && scope !== "mocks:write")) {
    throw new HttpError(400, "Scopes must be mocks:read, mocks:write, or both");
  }
  return picked as TokenScope[];
}

function normalizeDays(days: number | undefined): number {
  if (days == null) return 90;
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new HttpError(400, "Expiry must be from 1 to 365 days");
  }
  return days;
}

function toPublic(row: {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
}): PublicUser {
  return {
    id: row.userId,
    email: row.email,
    name: row.name,
    role: row.role === "ADMIN" ? "admin" : "user",
  };
}

export async function resolveApiToken(db: AppDb, token: string): Promise<ResolvedToken | null> {
  if (!token.startsWith("pp_") || token.length > 120) return null;
  const [row] = await db
    .select({
      id: apiTokens.id,
      scopes: apiTokens.scopes,
      expiresAt: apiTokens.expiresAt,
      userId: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
    })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(and(eq(apiTokens.tokenHash, hashToken(token)), isNull(apiTokens.revokedAt)))
    .limit(1);
  if (!row || !row.active) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id));
  return { id: row.id, scopes: parseScopes(row.scopes), user: toPublic(row) };
}

export async function userFromApiToken(db: AppDb, token: string): Promise<PublicUser | null> {
  const resolved = await resolveApiToken(db, token);
  return resolved?.user ?? null;
}

function present(row: {
  id: string;
  name: string;
  prefix: string;
  scopes: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  email?: string;
}) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: parseScopes(row.scopes),
    created: row.createdAt.toISOString(),
    expires: row.expiresAt.toISOString(),
    lastUsed: row.lastUsedAt?.toISOString() || null,
    revoked: row.revokedAt?.toISOString() || null,
    email: row.email,
  };
}

export async function listTokens(db: AppDb, userId: string) {
  const rows = await db.select().from(apiTokens).where(eq(apiTokens.userId, userId)).orderBy(desc(apiTokens.createdAt));
  return rows.filter((row) => !row.revokedAt).map((row) => present(row));
}

export async function listAllTokens(db: AppDb) {
  const rows = await db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      prefix: apiTokens.prefix,
      scopes: apiTokens.scopes,
      createdAt: apiTokens.createdAt,
      expiresAt: apiTokens.expiresAt,
      lastUsedAt: apiTokens.lastUsedAt,
      revokedAt: apiTokens.revokedAt,
      email: users.email,
    })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .orderBy(desc(apiTokens.createdAt))
    .limit(200);
  return rows.map((row) => present(row));
}

export async function createToken(
  db: AppDb,
  userId: string,
  name: string,
  options: { days?: number; scopes?: string[] } = {},
) {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) throw new HttpError(400, "Token name is required");
  const scopes = normalizeScopes(options.scopes);
  const downloadOnly = scopes.length === 1 && scopes[0] === "cli:download";
  const now = new Date();
  let expiresAt: Date;
  if (downloadOnly) {
    const existing = await db
      .select({ id: apiTokens.id })
      .from(apiTokens)
      .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt), gt(apiTokens.expiresAt, now), eq(apiTokens.scopes, "cli:download")))
      .orderBy(asc(apiTokens.createdAt));
    const oldest = existing.slice(0, Math.max(0, existing.length - 4));
    if (oldest.length) {
      await db.update(apiTokens).set({ revokedAt: now }).where(inArray(apiTokens.id, oldest.map((row) => row.id)));
    }
    expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
  } else {
    const days = normalizeDays(options.days);
    const mockTokens = await db
      .select({ scopes: apiTokens.scopes })
      .from(apiTokens)
      .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt), gt(apiTokens.expiresAt, now)));
    const counted = mockTokens.filter((row) => row.scopes !== "cli:download");
    if (counted.length >= MAX_ACTIVE) throw new HttpError(400, "At most 5 active tokens");
    expiresAt = new Date(now.getTime() + days * DAY_MS);
  }
  const issued = issueToken();
  const id = randomUUID();
  await db.insert(apiTokens).values({
    id,
    userId,
    name: trimmed,
    tokenHash: issued.hash,
    prefix: issued.prefix,
    scopes: scopes.join(","),
    expiresAt,
  });
  return {
    id,
    name: trimmed,
    prefix: issued.prefix,
    token: issued.token,
    scopes,
    expires: expiresAt.toISOString(),
  };
}

export async function revokeToken(db: AppDb, userId: string, tokenId: string) {
  const updated = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id });
  if (updated.length === 0) throw new HttpError(404, "Token not found");
}

export async function revokeTokenAsAdmin(db: AppDb, tokenId: string) {
  const updated = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, tokenId), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id });
  if (updated.length === 0) throw new HttpError(404, "Token not found");
}
