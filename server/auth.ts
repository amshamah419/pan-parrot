import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { nameFromEmail, normalizePanEmail } from "../shared/email";
import { POLICY } from "../shared/policy";
import type { AppDb } from "../db/client";
import { loginChallenges, sessions, users } from "../db/schema";
import {
  bootstrapAdminEmails,
  cookieIsSecure,
  exposeDevCode,
  publicSiteUrl,
  rateMax,
} from "./config";
import { sendSignInEmail } from "./email-delivery";
import { HttpError } from "./http";
import { enforceRateLimit, limitAuthVerify } from "./rate-limit";
import { mac, safeEqual, signSession, verifySession } from "./session";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
}

function toPublicUser(user: {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "ADMIN" ? "admin" : "user",
  };
}

export async function requestSignIn(
  db: AppDb,
  rawEmail: unknown,
  ip: string,
): Promise<{ message: string; devCode?: string; devToken?: string }> {
  const email = normalizePanEmail(rawEmail);
  await enforceRateLimit(
    db,
    `auth-req-ip:${ip}`,
    rateMax("RATE_AUTH_IP_MAX", 20),
    15 * 60 * 1000,
  );
  if (!email) {
    throw new HttpError(
      400,
      "Sign-in is limited to verified @paloaltonetworks.com email addresses.",
    );
  }
  await enforceRateLimit(
    db,
    `auth-req-email:${email}`,
    rateMax("RATE_AUTH_EMAIL_MAX", 5),
    15 * 60 * 1000,
  );

  const id = randomUUID();
  const code = randomInt(0, 10 ** POLICY.codeDigits)
    .toString()
    .padStart(POLICY.codeDigits, "0");
  const token = randomBytes(32).toString("base64url");
  const codeSalt = randomBytes(16).toString("hex");
  const link = `${publicSiteUrl()}/login?token=${encodeURIComponent(token)}`;

  if (!exposeDevCode()) {
    await sendSignInEmail({ to: email, code, link });
  }

  await db.delete(loginChallenges).where(eq(loginChallenges.email, email));
  await db.insert(loginChallenges).values({
    id,
    email,
    codeSalt,
    codeHash: mac(`${codeSalt}:${code}`),
    tokenHash: mac(token),
    attempts: 0,
    expiresAt: new Date(Date.now() + POLICY.challengeTtlMs),
  });

  if (exposeDevCode()) {
    console.info(`Dev sign-in code issued for ${email}`);
  }

  return {
    message: "Check your email for a sign-in code. It expires in 10 minutes.",
    ...(exposeDevCode() ? { devCode: code, devToken: token } : {}),
  };
}

export async function verifySignIn(
  db: AppDb,
  input: { email?: unknown; code?: unknown; token?: unknown },
  ip: string,
): Promise<{ user: PublicUser; cookieValue: string }> {
  const token = typeof input.token === "string" ? input.token : "";
  const email = normalizePanEmail(input.email);
  const code = typeof input.code === "string" ? input.code.trim() : "";

  if (token) {
    await limitAuthVerify(db, ip, "token");
    const tokenHash = mac(token);
    const [challenge] = await db
      .select()
      .from(loginChallenges)
      .where(eq(loginChallenges.tokenHash, tokenHash))
      .limit(1);
    if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
      if (challenge) {
        await db.delete(loginChallenges).where(eq(loginChallenges.id, challenge.id));
      }
      throw new HttpError(401, "Invalid or expired sign-in link");
    }
    await db.delete(loginChallenges).where(eq(loginChallenges.email, challenge.email));
    const user = await upsertVerifiedUser(db, challenge.email);
    const cookieValue = await createSession(db, user.id);
    return { user: toPublicUser(user), cookieValue };
  }

  if (!email || !/^\d{8}$/.test(code)) {
    throw new HttpError(401, "Invalid or expired code");
  }
  await limitAuthVerify(db, ip, email);

  const [challenge] = await db
    .select()
    .from(loginChallenges)
    .where(eq(loginChallenges.email, email))
    .orderBy(desc(loginChallenges.createdAt))
    .limit(1);

  const dummy = mac(`missing:${code}`);
  const expected = challenge
    ? challenge.codeHash
    : dummy;
  const actual = challenge
    ? mac(`${challenge.codeSalt}:${code}`)
    : dummy;
  const matches = safeEqual(actual, expected);

  if (
    !challenge ||
    challenge.expiresAt.getTime() <= Date.now() ||
    challenge.attempts >= POLICY.maxVerifyAttempts ||
    !matches
  ) {
    if (challenge) {
      const attempts = challenge.attempts + 1;
      if (
        attempts >= POLICY.maxVerifyAttempts ||
        challenge.expiresAt.getTime() <= Date.now()
      ) {
        await db.delete(loginChallenges).where(eq(loginChallenges.id, challenge.id));
      } else {
        await db
          .update(loginChallenges)
          .set({ attempts })
          .where(eq(loginChallenges.id, challenge.id));
      }
    }
    throw new HttpError(401, "Invalid or expired code");
  }

  await db.delete(loginChallenges).where(eq(loginChallenges.email, email));
  const user = await upsertVerifiedUser(db, email);
  const cookieValue = await createSession(db, user.id);
  return { user: toPublicUser(user), cookieValue };
}

async function upsertVerifiedUser(db: AppDb, email: string) {
  const normalized = normalizePanEmail(email);
  if (!normalized) {
    throw new HttpError(403, "Account is not allowed");
  }
  const admin = bootstrapAdminEmails().has(normalized);
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (existing && !existing.active) {
    throw new HttpError(403, "Account disabled");
  }

  if (!existing) {
    try {
      const [created] = await db
        .insert(users)
        .values({
          email: normalized,
          name: nameFromEmail(normalized),
          role: admin ? "ADMIN" : "USER",
          active: true,
          lastLogin: new Date(),
        })
        .returning();
      return created;
    } catch (error) {
      const [raced] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalized))
        .limit(1);
      if (!raced) throw error;
      if (!raced.active) throw new HttpError(403, "Account disabled");
      return raced;
    }
  }

  const role = admin ? "ADMIN" : existing.role;
  const [updated] = await db
    .update(users)
    .set({
      role,
      lastLogin: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, existing.id))
    .returning();
  return updated;
}

async function createSession(db: AppDb, userId: string): Promise<string> {
  const sid = randomUUID();
  const expiresAt = new Date(Date.now() + POLICY.sessionTtlSeconds * 1000);
  await db.insert(sessions).values({ id: sid, userId, expiresAt });
  await db.execute(sql`
    DELETE FROM sessions
    WHERE user_id = ${userId}
      AND id NOT IN (
        SELECT id FROM sessions
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 5
      )
  `);
  return signSession({
    sid,
    exp: Math.floor(expiresAt.getTime() / 1000),
  });
}

export async function userFromCookie(
  db: AppDb,
  token: string | undefined,
): Promise<PublicUser | null> {
  let claims: ReturnType<typeof verifySession>;
  try {
    claims = verifySession(token);
  } catch {
    return null;
  }
  if (!claims) return null;

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, claims.sid))
    .limit(1);
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.active, true)))
    .limit(1);
  if (!user || !normalizePanEmail(user.email)) return null;
  return toPublicUser(user);
}

export async function destroySession(
  db: AppDb,
  token: string | undefined,
): Promise<void> {
  const claims = token ? verifySession(token) : null;
  if (!claims) return;
  await db.delete(sessions).where(eq(sessions.id, claims.sid));
}

export function secureCookie(): boolean {
  return cookieIsSecure();
}
