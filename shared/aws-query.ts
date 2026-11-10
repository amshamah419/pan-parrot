import type { AwsQueryEnvelope } from "./mock-spec";
import { escapeXml } from "./xml";

const FORM_PAIRS = 40;

/** application/x-www-form-urlencoded fields. JSON and XML bodies are left alone. */
export function formParams(body: string | undefined): Record<string, string> {
  if (!body) return {};
  const trimmed = body.trim();
  if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("<") || trimmed.startsWith("[")) return {};
  if (!trimmed.includes("=")) return {};
  const out: Record<string, string> = {};
  for (const part of trimmed.split("&").slice(0, FORM_PAIRS)) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = decodeForm(part.slice(0, eq)).slice(0, 80);
    const value = decodeForm(part.slice(eq + 1)).slice(0, 2_000);
    if (key) out[key] = value;
  }
  return out;
}

export function awsRequestId(seed: string, requestIndex: number): string {
  let hash = 2166136261;
  const value = `${seed}:${requestIndex}`;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  const tail = (~hash >>> 0).toString(16).padStart(8, "0");
  return `${hex}-${tail.slice(0, 4)}-4${tail.slice(4, 7)}-8${hex.slice(0, 3)}-${(hex + tail).slice(0, 12)}`;
}

export function renderAwsQueryXml(input: {
  envelope: AwsQueryEnvelope;
  records: unknown[];
  nextToken: string | null;
  requestId: string;
}): string {
  const { envelope } = input;
  const items = input.records.map((record) => renderNode(envelope.itemElement, record, envelope.itemElement)).join("");
  const list = `<${envelope.listElement}>${items}</${envelope.listElement}>`;
  const paging =
    envelope.paging === "nextToken"
      ? input.nextToken
        ? `<nextToken>${escapeXml(input.nextToken)}</nextToken>`
        : ""
      : `<IsTruncated>${input.nextToken ? "true" : "false"}</IsTruncated>${
          input.nextToken ? `<Marker>${escapeXml(input.nextToken)}</Marker>` : ""
        }`;
  const request =
    envelope.protocol === "ec2"
      ? `<requestId>${escapeXml(input.requestId)}</requestId>`
      : `<ResponseMetadata><RequestId>${escapeXml(input.requestId)}</RequestId></ResponseMetadata>`;
  const inner =
    envelope.protocol === "ec2"
      ? `${request}${list}${paging}`
      : `<${envelope.action}Result>${list}${paging}</${envelope.action}Result>${request}`;
  return `<?xml version="1.0" encoding="UTF-8"?><${envelope.action}Response xmlns="${escapeXml(envelope.namespace)}">${inner}</${envelope.action}Response>`;
}

function renderNode(name: string, value: unknown, itemName: string): string {
  const tag = xmlName(name);
  if (value == null) return "";
  if (Array.isArray(value)) {
    return `<${tag}>${value.map((entry) => renderNode(itemName, entry, itemName)).join("")}</${tag}>`;
  }
  if (typeof value === "object") {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => renderNode(key, entry, itemName))
      .join("");
    return `<${tag}>${inner}</${tag}>`;
  }
  return `<${tag}>${escapeXml(String(value))}</${tag}>`;
}

function xmlName(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_.:-]/g, "");
  if (!cleaned || !/^[A-Za-z_:]/.test(cleaned)) return "field";
  return cleaned;
}

function decodeForm(value: string): string {
  const spaced = value.replace(/\+/g, " ");
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
}
