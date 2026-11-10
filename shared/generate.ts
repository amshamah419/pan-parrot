import { bodyMatches } from "./body-match";
import { answerGraphql, graphqlRequestName } from "./graphql-mock";
import { MOCK_LIMITS } from "./policy";
import { renderFieldXml, soapEnvelope } from "./xml";
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
  /** Absolute URL of this request without the query string, used for Link / nextLink. */
  requestUrl?: string;
  soapAction?: string;
  requestElement?: string;
  /** Raw request body. GraphQL operations read query, variables, and operationName from it. */
  body?: string;
}

export interface PackedFile {
  name: string;
  text: string;
}

export interface GenerateResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  recordCount: number;
  chaosEffects: string[];
  delayMs: number;
  dripMs: number;
  stream: boolean;
  capped: boolean;
  pack?: {
    format: "zip" | "gzip" | "octet";
    filename: string;
    entries: PackedFile[];
  };
}

export function matchOperation(
  spec: MockSpec,
  method: string,
  subpath: string,
  query: Record<string, string | undefined> = {},
  hint: {
    soapAction?: string;
    requestElement?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): { operation: MockOperation; pathParams: Record<string, string> } | null {
  const path = normalizePath(subpath);
  const verb = method.toUpperCase();
  const specific: Array<{ operation: MockOperation; pathParams: Record<string, string>; score: number }> = [];
  const defaults: typeof specific = [];
  for (const operation of spec.operations) {
    if (operation.method !== verb && operation.method !== "ANY") continue;
    const matched = matchTemplate(operation.pathTemplate, path);
    if (!matched) continue;
    const score = scoreOperation(operation, hint);
    if (rulesMatch(operation, query, hint)) {
      if (hasRules(operation)) specific.push({ operation, pathParams: matched, score });
      else defaults.push({ operation, pathParams: matched, score });
    }
  }
  if (specific.length) return best(specific);
  const fallback = defaults.filter((item) => item.operation.fallback);
  if (fallback.length) return best(fallback);
  return best(defaults);
}

function best(
  items: Array<{ operation: MockOperation; pathParams: Record<string, string>; score: number }>,
): { operation: MockOperation; pathParams: Record<string, string> } | null {
  if (!items.length) return null;
  items.sort((a, b) => b.score - a.score);
  return { operation: items[0].operation, pathParams: items[0].pathParams };
}

function hasRules(operation: MockOperation): boolean {
  return Boolean(
    (operation.queryMatch && Object.keys(operation.queryMatch).length) ||
      (operation.headerMatch && Object.keys(operation.headerMatch).length) ||
      operation.bodyMatch?.path ||
      operation.graphqlOperation,
  );
}

function rulesMatch(
  operation: MockOperation,
  query: Record<string, string | undefined>,
  hint: { headers?: Record<string, string>; body?: string },
): boolean {
  const expected = operation.queryMatch;
  if (expected && !Object.entries(expected).every(([key, value]) => query[key] === value)) return false;
  const headers = operation.headerMatch;
  if (headers) {
    for (const [name, value] of Object.entries(headers)) {
      const presented = hint.headers?.[name.toLowerCase()];
      if (presented == null || presented === "") return false;
      if (value && presented !== value) return false;
    }
  }
  if (operation.bodyMatch?.path && !bodyMatches(hint.body || "", operation.bodyMatch)) return false;
  if (operation.graphqlOperation && graphqlRequestName(hint.body) !== operation.graphqlOperation) return false;
  return true;
}

function scoreOperation(
  operation: MockOperation,
  hint: { soapAction?: string; requestElement?: string },
): number {
  let score = (operation.priority || 0) * 10_000 + operation.pathTemplate.length;
  score += Object.keys(operation.queryMatch || {}).length * 20;
  score += Object.keys(operation.headerMatch || {}).length * 20;
  if (operation.bodyMatch?.path) score += 50;
  if (operation.graphqlOperation) score += 80;
  if (hasRules(operation)) score += 5_000;
  if (hint.soapAction && operation.soapAction && operation.soapAction === hint.soapAction) score += 500;
  if (hint.requestElement && operation.requestElement && operation.requestElement === hint.requestElement) {
    score += 400;
  }
  if (operation.soapAction && hint.soapAction && operation.soapAction !== hint.soapAction) score -= 300;
  return score;
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
      dripMs: 0,
      stream: false,
      delayMs: spec.chaos.latency ? 1500 : 0,
      capped: false,
    };
  }

  if (operation.envelope.type === "graphql") {
    const answered = answerGraphql({
      spec,
      operation,
      body: input.body,
      chaos: chaosOn && spec.chaos.graphqlErrors ? spec.chaos : null,
    });
    return {
      status: answered.status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-pan-parrot-request": String(input.requestIndex),
        "x-pan-parrot-seed": spec.chaos.seed,
        "x-pan-parrot-records": String(answered.recordCount),
        ...(answered.effects.length ? { "x-pan-parrot-effects": answered.effects.join(",") } : {}),
      },
      body: answered.body,
      recordCount: answered.recordCount,
      chaosEffects: answered.effects,
      delayMs: 0,
      dripMs: 0,
      stream: false,
      capped: answered.capped,
    };
  }

  const page = resolvePage(
    operation.pagination,
    input.query,
    spec.totalRecords,
    chaosOn ? spec.chaos : null,
  );
  if (chaosOn && spec.chaos.paginationGlitch !== "none") {
    effects.push(`pagination-${spec.chaos.paginationGlitch}`);
  }

  const records: unknown[] = [];
  const listed = operation.list && !operation.record.pageItems && operation.envelope.type !== "xml" && operation.envelope.type !== "soap";
  const iterations = listed ? page.count : 1;
  for (let offset = 0; offset < iterations; offset += 1) {
    records.push(
      generateRecord(operation.record, {
        index: page.start + offset,
        seed: spec.chaos.seed,
        pathParams: input.pathParams,
        chaos: chaosOn ? spec.chaos : null,
        baseEpoch: page.baseEpoch,
        page,
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

  let body = encodeBody(operation, records, page, input.requestUrl, chaosOn ? spec.chaos : null, effects);
  let contentType = operation.pagination.style === "akamai" ? "application/x-ndjson; charset=utf-8" : operation.contentType;
  if (chaosOn && spec.chaos.malformedXml && isXmlOperation(operation)) {
    body = `${body.slice(0, Math.max(1, body.length - 8))}<<<`;
    effects.push("malformed-xml");
  } else if (chaosOn && spec.chaos.malformedJson) {
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
  const downloadBytes = operation.stream ? 0 : operation.downloadBytes || 0;
  if (downloadBytes > 0 && !isXmlOperation(operation)) {
    body = expandToBytes(downloadBody(operation, records, body), downloadBytes);
    contentType = operation.pack ? contentType : "text/csv; charset=utf-8";
    effects.push("download");
  }
  if (operation.stream && !isXmlOperation(operation)) {
    body = streamBody(operation, records, body);
    contentType = "application/x-ndjson; charset=utf-8";
    effects.push("stream");
  }
  if (chaosOn && spec.chaos.partial) {
    body = body.slice(0, Math.max(1, Math.floor(byteLength(body) * 0.4)));
    effects.push("partial");
  }

  let capped = page.capped;
  const sizeCap = downloadBytes > 0 || operation.stream ? MOCK_LIMITS.maxDownloadBytes : MOCK_LIMITS.maxResponseBytes;
  if (byteLength(body) > sizeCap) {
    capped = true;
    effects.push("size-cap");
    body = downloadBytes > 0 || operation.stream ? body.slice(0, sizeCap) : trimToBytes(operation, records, page);
  }

  const headers: Record<string, string> = {
    ...operation.headers,
    "content-type": contentType,
    "x-pan-parrot-request": String(input.requestIndex),
    "x-pan-parrot-seed": spec.chaos.seed,
    "x-pan-parrot-records": String(records.length),
  };
  if (capped) headers["x-pan-parrot-page-cap"] = String(MOCK_LIMITS.maxRecordsPerResponse);
  if (operation.stream) headers["x-pan-parrot-stream"] = "chunked";
  if (downloadBytes > 0 && !operation.stream) headers["accept-ranges"] = "bytes";
  if (effects.length) headers["x-pan-parrot-effects"] = effects.join(",");
  const link = nextLinkHeader(operation, page, input.requestUrl, input.query);
  if (link) headers.link = link;
  if (operation.pagination.style === "header" && page.next != null && operation.pagination.headerName) {
    headers[operation.pagination.headerName] = encodeToken(page.next);
  }
  const pack = operation.pack
    ? {
        format: operation.pack.format,
        filename: operation.pack.filename,
        entries: [{ name: operation.pack.entryName, text: packEntry(operation, records, body) }],
      }
    : undefined;

  return {
    status: effects.includes("soap-fault") ? 500 : operation.status,
    headers: pack
      ? {
          ...headers,
          "content-type":
            pack.format === "gzip"
              ? "application/gzip"
              : "application/octet-stream",
          "content-disposition": `attachment; filename="${pack.filename}"`,
        }
      : headers,
    body,
    recordCount: listed ? records.length : page.count,
    chaosEffects: effects,
    delayMs: chaosOn && spec.chaos.latency ? 2000 : chaosOn && spec.chaos.slowDrip && !operation.stream ? 1500 : 0,
    dripMs: chaosOn && spec.chaos.slowDrip && operation.stream ? 200 : 0,
    stream: Boolean(operation.stream) && !isXmlOperation(operation),
    capped,
    pack,
  };
}

function downloadBody(operation: MockOperation, records: unknown[], body: string): string {
  if (operation.pack?.entryFormat === "csv" || !operation.pack) return toCsv(records.length ? records : [{}]);
  return body;
}

function streamBody(operation: MockOperation, records: unknown[], body: string): string {
  if (operation.envelope.type === "ndjson" || operation.envelope.type === "splunk-export") return body;
  return records.map((record) => JSON.stringify(record)).join("\n");
}

export function expandToBytes(text: string, target: number): string {
  const goal = Math.min(Math.max(target, 1), MOCK_LIMITS.maxDownloadBytes);
  const unit = text || "x";
  let out = "";
  while (out.length < goal) out += unit;
  return out.slice(0, goal);
}

function packEntry(operation: MockOperation, records: unknown[], body: string): string {
  const format = operation.pack?.entryFormat;
  if (format === "ndjson") return records.map((record) => JSON.stringify(record)).join("\n");
  if (format === "csv") return toCsv(records);
  if (format === "wrapped-json") {
    let data: unknown = records;
    try {
      data = JSON.parse(body);
    } catch {
      data = records;
    }
    return JSON.stringify({ type: operation.pack?.wrapperType || "MTA", data });
  }
  return body;
}

function toCsv(records: unknown[]): string {
  const rows = records.filter((record): record is Record<string, unknown> => Boolean(record) && typeof record === "object");
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 40);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  }
  return lines.join("\n");
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function isXmlOperation(operation: MockOperation): boolean {
  return operation.envelope.type === "xml" || operation.envelope.type === "soap" || operation.contentType.includes("xml");
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
  const timeValue = pagination.timeParam ? Number(query[pagination.timeParam]) : NaN;
  const hasTime = Number.isFinite(timeValue) && timeValue > 1_000_000_000;
  const baseEpoch = hasTime ? Math.floor(timeValue) : 1_700_000_000;
  const requested = clamp(
    Number(query[pagination.limitParam] ?? pagination.defaultLimit),
    1,
    pagination.maxLimit,
  );
  const asked = Number(query[pagination.limitParam]);
  const capped = Number.isFinite(asked) && requested < asked;
  let start = 0;
  const ignoreOffset = Boolean(pagination.timeOverridesOffset && hasTime);
  if (!ignoreOffset && pagination.style === "page") {
    const page = Math.max(1, Math.floor(Number(query[pagination.pageParam] || 1)));
    start = (page - 1) * requested;
  } else if (!ignoreOffset && (pagination.style === "cursor" || pagination.style === "link" || pagination.style === "header")) {
    start = decodeToken(query[pagination.cursorParam]);
  } else if (!ignoreOffset && (pagination.style === "offset" || pagination.style === "akamai")) {
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

function encodeBody(
  operation: MockOperation,
  records: unknown[],
  page: PagePlan,
  requestUrl?: string,
  chaos: ChaosSpec | null = null,
  effects: string[] = [],
): string {
  const envelope = operation.envelope;
  if (envelope.type === "xml" || envelope.type === "soap") {
    const xml = renderFieldXml(operation.record, records[0], {
      wrongNamespace: Boolean(chaos?.wrongNamespace),
    });
    if (chaos?.wrongNamespace) effects.push("wrong-namespace");
    if (chaos?.soapFault && envelope.type === "soap") {
      effects.push("soap-fault");
      return soapEnvelope(envelope.version, "", "Mock SOAP fault");
    }
    const inner = xml.replace(/^<\?xml[^>]*>/, "");
    return envelope.type === "soap" ? soapEnvelope(envelope.version, inner) : xml;
  }
  if (!operation.list) {
    return JSON.stringify(records[0] ?? {});
  }
  if (envelope.type === "ndjson" || operation.pagination.style === "akamai") {
    const lines = records.map((record) => JSON.stringify(record));
    const akamai = operation.pagination.style === "akamai" || (envelope.type === "ndjson" && envelope.trailer === "akamai-offset");
    if (akamai) {
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
  if (envelope.type === "odata") {
    const body: Record<string, unknown> = {
      "@odata.context": envelope.context,
      value: records,
    };
    if (page.next != null && requestUrl) {
      const next = new URL(requestUrl);
      next.searchParams.set(operation.pagination.limitParam, String(page.requestedLimit));
      next.searchParams.set(operation.pagination.offsetParam, String(page.next));
      body["@odata.nextLink"] = next.toString();
    }
    return JSON.stringify(body);
  }
  if (envelope.type === "azure") {
    const body: Record<string, unknown> = { value: records };
    if (page.next != null && requestUrl) {
      const next = new URL(requestUrl);
      next.searchParams.set(operation.pagination.limitParam, String(page.requestedLimit));
      next.searchParams.set(operation.pagination.cursorParam, encodeToken(page.next));
      body.nextLink = next.toString();
    }
    return JSON.stringify(body);
  }
  if (envelope.type === "token-page") {
    return JSON.stringify({
      [envelope.arrayKey]: records,
      [envelope.tokenKey]: page.next != null ? encodeToken(page.next) : "",
    });
  }
  if (envelope.type === "splunk-export") {
    return records
      .map((record, offset) =>
        JSON.stringify({ preview: false, offset: page.start + offset, lastrow: offset === records.length - 1, result: record }),
      )
      .join("\n");
  }
  if (envelope.type === "slack") {
    return JSON.stringify({
      ok: true,
      messages: records,
      has_more: page.next != null,
      response_metadata: page.next != null ? { next_cursor: encodeToken(page.next) } : {},
    });
  }
  if (envelope.type === "falcon") {
    return JSON.stringify({
      meta: {
        query_time: 0.012,
        pagination: {
          offset: page.start,
          limit: page.requestedLimit,
          total: records.length,
        },
      },
      resources: records,
      errors: [],
    });
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

function nextLinkHeader(
  operation: MockOperation,
  page: PagePlan,
  requestUrl: string | undefined,
  query: Record<string, string | undefined>,
): string | undefined {
  if (operation.pagination.style !== "link" || page.next == null || !requestUrl) return undefined;
  const next = new URL(requestUrl);
  for (const [key, value] of Object.entries(query)) {
    if (value) next.searchParams.set(key, value);
  }
  next.searchParams.set(operation.pagination.limitParam, String(page.requestedLimit));
  next.searchParams.set(operation.pagination.cursorParam, encodeToken(page.next));
  const self = new URL(requestUrl);
  return `<${self.toString()}>; rel="self", <${next.toString()}>; rel="next"`;
}

interface RecordCtx {
  index: number;
  seed: string;
  pathParams: Record<string, string>;
  chaos: ChaosSpec | null;
  baseEpoch: number;
  path: string;
  page?: PagePlan;
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
      if (field.pageItems && ctx.page) {
        return Array.from({ length: ctx.page.count }, (_, itemIndex) =>
          generateField(item, {
            ...ctx,
            path: `${ctx.path}[${itemIndex}]`,
            index: ctx.page!.start + itemIndex,
          }),
        );
      }
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
      if (field.example && ctx.index === 0) return field.example;
      return `${198 + (ctx.index % 2)}.51.${(ctx.index >> 8) & 255}.${(ctx.index & 255) || 1}`;
    case "email":
      return `user${ctx.index}@example.com`;
    case "timestamp":
      return formatTime((timestampAnchor(field.example) ?? ctx.baseEpoch) + ctx.index, field.format, ctx, rng);
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

function timestampAnchor(example: string | undefined): number | null {
  if (!example) return null;
  if (/^\d{10}$/.test(example)) return Number(example);
  if (/^\d{13}$/.test(example)) return Math.floor(Number(example) / 1000);
  const parsed = Date.parse(example);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
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

export function chaosTriggers(chaos: ChaosSpec, requestIndex: number): boolean {
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
    !chaos.slowDrip &&
    !chaos.partial &&
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
