import { MOCK_LIMITS } from "./policy";

export interface RecordedFixture {
  status: number;
  contentType: string;
  body: string;
  truncated: boolean;
  step: { name: string; status: number; body: string };
}

const SECRET_KEY =
  /api[-_]?key|token|secret|password|credential|authorization|cookie|private[-_]?key|access[-_]?key|refresh[-_]?token|email|phone|ssn/i;

/** Replace obvious secrets and contact details in a recorded response. */
export function scrubText(text: string): string {
  return text
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, "[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[redacted]")
    .replace(/\b(?:\+?1[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g, "[redacted-phone]")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 [redacted]");
}

export function scrubValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => scrubValue(item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) ? "[redacted]" : scrubValue(child);
    }
    return out;
  }
  if (typeof value === "string") return scrubText(value);
  return value;
}

export function scrubRecording(text: string, contentType: string): { body: string; truncated: boolean } {
  const type = contentType.toLowerCase();
  const trimmed = text.trim();
  if (type.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return fitJson(scrubValue(JSON.parse(text) as unknown), MOCK_LIMITS.maxScenarioBodyBytes);
    } catch {
      // Keep the scrubbed text when the body is not JSON.
    }
  }
  const cleaned = scrubText(text).replace(
    /<(key|password|apikey|apiKey|token)>([^<]*)<\/\1>/gi,
    "<$1>[redacted]</$1>",
  );
  if (cleaned.length <= MOCK_LIMITS.maxScenarioBodyBytes) return { body: cleaned, truncated: false };
  return { body: cleaned.slice(0, MOCK_LIMITS.maxScenarioBodyBytes), truncated: true };
}

export function recordedStepName(method: string, rawUrl: string): string {
  let path = "/";
  try {
    path = new URL(rawUrl).pathname || "/";
  } catch {
    path = "/";
  }
  return `Recorded ${method.toUpperCase()} ${scrubText(path)}`.slice(0, 80);
}

function fitJson(value: unknown, max: number): { body: string; truncated: boolean } {
  const full = JSON.stringify(value);
  if (full.length <= max) return { body: full, truncated: false };
  if (Array.isArray(value)) {
    const kept: unknown[] = [];
    for (const item of value) {
      if (JSON.stringify([...kept, item]).length > max) break;
      kept.push(item);
    }
    const body = JSON.stringify(kept);
    if (body.length <= max) return { body, truncated: true };
  }
  let room = Math.max(0, max - 40);
  while (room > 0) {
    const body = JSON.stringify({ truncated: true, recorded: full.slice(0, room) });
    if (body.length <= max) return { body, truncated: true };
    room -= body.length - max;
  }
  return { body: "{}", truncated: true };
}
