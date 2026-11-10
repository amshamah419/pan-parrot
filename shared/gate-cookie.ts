// `.ts` is required so the Netlify edge bundler (Deno) can load this module.
import { POLICY } from "./policy.ts";

export const GATE_COOKIE = "pp_gate";

export async function signGate(exp: number, secret: string): Promise<string> {
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ exp })));
  const signature = bytesToBase64Url(await hmac(secret, payload));
  return `${payload}.${signature}`;
}

export async function verifyGate(token: string | undefined | null, secret: string): Promise<boolean> {
  if (!token || !secret || token.length > 512) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const expected = await hmac(secret, parts[0]);
  const actual = base64UrlToBytes(parts[1]);
  if (!timingSafeEqual(actual, expected)) return false;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0]))) as { exp?: unknown };
    return typeof parsed.exp === "number" && parsed.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function gateCookieMaxAge(): number {
  return POLICY.sessionTtlSeconds;
}

async function hmac(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return new Uint8Array(signed);
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}
