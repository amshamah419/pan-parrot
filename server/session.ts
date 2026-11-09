import { createHmac, timingSafeEqual } from "node:crypto";
import { POLICY } from "../shared/policy";
import { sessionSecret } from "./config";

export interface SessionClaims {
  sid: string;
  exp: number;
}

export function signSession(claims: SessionClaims, secret = sessionSecret()): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySession(
  token: string | undefined | null,
  secret = sessionSecret(),
): SessionClaims | null {
  if (!token || token.length > 512) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(
      new Uint8Array(actualBuffer),
      new Uint8Array(expectedBuffer),
    )
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<SessionClaims>;
    if (typeof parsed.sid !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    if (!/^[0-9a-f-]{36}$/i.test(parsed.sid)) return null;
    if (parsed.exp * 1000 <= Date.now()) return null;
    return { sid: parsed.sid, exp: parsed.exp };
  } catch {
    return null;
  }
}

export function mac(value: string, secret = sessionSecret()): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}

export function sessionCookieOptions(secure: boolean) {
  return {
    path: "/api",
    httpOnly: true,
    secure,
    sameSite: "Lax" as const,
    maxAge: POLICY.sessionTtlSeconds,
  };
}
