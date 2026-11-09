import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { sessionSecret } from "./config";
import type { MockAuth } from "../shared/mock-spec";

const SECRET_KEYS = ["value", "password", "token", "clientSecret", "apiKey", "clientToken", "accessToken", "secretAccessKey", "hmacSecret"] as const;

export function sealAuth(auth: MockAuth | undefined): MockAuth | undefined {
  if (!auth || auth.mode === "none") return auth;
  return walk(auth, sealSecret) as MockAuth;
}

export function openAuth(auth: MockAuth | undefined): MockAuth | undefined {
  if (!auth || auth.mode === "none") return auth;
  return walk(auth, openSecret) as MockAuth;
}

export function sealSecret(value: string): string {
  if (!value || value.startsWith("enc:v1:")) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key() as unknown as Uint8Array, iv as unknown as Uint8Array);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8") as unknown as Uint8Array,
    cipher.final() as unknown as Uint8Array,
  ]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function openSecret(value: string): string {
  if (!value.startsWith("enc:v1:")) return value;
  const [, ivText, tagText, data] = /^enc:v1:([^.]+)\.([^.]+)\.([^.]+)$/.exec(value) || [];
  if (!ivText || !tagText || !data) throw new Error("Stored mock credential is unreadable");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key() as unknown as Uint8Array,
    Buffer.from(ivText, "base64url") as unknown as Uint8Array,
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url") as unknown as NodeJS.ArrayBufferView);
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url") as unknown as Uint8Array) as unknown as Uint8Array,
    decipher.final() as unknown as Uint8Array,
  ]).toString("utf8");
}

function walk(value: unknown, convert: (value: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => walk(item, convert));
  if (!value || typeof value !== "object") return value;
  const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const [key, child] of Object.entries(copy)) {
    if (typeof child === "string" && SECRET_KEYS.includes(key as (typeof SECRET_KEYS)[number])) {
      copy[key] = convert(child);
    } else if (child && typeof child === "object") {
      copy[key] = walk(child, convert);
    }
  }
  return copy;
}

function key(): Uint8Array {
  return new Uint8Array(createHash("sha256").update(sessionSecret()).digest());
}
