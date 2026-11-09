import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { apiTokens, users } from "../db/schema";
import type { AppDb } from "../db/client";
import type { PublicUser } from "./auth";
import { HttpError } from "./http";

const MAX_ACTIVE = 5;

export function issueToken(): { token: string; hash: string; prefix: string } {
  const token = `pp_${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 11) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function userFromApiToken(db: AppDb, token: string): Promise<PublicUser | null> {
  if (!token.startsWith("pp_") || token.length > 120) return null;
  const [row] = await db
    .select({
      id: apiTokens.id,
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
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id));
  return {
    id: row.userId,
    email: row.email,
    name: row.name,
    role: row.role === "ADMIN" ? "admin" : "user",
  };
}

export async function listTokens(db: AppDb, userId: string) {
  const rows = await db.select().from(apiTokens).where(eq(apiTokens.userId, userId));
  return rows
    .filter((row) => !row.revokedAt)
    .map((row) => ({
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      created: row.createdAt.toISOString(),
      lastUsed: row.lastUsedAt?.toISOString() || null,
    }));
}

export async function createToken(db: AppDb, userId: string, name: string) {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) throw new HttpError(400, "Token name is required");
  const active = await db
    .select({ id: apiTokens.id })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)));
  if (active.length >= MAX_ACTIVE) throw new HttpError(400, "At most 5 active tokens");
  const issued = issueToken();
  const id = randomUUID();
  await db.insert(apiTokens).values({
    id,
    userId,
    name: trimmed,
    tokenHash: issued.hash,
    prefix: issued.prefix,
  });
  return { id, name: trimmed, prefix: issued.prefix, token: issued.token };
}

export async function revokeToken(db: AppDb, userId: string, tokenId: string) {
  const updated = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id });
  if (updated.length === 0) throw new HttpError(404, "Token not found");
}
