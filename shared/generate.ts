import { MOCK_LIMITS } from "./policy";
import type {
  ChaosSpec,
  FieldSpec,
  MockOperation,
  MockSpec,
  PaginationSpec,
} from "./mock-spec";

export interface GenerateInput {
  spec: MockSpec;
  operation: MockOperation;
  query: Record<string, string | undefined>;
  pathParams: Record<string, string>;
  requestIndex: number;
}

export interface GenerateResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  recordCount: number;
  chaosEffects: string[];
  delayMs: number;
  capped: boolean;
}

export function matchOperation(
  spec: MockSpec,
  method: string,
  subpath: string,
): { operation: MockOperation; pathParams: Record<string, string> } | null {
  const path = normalizePath(subpath);
  const verb = method.toUpperCase();
  let best: { operation: MockOperation; pathParams: Record<string, string>; score: number } | null =
    null;
  for (const operation of spec.operations) {
    if (operation.method !== verb && operation.method !== "ANY") continue;
    const matched = matchTemplate(operation.pathTemplate, path);
    if (!matched) continue;
    const score = operation.pathTemplate.length;
    if (!best || score > best.score) {
      best = { operation, pathParams: matched, score };
    }
  }
  return best ? { operation: best.operation, pathParams: best.pathParams } : null;
}

export function generateMockResponse(input: GenerateInput): GenerateResult {
  const { spec, operation } = input;
  const chaosOn = chaosTriggers(spec.chaos, input.requestIndex);
  const effects: string[] = [];
  const rng = mulberry32(hashString(`${spec.chaos.seed}:req:${input.requestIndex}`));

  if (chaosOn && spec.chaos.randomErrors && (onlyErrors(spec.chaos) || rng() < 0.45)) {
    const roll = rng();
    const status = roll < 0.34 ? 429 : roll < 0.67 ? 503 : 500;
    effects.push(`http-${status}`);
    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
      "x-pan-parrot-request": String(input.requestIndex),
      "x-pan-parrot-seed": spec.chaos.seed,
      "x-pan-parrot-effects": effects.join(","),
    };
    if (status === 429 || status === 503) {
      headers["retry-after"] = String(1 + Math.floor(rng() * 5));
      effects[0] = `http-${status}`;
      headers["x-pan-parrot-effects"] = effects.join(",");
    }
    return {
      status,
      headers,
      body: JSON.stringify({
        error: status === 429 ? "Too Many Requests" : "upstream error",
        status,
      }),
      recordCount: 0,
      chaosEffects: effects,
      delayMs: spec.chaos.latency ? 1500 : 0,
      capped: false,
    };
  }

  const page = resolvePage(operation.pagination, input.query, spec.totalRecords, chaosOn ? spec.chaos : null);
  if (chaosOn && spec.chaos.paginationGlitch !== "none") {
    effects.push(`pagination-${spec.chaos.paginationGlitch}`);
  }

  const records: unknown[] = [];
  for (let index = page.start; index < page.start + page.count; index += 1) {
    records.push(
      generateRecord(operation.record, {
        index,
        seed: spec.chaos.seed,
        pathParams: input.pathParams,
        chaos: chaosOn ? spec.chaos : null,
        baseEpoch: page.baseEpoch,
      }),
    );
  }
  if (chaosOn && spec.chaos.outOfOrder && records.length > 1) {
    records.reverse();
    effects.push("out-of-order");
  }
  if (chaosOn && spec.chaos.duplicateRecords && records.length > 0) {
    records.push(structuredClone(records[0]));
    effects.push("duplicate-record");
  }
  if (chaosOn && spec.chaos.missingFields) effects.push("missing-fields");
  if (chaosOn && spec.chaos.mixedTimestamps) effects.push("mixed-timestamps");
  if (chaosOn && spec.chaos.wrongTypes) effects.push("wrong-types");

  let body = encodeBody(operation, records, page);
  let contentType = operation.contentType;
  if (chaosOn && spec.chaos.malformedJson) {
    body = `${body.slice(0, Math.max(1, body.length - 1))}<<<`;
    effects.push("malformed-json");
  } else if (chaosOn && spec.chaos.truncatedJson) {
    body = body.slice(0, Math.max(1, Math.floor(body.length * 0.7)));
    effects.push("truncated-json");
  }
  if (chaosOn && spec.chaos.wrongContentType) {
    contentType = "text/html; charset=utf-8";
    effects.push("wrong-content-type");
  }

  let capped = page.capped;
  if (byteLength(body) > MOCK_LIMITS.maxResponseBytes) {
    capped = true;
    effects.push("size-cap");
    body = trimToBytes(operation, records, page);
  }

  const headers: Record<string, string> = {
    ...operation.headers,
    "content-type": contentType,
    "x-pan-parrot-request": String(input.requestIndex),
    "x-pan-parrot-seed": spec.chaos.seed,
    "x-pan-parrot-records": String(records.length),
  };
  if (capped) headers["x-pan-parrot-page-cap"] = String(MOCK_LIMITS.maxRecordsPerResponse);
  if (effects.length) headers["x-pan-parrot-effects"] = effects.join(",");

  return {
    status: operation.status,
    headers,
    body,
    recordCount: records.length,
    chaosEffects: effects,
    delayMs: chaosOn && spec.chaos.latency ? 2000 : 0,
    capped,
  };
}

