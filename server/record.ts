import { MOCK_LIMITS } from "../shared/policy";
import { recordedStepName, scrubRecording, type RecordedFixture } from "../shared/recording";
import { HttpError } from "./http";
import { assertPublicHttpsUrl, fetchPublic, type PublicFetchInit, type PublicFetchResult } from "./ssrf";

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const BLOCKED_OUTBOUND = new Set([
  "host",
  "content-length",
  "transfer-encoding",
  "connection",
  "upgrade",
  "te",
  "trailer",
  "keep-alive",
  "proxy-authorization",
  "proxy-connection",
]);
const TEXT_TYPE = /json|xml|text\/|yaml|graphql|x-www-form-urlencoded|javascript/;

export type { RecordedFixture };

export function outboundHeaders(input: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;
  for (const [rawKey, rawValue] of Object.entries(input)) {
    if (Object.keys(out).length >= 8) break;
    if (typeof rawValue !== "string") continue;
    const key = rawKey.toLowerCase().trim();
    if (!/^[a-z0-9-]{1,40}$/.test(key) || BLOCKED_OUTBOUND.has(key)) continue;
    const value = rawValue.trim();
    if (!value || value.length > 2048 || /[\r\n]/.test(value)) continue;
    out[key] = value;
  }
  return out;
}

export async function recordUpstream(
  input: { url: string; method?: string; headers?: Record<string, string>; body?: string },
  exchange: (raw: string, init?: PublicFetchInit) => Promise<PublicFetchResult> = fetchPublic,
): Promise<RecordedFixture> {
  const method = (input.method || "GET").toUpperCase();
  if (!METHODS.has(method)) throw new HttpError(400, "Method is not allowed");
  assertPublicHttpsUrl(input.url);
  const headers = outboundHeaders(input.headers);
  const body = input.body?.slice(0, 16_384);
  const result = await exchange(input.url, {
    method,
    headers,
    body: method === "GET" ? undefined : body,
    accept: "application/json, application/xml, text/xml, text/plain, */*",
    maxBytes: 64_000,
    oversize: "truncate",
  });
  const type = result.contentType.split(";")[0].trim().toLowerCase();
  if (type && !TEXT_TYPE.test(type)) {
    throw new HttpError(400, "Upstream response is not text");
  }
  const scrubbed = scrubRecording(result.body, result.contentType);
  const status = clampStatus(result.status);
  return {
    status,
    contentType: result.contentType.slice(0, 120),
    body: scrubbed.body,
    truncated: result.truncated || scrubbed.truncated,
    step: {
      name: recordedStepName(method, input.url),
      status,
      body: scrubbed.body.slice(0, MOCK_LIMITS.maxScenarioBodyBytes),
    },
  };
}

function clampStatus(status: number): number {
  if (!Number.isInteger(status) || status < 100 || status > 599) return 502;
  return status;
}
