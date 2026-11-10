import { normalizePanEmail } from "../shared/email";
import { POLICY } from "../shared/policy";

export function env(name: string): string | undefined {
  try {
    const fromNetlify = (
      globalThis as {
        Netlify?: { env?: { get?: (key: string) => string | undefined } };
      }
    ).Netlify?.env?.get?.(name);
    if (fromNetlify) return fromNetlify;
  } catch {
    // Netlify.env exists only inside Netlify runtimes.
  }
  const value = process.env[name];
  return value ? value : undefined;
}

export function intEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = env(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export function sessionSecret(): string {
  const secret = env("SESSION_SECRET") ?? "";
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}

/** Local debugging only. Ignored whenever NODE_ENV is production. */
export function exposeDevCode(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return env("AUTH_DEV_EXPOSE_CODE") === "true";
}

export function publicSiteUrl(): string {
  for (const name of ["SITE_URL", "DEPLOY_PRIME_URL", "URL"] as const) {
    const value = env(name);
    if (!value) continue;
    try {
      return new URL(value).origin;
    } catch {
      continue;
    }
  }
  return "http://localhost:8080";
}

export function allowedOrigins(): string[] {
  const origins = new Set<string>();
  const configured = [
    env("SITE_URL"),
    env("URL"),
    env("DEPLOY_PRIME_URL"),
    env("DEPLOY_URL"),
    ...(env("EXTRA_ORIGINS") ?? "").split(","),
  ];
  for (const value of configured) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    try {
      origins.add(new URL(trimmed).origin);
    } catch {
      continue;
    }
  }
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:8080");
    origins.add("http://127.0.0.1:8080");
    origins.add("http://localhost:8888");
    origins.add("http://127.0.0.1:8888");
  }
  return [...origins];
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return allowedOrigins().includes(origin);
}

export function cookieIsSecure(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    publicSiteUrl().startsWith("https:")
  );
}

export function bootstrapAdminEmails(): Set<string> {
  const emails = new Set<string>();
  for (const part of (env("ADMIN_EMAILS") ?? "").split(",")) {
    const email = normalizePanEmail(part.trim());
    if (email) emails.add(email);
  }
  return emails;
}

export function retentionDays(): number {
  return intEnv("REQUEST_RETENTION_DAYS", POLICY.defaultRetentionDays, 1, 90);
}

export function maxRequestsPerUser(): number {
  return intEnv("MAX_REQUESTS_PER_USER", POLICY.maxRequestsPerUser, 1, 20_000);
}

export function maxStoredBodyChars(): number {
  return intEnv("MAX_STORED_BODY_CHARS", POLICY.maxStoredBodyChars, 256, 64_000);
}

export function maxRequestsPerEndpoint(): number {
  return intEnv(
    "MAX_REQUESTS_PER_ENDPOINT",
    POLICY.defaultMaxRequestsPerEndpoint,
    1,
    5000,
  );
}

export function maxBodyBytes(): number {
  return intEnv("MAX_BODY_BYTES", POLICY.defaultMaxBodyBytes, 1024, 1_000_000);
}

export function rateMax(name: string, fallback: number): number {
  return intEnv(name, fallback, 1, 100_000);
}
