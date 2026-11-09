import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { MOCK_LIMITS } from "../shared/policy";
import { HttpError } from "./http";

export function assertPublicHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, "Spec URL is not a valid URL");
  }
  if (url.protocol !== "https:") {
    throw new HttpError(400, "Spec URLs must use https");
  }
  if (url.username || url.password) {
    throw new HttpError(400, "Spec URLs must not include credentials");
  }
  if (url.port && url.port !== "443") {
    throw new HttpError(400, "Spec URLs must use port 443");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw new HttpError(400, "Spec URL host is not allowed");
  }
  if (isIP(host) && isBlockedAddress(host)) {
    throw new HttpError(400, "Spec URL address is not allowed");
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

export async function fetchPublicSpec(raw: string): Promise<string> {
  const url = assertPublicHttpsUrl(raw);
  if (!isIP(url.hostname)) {
    const records = await lookup(url.hostname, { all: true, verbatim: true });
    if (records.length === 0 || records.some((record) => isBlockedAddress(record.address))) {
      throw new HttpError(400, "Spec URL resolves to a blocked address");
    }
  }
  return readHttps(url, 0);
}

async function readHttps(url: URL, redirects: number): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: { accept: "application/json, application/yaml, text/yaml, */*" },
    signal: AbortSignal.timeout(8000),
  });
  if (response.status >= 300 && response.status < 400) {
    if (redirects >= 2) throw new HttpError(400, "Too many redirects fetching the spec");
    const location = response.headers.get("location");
    if (!location) throw new HttpError(400, "Redirect missing a location");
    const next = new URL(location, url);
    assertPublicHttpsUrl(next.toString());
    return readHttps(next, redirects + 1);
  }
  if (!response.ok) throw new HttpError(400, "Could not download the API spec");
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MOCK_LIMITS.maxFetchedSpecBytes) {
    throw new HttpError(413, "API spec is too large");
  }
  const text = await response.text();
  if (text.length > MOCK_LIMITS.maxFetchedSpecBytes) {
    throw new HttpError(413, "API spec is too large");
  }
  return text;
}
