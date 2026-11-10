import type { CapturedRequest } from "../shared/api";
import { bodyText, replayHeaders } from "../shared/inspector";
import { fetchPublic, type PublicFetchResult } from "./ssrf";

const REPLAY_BYTES = 64_000;

export async function replayCaptured(
  request: Pick<CapturedRequest, "method" | "headers" | "body">,
  target: string,
): Promise<PublicFetchResult> {
  const method = request.method.toUpperCase();
  const raw = bodyText(request.body);
  return fetchPublic(target, {
    method,
    headers: replayHeaders(request.headers || {}),
    body: raw && method !== "GET" && method !== "HEAD" ? raw.slice(0, REPLAY_BYTES) : undefined,
    maxBytes: REPLAY_BYTES,
    oversize: "truncate",
    timeoutMs: 8000,
  });
}
