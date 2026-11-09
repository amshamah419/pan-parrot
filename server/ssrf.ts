import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { MOCK_LIMITS } from "../shared/policy";
import { HttpError } from "./http";

export function assertPublicHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, "URL is not valid");
  }
  if (url.protocol !== "https:") {
    throw new HttpError(400, "URL must use https");
  }
  if (url.username || url.password) {
    throw new HttpError(400, "URL must not include credentials");
  }
  if (url.port && url.port !== "443") {
    throw new HttpError(400, "URL must use port 443");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw new HttpError(400, "URL host is not allowed");
  }
  if (isIP(host) && isBlockedAddress(host)) {
    throw new HttpError(400, "URL address is not allowed");
  }
  return url;
}

export function isBlockedAddress(address: string): boolean {
  const ip = address.toLowerCase();
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;
  if (ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip.startsWith("::ffff:")) return isBlockedAddress(ip.slice(7));
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const parts = v4.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return ip.includes(":") ? false : true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 255) return true;
  return false;
}

const SENSITIVE_HEADER = /authorization|cookie|token|secret|password|api-key|credential/i;

export interface PublicFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  accept?: string;
  maxBytes?: number;
  timeoutMs?: number;
  /** Pushes do not follow redirects, so a signed body cannot hop to another host. */
  followRedirects?: boolean;
  /** throw rejects an oversized body. truncate keeps the first maxBytes. */
  oversize?: "throw" | "truncate";
}

export interface PublicFetchResult {
  status: number;
  contentType: string;
  body: string;
  truncated: boolean;
}

export async function fetchPublicSpec(raw: string): Promise<string> {
  try {
    const result = await fetchPublic(raw, {
      method: "GET",
      accept: "application/json, application/yaml, text/yaml, */*",
      maxBytes: MOCK_LIMITS.maxFetchedSpecBytes,
      oversize: "throw",
    });
    if (result.status < 200 || result.status >= 300) {
      throw new HttpError(400, "Could not download the API spec");
    }
    return result.body;
  } catch (error) {
    if (error instanceof HttpError && error.status === 413) {
      throw new HttpError(413, "API spec is too large");
    }
    throw error;
  }
}

export async function fetchPublic(raw: string, init: PublicFetchInit = {}): Promise<PublicFetchResult> {
  const url = assertPublicHttpsUrl(raw);
  const headers = new Headers(init.headers);
  if (init.accept) headers.set("accept", init.accept);
  try {
    return await readHttps(url, init, 0, headers);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Could not reach the URL");
  }
}

/** A redirect to another host does not receive the caller's credential headers. */
export function headersForRedirect(current: URL, next: URL, headers: Headers): Headers {
  if (current.hostname.toLowerCase() === next.hostname.toLowerCase()) return headers;
  const kept = new Headers();
  headers.forEach((value, key) => {
    if (!SENSITIVE_HEADER.test(key)) kept.set(key, value);
  });
  return kept;
}

async function assertResolved(url: URL): Promise<void> {
  assertPublicHttpsUrl(url.toString());
  if (isIP(url.hostname)) return;
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => isBlockedAddress(record.address))) {
    throw new HttpError(400, "URL resolves to a blocked address");
  }
}

async function readHttps(
  url: URL,
  init: PublicFetchInit,
  redirects: number,
  headers: Headers,
): Promise<PublicFetchResult> {
  await assertResolved(url);
  const method = (init.method || "GET").toUpperCase();
  const response = await fetch(url, {
    method,
    redirect: "manual",
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : init.body,
    signal: AbortSignal.timeout(init.timeoutMs ?? 8000),
  });
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    if (init.followRedirects === false) {
      return { status: response.status, contentType: "", body: "", truncated: false };
    }
    if (redirects >= 2) throw new HttpError(400, "Too many redirects");
    const location = response.headers.get("location");
    if (!location) throw new HttpError(400, "Redirect missing a location");
    const next = new URL(location, url);
    assertPublicHttpsUrl(next.toString());
    const nextHeaders = headersForRedirect(url, next, headers);
    const switchToGet = response.status === 301 || response.status === 302 || response.status === 303;
    return readHttps(
      next,
      { ...init, method: switchToGet ? "GET" : method, body: switchToGet ? undefined : init.body },
      redirects + 1,
      nextHeaders,
    );
  }
  const contentType = response.headers.get("content-type") || "";
  const maxBytes = init.maxBytes ?? MOCK_LIMITS.maxFetchedSpecBytes;
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes && init.oversize !== "truncate") {
    await response.body?.cancel();
    throw new HttpError(413, "Response is too large");
  }
  const read = await readCapped(response, maxBytes, init.oversize === "truncate");
  return { status: response.status, contentType, body: read.body, truncated: read.truncated };
}

async function readCapped(
  response: Response,
  maxBytes: number,
  truncate: boolean,
): Promise<{ body: string; truncated: boolean }> {
  if (!response.body) return { body: "", truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (total + value.byteLength > maxBytes) {
      if (!truncate) {
        await reader.cancel();
        throw new HttpError(413, "Response is too large");
      }
      chunks.push(value.slice(0, maxBytes - total));
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const buffer = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (buffer.includes(0)) throw new HttpError(400, "Response is not text");
  return { body: new TextDecoder().decode(buffer), truncated };
}
