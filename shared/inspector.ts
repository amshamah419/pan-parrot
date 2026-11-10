import type { CapturedRequest } from "./api";

export interface InspectorFilters {
  search: string;
  method: string;
  status: string;
  path: string;
  header: string;
  body: string;
}

export const emptyInspectorFilters: InspectorFilters = {
  search: "",
  method: "all",
  status: "",
  path: "",
  header: "",
  body: "",
};

const HOP_HEADERS = new Set([
  "host",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "upgrade",
  "te",
  "trailer",
  "accept-encoding",
]);

export function bodyText(body: unknown): string {
  if (body == null) return "";
  if (typeof body === "string") return body;
  if (
    typeof body === "object" &&
    body &&
    "raw" in body &&
    typeof (body as { raw?: unknown }).raw === "string"
  ) {
    return (body as { raw: string }).raw;
  }
  return JSON.stringify(body);
}

export function replayHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const name = key.toLowerCase();
    if (HOP_HEADERS.has(name)) continue;
    if (value === "[redacted]" || value.includes("[redacted]")) continue;
    out[name] = value;
  }
  return out;
}

export function requestUrl(
  request: Pick<CapturedRequest, "endpoint" | "query">,
  origin: string,
): string {
  const url = new URL(request.endpoint, origin);
  for (const [key, value] of Object.entries(request.query || {})) {
    if (!url.searchParams.has(key)) url.searchParams.append(key, value);
  }
  return url.toString();
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function toCurl(
  request: Pick<CapturedRequest, "method" | "endpoint" | "query" | "headers" | "body">,
  origin: string,
): string {
  const lines = [`curl -X ${request.method} ${shellQuote(requestUrl(request, origin))}`];
  for (const [key, value] of Object.entries(replayHeaders(request.headers || {}))) {
    lines.push(`  -H ${shellQuote(`${key}: ${value}`)}`);
  }
  const raw = bodyText(request.body);
  if (raw && request.method !== "GET" && request.method !== "HEAD") {
    lines.push(`  --data ${shellQuote(raw)}`);
  }
  return lines.join(" \\\n");
}

export function toPythonRequests(
  request: Pick<CapturedRequest, "method" | "endpoint" | "query" | "headers" | "body">,
  origin: string,
): string {
  const headers = replayHeaders(request.headers || {});
  const raw = bodyText(request.body);
  const lines = [
    "import requests",
    "",
    "response = requests.request(",
    `    ${JSON.stringify(request.method)},`,
    `    ${JSON.stringify(requestUrl(request, origin))},`,
  ];
  const headerLines = Object.entries(headers).map(
    ([key, value]) => `        ${JSON.stringify(key)}: ${JSON.stringify(value)},`,
  );
  if (headerLines.length) {
    lines.push("    headers={", ...headerLines, "    },");
  }
  if (raw && request.method !== "GET" && request.method !== "HEAD") {
    lines.push(`    data=${JSON.stringify(raw)},`);
  }
  lines.push(")", "print(response.status_code)", "print(response.text)");
  return lines.join("\n");
}

function includes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

export function matchesInspector(request: CapturedRequest, filters: InspectorFilters): boolean {
  if (filters.method !== "all" && request.method.toUpperCase() !== filters.method.toUpperCase()) {
    return false;
  }
  if (filters.status.trim() && !includes(String(request.status), filters.status)) return false;
  if (filters.path.trim() && !includes(request.endpoint, filters.path)) return false;
  if (filters.header.trim()) {
    const hit = Object.entries(request.headers || {}).some(([key, value]) =>
      includes(`${key}: ${value}`, filters.header),
    );
    if (!hit) return false;
  }
  if (filters.body.trim() && !includes(bodyText(request.body), filters.body)) return false;
  if (filters.search.trim()) {
    const blob = [
      request.method,
      String(request.status),
      request.endpoint,
      ...Object.entries(request.headers || {}).map(([key, value]) => `${key} ${value}`),
      bodyText(request.body),
    ].join("\n");
    if (!includes(blob, filters.search)) return false;
  }
  return true;
}

export interface DiffRow {
  left: string;
  right: string;
  kind: "same" | "add" | "remove";
}

export function callSnapshot(request: CapturedRequest): string {
  const headers = Object.entries(request.headers || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}: ${value}`);
  return [
    `${request.method} ${request.endpoint}`,
    `status ${request.status}`,
    ...headers,
    "---",
    bodyText(request.body) || "(empty body)",
  ].join("\n");
}

export function lineDiff(leftText: string, rightText: string): DiffRow[] {
  const left = leftText.split("\n").slice(0, 200);
  const right = rightText.split("\n").slice(0, 200);
  const n = left.length;
  const m = right.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = left[i] === right[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      rows.push({ left: left[i], right: right[j], kind: "same" });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ left: left[i], right: "", kind: "remove" });
      i += 1;
    } else {
      rows.push({ left: "", right: right[j], kind: "add" });
      j += 1;
    }
  }
  while (i < n) {
    rows.push({ left: left[i], right: "", kind: "remove" });
    i += 1;
  }
  while (j < m) {
    rows.push({ left: "", right: right[j], kind: "add" });
    j += 1;
  }
  return rows;
}

export type ThemeChoice = "system" | "light" | "dark";

export function themeIsDark(choice: ThemeChoice, systemDark: boolean): boolean {
  if (choice === "dark") return true;
  if (choice === "light") return false;
  return systemDark;
}

export function nextTheme(choice: ThemeChoice): ThemeChoice {
  if (choice === "system") return "light";
  if (choice === "light") return "dark";
  return "system";
}
