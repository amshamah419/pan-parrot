const SENSITIVE_REQUEST_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "proxy-authorization",
  "x-csrf-token",
  "x-forwarded-authorization",
  "x-amz-security-token",
]);

const BLOCKED_MOCK_HEADERS = new Set([
  ...SENSITIVE_REQUEST_HEADERS,
  "content-security-policy",
  "content-security-policy-report-only",
  "strict-transport-security",
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-expose-headers",
  "x-frame-options",
  "report-to",
  "nel",
  "cross-origin-opener-policy",
  "cross-origin-embedder-policy",
  "cross-origin-resource-policy",
  "permissions-policy",
  "referrer-policy",
  "x-content-type-options",
  "x-robots-tag",
  "content-length",
  "transfer-encoding",
  "connection",
  "host",
  "trailer",
  "upgrade",
  "www-authenticate",
  "proxy-authenticate",
]);

export function redactHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  let count = 0;
  headers.forEach((value, key) => {
    if (count >= 40) return;
    const name = key.toLowerCase();
    const clipped =
      value.length > 2048 ? `${value.slice(0, 2048)}…[truncated]` : value;
    const sensitive =
      SENSITIVE_REQUEST_HEADERS.has(name) ||
      /api-key|token|secret|password|authorization|signature/.test(name);
    out[name] = sensitive ? "[redacted]" : clipped;
    count += 1;
  });
  return out;
}

export function clampQuery(
  query: Record<string, string | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  let count = 0;
  for (const [key, value] of Object.entries(query)) {
    if (count >= 40 || value === undefined) continue;
    out[key.slice(0, 128)] = value.slice(0, 2048);
    count += 1;
  }
  return out;
}

export function bodyForStorage(
  text: string,
  contentType: string | null,
): unknown {
  if (!text) return null;
  if (text.includes("\u0000")) return { omitted: "non-text body" };
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (
    type &&
    !type.includes("json") &&
    !type.startsWith("text/") &&
    type !== "application/x-www-form-urlencoded" &&
    !type.includes("xml") &&
    type !== "application/graphql"
  ) {
    return { omitted: "unsupported content type", contentType: type.slice(0, 120) };
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export function sanitizeMockHeaders(
  input: unknown,
): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const out: Record<string, string> = Object.create(null);
  let count = 0;
  for (const [rawKey, rawValue] of Object.entries(
    input as Record<string, unknown>,
  )) {
    if (count >= 20) break;
    const key = rawKey.toLowerCase().trim();
    if (!/^[a-z0-9-]{1,64}$/.test(key)) continue;
    if (BLOCKED_MOCK_HEADERS.has(key)) continue;
    if (typeof rawValue !== "string") continue;
    if (rawValue.length > 1024 || /[\r\n]/.test(rawValue)) continue;
    if (key === "location" && /^\s*(javascript|data):/i.test(rawValue)) continue;
    out[key] = rawValue;
    count += 1;
  }
  return out;
}
