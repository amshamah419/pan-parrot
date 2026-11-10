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

export function awsQueryErrorXml(code: string, message: string, requestId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><ErrorResponse><Error><Type>Sender</Type><Code>${escapeXml(code)}</Code><Message>${escapeXml(message)}</Message></Error><RequestId>${escapeXml(requestId)}</RequestId></ErrorResponse>`;
}

export function renderAwsQueryXml(input: {
  envelope: AwsQueryEnvelope;
  records: unknown[];
  nextToken: string | null;
  requestId: string;
}): string {
  const { envelope } = input;
  const result = envelope.result ?? "list";
  const paging =
    result === "list"
      ? envelope.paging === "nextToken"
        ? input.nextToken
          ? `<nextToken>${escapeXml(input.nextToken)}</nextToken>`
          : ""
        : `<IsTruncated>${input.nextToken ? "true" : "false"}</IsTruncated>${
            input.nextToken ? `<Marker>${escapeXml(input.nextToken)}</Marker>` : ""
          }`
      : "";
  const payload = renderAwsPayload(envelope, input.records, result);
  const request =
    envelope.protocol === "ec2"
      ? `<requestId>${escapeXml(input.requestId)}</requestId>`
      : `<ResponseMetadata><RequestId>${escapeXml(input.requestId)}</RequestId></ResponseMetadata>`;
  const inner =
    envelope.protocol === "ec2"
      ? `${request}${payload}${paging}`
      : `<${envelope.action}Result>${payload}${paging}</${envelope.action}Result>${request}`;
  return `<?xml version="1.0" encoding="UTF-8"?><${envelope.action}Response xmlns="${escapeXml(envelope.namespace)}">${inner}</${envelope.action}Response>`;
}

function renderAwsPayload(envelope: AwsQueryEnvelope, records: unknown[], result: NonNullable<AwsQueryEnvelope["result"]> | "list"): string {
  if (result === "empty") return "";
  if (result === "structure") {
    const record = records[0];
    if (!record || typeof record !== "object" || Array.isArray(record)) return "";
    return Object.entries(record as Record<string, unknown>)
      .map(([key, value]) => renderNode(key, value, "member"))
      .join("");
  }
  if (result === "flattened") {
    return records.map((record) => renderNode(envelope.listElement, record, "member")).join("");
  }
  const items = records.map((record) => renderNode(envelope.itemElement, record, envelope.itemElement)).join("");
  return `<${envelope.listElement}>${items}</${envelope.listElement}>`;
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

const JSON_CONTROLS = ["MaxNumberOfMessages", "MaxResults", "QueueUrl", "ReceiptHandle", "RoleArn", "RoleSessionName"];

/** A few modeled fields from an aws-json body. The rest of the object is not a query string. */
export function jsonControlParams(body: string | undefined): Record<string, string> {
  if (!body || !body.trim().startsWith("{")) return {};
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const key of JSON_CONTROLS) {
      const value = parsed[key];
      if (typeof value === "string" || typeof value === "number") out[key] = String(value).slice(0, 2_000);
    }
    return out;
  } catch {
    return {};
  }
}

function decodeForm(value: string): string {
  const spaced = value.replace(/\+/g, " ");
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
}