interface PagePlan {
  start: number;
  count: number;
  next: number | null;
  capped: boolean;
  baseEpoch: number;
  requestedLimit: number;
}

function resolvePage(
  pagination: PaginationSpec,
  query: Record<string, string | undefined>,
  totalRecords: number,
  chaos: ChaosSpec | null,
): PagePlan {
  const from = Number(query.from);
  const baseEpoch = Number.isFinite(from) && from > 1_000_000_000 ? Math.floor(from) : 1_700_000_000;
  const requested = clamp(
    Number(query[pagination.limitParam] ?? pagination.defaultLimit),
    1,
    pagination.maxLimit,
  );
  const capped = requested < Number(query[pagination.limitParam] ?? requested);
  let start = 0;
  if (pagination.style === "page") {
    const page = Math.max(1, Math.floor(Number(query[pagination.pageParam] || 1)));
    start = (page - 1) * requested;
  } else if (pagination.style === "cursor") {
    start = decodeToken(query[pagination.cursorParam]);
  } else if (pagination.style === "offset") {
    start = decodeToken(query[pagination.offsetParam]);
  }

  if (chaos?.paginationGlitch === "skip") start += requested;
  const endless = chaos?.paginationGlitch === "endless";
  const repeat = chaos?.paginationGlitch === "repeat";
  const ceiling = endless ? Number.MAX_SAFE_INTEGER : totalRecords;
  if (!endless && start >= totalRecords) {
    return { start, count: 0, next: null, capped, baseEpoch, requestedLimit: requested };
  }
  const room = endless ? requested : Math.max(0, ceiling - start);
  const count = Math.min(requested, room);
  let next = start + count;
  if (repeat) next = start;
  if (!endless && next >= totalRecords) next = -1;
  return {
    start,
    count,
    next: next < 0 ? null : next,
    capped,
    baseEpoch,
    requestedLimit: requested,
  };
}

function encodeBody(operation: MockOperation, records: unknown[], page: PagePlan): string {
  if (!operation.list) {
    return JSON.stringify(records[0] ?? {});
  }
  const envelope = operation.envelope;
  if (envelope.type === "ndjson") {
    const lines = records.map((record) => JSON.stringify(record));
    if (envelope.trailer === "akamai-offset") {
      if (records.length === 0) return '{ "total": 0 }';
      lines.push(
        `{ "total": ${records.length}, "offset": "${encodeToken(page.next ?? page.start + records.length)}", "limit": ${records.length} }`,
      );
    }
    return lines.join("\n");
  }
  if (envelope.type === "wrapped") {
    const body: Record<string, unknown> = { [envelope.arrayKey]: records };
    if (page.next != null) body.nextOffset = encodeToken(page.next);
    body.limit = records.length;
    return JSON.stringify(body);
  }
  if (envelope.type === "array") return JSON.stringify(records);
  return JSON.stringify(records[0] ?? {});
}

function trimToBytes(operation: MockOperation, records: unknown[], page: PagePlan): string {
  let kept = records.slice();
  let body = encodeBody(operation, kept, page);
  while (kept.length > 1 && byteLength(body) > MOCK_LIMITS.maxResponseBytes) {
    kept = kept.slice(0, Math.ceil(kept.length / 2));
    body = encodeBody(operation, kept, page);
  }
  return body;
}

interface RecordCtx {
  index: number;
  seed: string;
  pathParams: Record<string, string>;
  chaos: ChaosSpec | null;
  baseEpoch: number;
  path: string;
}

function generateRecord(field: FieldSpec, ctx: Omit<RecordCtx, "path">): unknown {
  return generateField(field, { ...ctx, path: field.name });
}

