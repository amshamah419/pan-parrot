import type { MockAuth, MockOperation } from "@shared/mock-spec";

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

/** The button next to the try URL. POST query-protocol mocks send Action as a form body. */
export function sampleRequest(
  operation: MockOperation,
  auth: MockAuth | undefined,
): { method: string; headers: Record<string, string>; body?: string } {
  const method = operation.method === "ANY" ? "GET" : operation.method;
  const headers = { ...sampleHeaders(auth) };
  for (const [name, value] of Object.entries(operation.headerMatch || {})) {
    if (value) headers[name] = value;
  }
  const rules = operation.queryMatch || {};
  if (method === "GET" || method === "HEAD" || Object.keys(rules).length === 0) return { method, headers };
  const form = new URLSearchParams(rules);
  if (operation.pagination.style !== "none") form.set(operation.pagination.limitParam, "2");
  headers["content-type"] = "application/x-www-form-urlencoded";
  return { method, headers, body: form.toString() };
}
