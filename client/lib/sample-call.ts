import type { MockAuth } from "@shared/mock-spec";

/** Headers a local curl can send. Signature schemes need format-only mode first. */
export function sampleHeaders(auth: MockAuth | undefined): Record<string, string> {
  if (!auth || auth.mode === "none") return {};
  if (auth.mode === "bearer" && auth.bearer?.token) {
    return { authorization: `Bearer ${auth.bearer.token}` };
  }
  if (auth.mode === "basic" && auth.basic) {
    const token = btoa(`${auth.basic.username}:${auth.basic.password}`);
    return { authorization: `Basic ${token}` };
  }
  if (auth.mode === "api-key" && auth.apiKey?.in === "header") {
    return { [auth.apiKey.name]: auth.apiKey.value };
  }
  if (auth.mode === "edgegrid" && auth.edgegrid?.verify === "format-only") {
    return {
      authorization: `EG1-HMAC-SHA256 client_token=${auth.edgegrid.clientToken};access_token=${auth.edgegrid.accessToken};timestamp=20240101T00:00:00+0000;nonce=local;signature=dummy`,
    };
  }
  return {};
}