function generateField(field: FieldSpec, ctx: RecordCtx): unknown {
  const rng = mulberry32(hashString(`${ctx.seed}:${ctx.index}:${ctx.path}`));
  const param = paramValue(field.name, ctx.pathParams);
  if (param && field.kind !== "object" && field.kind !== "array") {
    return field.kind === "integer" ? Number(param.split(";")[0]) || param : param.split(";")[0];
  }
  if (ctx.chaos?.wrongTypes && rng() < 0.5 && field.kind !== "object" && field.kind !== "array") {
    return null;
  }
  switch (field.kind) {
    case "object": {
      const out: Record<string, unknown> = {};
      for (const child of field.children ?? []) {
        const childCtx = { ...ctx, path: `${ctx.path}.${child.name}` };
        if (shouldDrop(child, childCtx)) continue;
        out[child.name] = generateField(child, childCtx);
      }
      return out;
    }
    case "array": {
      const item = field.item;
      if (!item) return [];
      const count = clamp(field.minItems ?? 1, 0, field.maxItems ?? 2);
      return Array.from({ length: count }, (_, itemIndex) =>
        generateField(item, { ...ctx, path: `${ctx.path}[${itemIndex}]`, index: ctx.index * 10 + itemIndex }),
      );
    }
    case "const":
      return field.constValue ?? field.example ?? "";
    case "enum": {
      const values = field.enumValues ?? ["unknown"];
      return values[ctx.index % values.length];
    }
    case "boolean":
      return ctx.index % 2 === 0;
    case "integer":
      return ctx.index + 1;
    case "number":
      return ctx.index + 0.5;
    case "uuid":
      return uuidFrom(hashString(`${ctx.seed}:${ctx.index}:${ctx.path}`));
    case "id":
      return `${field.name}_${ctx.index.toString(16).padStart(6, "0")}`;
    case "ip":
      return `${198 + (ctx.index % 2)}.51.${(ctx.index >> 8) & 255}.${(ctx.index & 255) || 1}`;
    case "email":
      return `user${ctx.index}@example.com`;
    case "timestamp":
      return formatTime(ctx.baseEpoch + ctx.index, field.format, ctx, rng);
    case "string":
      if (field.format === "akamai-rule") {
        const labels = field.enumValues?.length
          ? field.enumValues
          : ["deny", "alert", "Custom_RegEX_Rule"];
        return akamaiRule(labels[ctx.index % labels.length]);
      }
      if (field.example) return field.example;
      return `${field.name}-${ctx.index}`;
    default:
      return field.example ?? "";
  }
}

function shouldDrop(field: FieldSpec, ctx: RecordCtx): boolean {
  if (!ctx.chaos?.missingFields) return false;
  if (field.kind === "timestamp") return true;
  return /time|date|^start$/i.test(field.name);
}

function formatTime(
  epochSeconds: number,
  format: FieldSpec["format"],
  ctx: RecordCtx,
  rng: () => number,
): string | number {
  const formats = ["unix-string", "iso", "unix", "unix-ms"] as const;
  const chosen =
    ctx.chaos?.mixedTimestamps ? formats[Math.floor(rng() * formats.length)] : format || "iso";
  const ms = epochSeconds * 1000;
  if (chosen === "unix") return epochSeconds;
  if (chosen === "unix-ms") return ms;
  if (chosen === "unix-string") return String(epochSeconds);
  const iso = new Date(ms).toISOString().replace(".000Z", "Z");
  if (ctx.chaos?.mixedTimestamps && rng() < 0.3) return iso.replace("Z", "+00:00");
  return iso;
}

function chaosTriggers(chaos: ChaosSpec, requestIndex: number): boolean {
  if (!chaos.enabled) return false;
  if (chaos.mode === "every-nth") return requestIndex % chaos.everyNth === 0;
  const rng = mulberry32(hashString(`${chaos.seed}:gate:${requestIndex}`));
  return rng() < chaos.probability;
}

function onlyErrors(chaos: ChaosSpec): boolean {
  return (
    chaos.randomErrors &&
    !chaos.duplicateRecords &&
    !chaos.missingFields &&
    !chaos.mixedTimestamps &&
    !chaos.outOfOrder &&
    !chaos.wrongTypes &&
    !chaos.truncatedJson &&
    !chaos.malformedJson &&
    !chaos.wrongContentType &&
    chaos.paginationGlitch === "none"
  );
}

export function encodeToken(index: number): string {
  return `pp_${Math.max(0, index).toString(36)}`;
}

export function decodeToken(value: string | undefined): number {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const matched = /^pp_([0-9a-z]+)$/i.exec(value.trim());
  if (!matched) return 0;
  const parsed = Number.parseInt(matched[1], 36);
  return Number.isFinite(parsed) ? parsed : 0;
}

function matchTemplate(template: string, path: string): Record<string, string> | null {
  const expected = template.split("/").filter(Boolean);
  const actual = path.split("/").filter(Boolean);
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < expected.length; i += 1) {
    const tokenPart = expected[i];
    if (tokenPart.startsWith("{") && tokenPart.endsWith("}")) {
      params[tokenPart.slice(1, -1)] = decodeURIComponent(actual[i]);
    } else if (tokenPart !== actual[i]) {
      return null;
    }
  }
  return params;
}

function normalizePath(path: string): string {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) return withSlash.slice(0, -1);
  return withSlash || "/";
}

function paramValue(name: string, params: Record<string, string>): string | undefined {
  if (params[name]) return params[name];
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(params)) {
    if (key.toLowerCase() === lower) return value;
    if (lower.startsWith(key.toLowerCase().replace(/s$/, ""))) return value;
  }
  return undefined;
}

function akamaiRule(label: string): string {
  const bytes = new TextEncoder().encode(label);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return encodeURIComponent(btoa(binary));
}

function uuidFrom(seed: number): string {
  const hex = (seed >>> 0).toString(16).padStart(8, "0");
  const tail = (~seed >>> 0).toString(16).padStart(8, "0");
  return `${hex.slice(0, 8)}-${tail.slice(0, 4)}-4${tail.slice(4, 7)}-a${hex.slice(0, 3)}-${(hex + tail).slice(0, 12)}`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
