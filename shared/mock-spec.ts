import { MOCK_LIMITS } from "./policy";

export const FIELD_KINDS = [
  "string",
  "integer",
  "number",
  "boolean",
  "id",
  "uuid",
  "timestamp",
  "ip",
  "email",
  "enum",
  "const",
  "object",
  "array",
] as const;

export type FieldKind = (typeof FIELD_KINDS)[number];

export type TimestampFormat = "iso" | "unix" | "unix-ms" | "unix-string";

export interface FieldSpec {
  name: string;
  kind: FieldKind;
  optional?: boolean;
  description?: string;
  example?: string;
  enumValues?: string[];
  constValue?: string | number | boolean;
  format?: TimestampFormat | "akamai-rule";
  children?: FieldSpec[];
  item?: FieldSpec;
  minItems?: number;
  maxItems?: number;
}

export type Envelope =
  | { type: "array" }
  | { type: "object" }
  | { type: "ndjson"; trailer: "akamai-offset" | "none" }
  | { type: "wrapped"; arrayKey: string };

export interface PaginationSpec {
  style: "none" | "offset" | "cursor" | "page";
  limitParam: string;
  offsetParam: string;
  pageParam: string;
  cursorParam: string;
  defaultLimit: number;
  maxLimit: number;
}

export interface MockOperation {
  id: string;
  method: string;
  pathTemplate: string;
  summary?: string;
  status: number;
  contentType: string;
  headers: Record<string, string>;
  list: boolean;
  envelope: Envelope;
  pagination: PaginationSpec;
  record: FieldSpec;
}

export interface ChaosSpec {
  enabled: boolean;
  seed: string;
  mode: "probability" | "every-nth";
  probability: number;
  everyNth: number;
  duplicateRecords: boolean;
  missingFields: boolean;
  mixedTimestamps: boolean;
  outOfOrder: boolean;
  wrongTypes: boolean;
  truncatedJson: boolean;
  malformedJson: boolean;
  wrongContentType: boolean;
  randomErrors: boolean;
  latency: boolean;
  paginationGlitch: "none" | "repeat" | "skip" | "endless";
}

export interface MockSpec {
  version: 1;
  source: {
    kind: "preset" | "openapi" | "swagger" | "postman" | "sample" | "manual";
    id?: string;
    name: string;
    attribution?: string;
    sourceUrl?: string;
    fidelity?: "high" | "sample" | "shape" | "generated";
    notes?: string[];
    unsupported?: string[];
  };
  operations: MockOperation[];
  chaos: ChaosSpec;
  totalRecords: number;
}

export function defaultChaos(seed = ""): ChaosSpec {
  return {
    enabled: false,
    seed: seed || "parrot",
    mode: "probability",
    probability: 0.25,
    everyNth: 5,
    duplicateRecords: false,
    missingFields: false,
    mixedTimestamps: false,
    outOfOrder: false,
    wrongTypes: false,
    truncatedJson: false,
    malformedJson: false,
    wrongContentType: false,
    randomErrors: false,
    latency: false,
    paginationGlitch: "none",
  };
}

export function defaultPagination(): PaginationSpec {
  return {
    style: "offset",
    limitParam: "limit",
    offsetParam: "offset",
    pageParam: "page",
    cursorParam: "cursor",
    defaultLimit: 20,
    maxLimit: MOCK_LIMITS.maxRecordsPerResponse,
  };
}

const NAME_RE = /^[A-Za-z0-9_.:@$-]{1,80}$/;

export function validateMockSpec(input: unknown): MockSpec {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Mock spec must be an object");
  }
  const raw = input as MockSpec;
  if (raw.version !== 1) throw new Error("Unsupported mock spec version");
  if (!raw.source || typeof raw.source.name !== "string" || !raw.source.name.trim()) {
    throw new Error("Mock spec needs a source name");
  }
  const total = Math.floor(Number(raw.totalRecords));
  if (!Number.isFinite(total) || total < 1 || total > MOCK_LIMITS.maxVirtualRecords) {
    throw new Error(
      `totalRecords must be between 1 and ${MOCK_LIMITS.maxVirtualRecords}`,
    );
  }
  if (!Array.isArray(raw.operations) || raw.operations.length < 1) {
    throw new Error("Mock spec needs at least one operation");
  }
  if (raw.operations.length > MOCK_LIMITS.maxOperations) {
    throw new Error(`At most ${MOCK_LIMITS.maxOperations} operations`);
  }
  let fields = 0;
  const operations = raw.operations.map((operation) =>
    normalizeOperation(operation, () => {
      fields += 1;
      if (fields > MOCK_LIMITS.maxFields) {
        throw new Error(`At most ${MOCK_LIMITS.maxFields} fields`);
      }
    }),
  );
  return {
    version: 1,
    source: {
      kind: raw.source.kind || "manual",
      id: cleanOptional(raw.source.id, 80),
      name: raw.source.name.trim().slice(0, 120),
      attribution: cleanOptional(raw.source.attribution, 500),
      sourceUrl: cleanOptional(raw.source.sourceUrl, 300),
      fidelity: raw.source.fidelity,
      notes: cleanList(raw.source.notes, 12, 400),
      unsupported: cleanList(raw.source.unsupported, 20, 300),
    },
    operations,
    chaos: normalizeChaos(raw.chaos),
    totalRecords: total,
  };
}

function normalizeOperation(
  operation: MockOperation,
  countField: () => void,
): MockOperation {
  const method = String(operation?.method || "GET").toUpperCase();
  if (!/^[A-Z]{3,8}$/.test(method)) throw new Error("Invalid HTTP method");
  const pathTemplate = String(operation?.pathTemplate || "/");
  if (!pathTemplate.startsWith("/") || pathTemplate.length > 180) {
    throw new Error("Operation path must start with /");
  }
  const status = Math.floor(Number(operation?.status ?? 200));
  if (status < 200 || status > 599 || status === 204) {
    throw new Error("Operation status must be a success or error code with a body");
  }
  return {
    id: String(operation.id || method + pathTemplate).slice(0, 80),
    method,
    pathTemplate,
    summary: cleanOptional(operation.summary, 200),
    status,
    contentType:
      cleanOptional(operation.contentType, 80) || "application/json; charset=utf-8",
    headers: cleanHeaders(operation.headers),
    list: Boolean(operation.list),
    envelope: normalizeEnvelope(operation.envelope, operation.list),
    pagination: normalizePagination(operation.pagination),
    record: normalizeField(operation.record, 0, countField),
  };
}

function normalizeEnvelope(envelope: Envelope | undefined, list: boolean): Envelope {
  if (!envelope || typeof envelope !== "object") {
    return list ? { type: "array" } : { type: "object" };
  }
  if (envelope.type === "wrapped") {
    const key = String(envelope.arrayKey || "data");
    if (!NAME_RE.test(key)) throw new Error("Invalid wrapper key");
    return { type: "wrapped", arrayKey: key };
  }
  if (envelope.type === "ndjson") {
    return {
      type: "ndjson",
      trailer: envelope.trailer === "akamai-offset" ? "akamai-offset" : "none",
    };
  }
  if (envelope.type === "array" || envelope.type === "object") return envelope;
  return list ? { type: "array" } : { type: "object" };
}

function normalizePagination(pagination: PaginationSpec | undefined): PaginationSpec {
  const base = defaultPagination();
  if (!pagination) return base;
  const style = ["none", "offset", "cursor", "page"].includes(pagination.style)
    ? pagination.style
    : "none";
  const maxLimit = clampInt(
    pagination.maxLimit,
    1,
    MOCK_LIMITS.maxRecordsPerResponse,
    base.maxLimit,
  );
  return {
    style,
    limitParam: token(pagination.limitParam, "limit"),
    offsetParam: token(pagination.offsetParam, "offset"),
    pageParam: token(pagination.pageParam, "page"),
    cursorParam: token(pagination.cursorParam, "cursor"),
    defaultLimit: clampInt(pagination.defaultLimit, 1, maxLimit, base.defaultLimit),
    maxLimit,
  };
}

function normalizeField(
  field: FieldSpec | undefined,
  depth: number,
  countField: () => void,
): FieldSpec {
  if (!field || typeof field !== "object") throw new Error("Missing field");
  if (depth > MOCK_LIMITS.maxFieldDepth) throw new Error("Field nesting is too deep");
  countField();
  const name = String(field.name || "value");
  if (!NAME_RE.test(name) || name === "__proto__" || name === "constructor" || name === "prototype") {
    throw new Error(`Invalid field name: ${name}`);
  }
  if (!FIELD_KINDS.includes(field.kind)) throw new Error(`Unknown field kind: ${field.kind}`);
  const next: FieldSpec = {
    name,
    kind: field.kind,
    optional: Boolean(field.optional),
    description: cleanOptional(field.description, 200),
    example: cleanOptional(field.example, 200),
  };
  if (field.kind === "enum" || field.format === "akamai-rule") {
    const values = (field.enumValues || [])
      .map((value) => String(value).slice(0, 80))
      .filter(Boolean)
      .slice(0, 30);
    if (field.kind === "enum" && values.length === 0) {
      throw new Error(`Enum ${name} needs values`);
    }
    if (values.length) next.enumValues = values;
  }
  if (field.kind === "const") {
    if (
      typeof field.constValue !== "string" &&
      typeof field.constValue !== "number" &&
      typeof field.constValue !== "boolean"
    ) {
      throw new Error(`Const ${name} needs a value`);
    }
    next.constValue = field.constValue;
  }
  if (field.kind === "timestamp") {
    next.format = ["iso", "unix", "unix-ms", "unix-string"].includes(String(field.format))
      ? field.format
      : "iso";
  }
  if (field.format === "akamai-rule") next.format = "akamai-rule";
  if (field.kind === "object") {
    next.children = (field.children || []).map((child) =>
      normalizeField(child, depth + 1, countField),
    );
  }
  if (field.kind === "array") {
    if (!field.item) throw new Error(`Array ${name} needs an item shape`);
    next.item = normalizeField(field.item, depth + 1, countField);
    next.minItems = clampInt(field.minItems, 0, 5, 1);
    next.maxItems = clampInt(field.maxItems, next.minItems || 1, 5, 2);
  }
  return next;
}

function normalizeChaos(chaos: ChaosSpec | undefined): ChaosSpec {
  const base = defaultChaos(chaos?.seed);
  if (!chaos) return base;
  const probability = Number(chaos.probability);
  return {
    ...base,
    enabled: Boolean(chaos.enabled),
    seed: String(chaos.seed || base.seed).slice(0, 80) || "parrot",
    mode: chaos.mode === "every-nth" ? "every-nth" : "probability",
    probability: Number.isFinite(probability) ? Math.min(1, Math.max(0, probability)) : base.probability,
    everyNth: clampInt(chaos.everyNth, 1, 10_000, base.everyNth),
    duplicateRecords: Boolean(chaos.duplicateRecords),
    missingFields: Boolean(chaos.missingFields),
    mixedTimestamps: Boolean(chaos.mixedTimestamps),
    outOfOrder: Boolean(chaos.outOfOrder),
    wrongTypes: Boolean(chaos.wrongTypes),
    truncatedJson: Boolean(chaos.truncatedJson),
    malformedJson: Boolean(chaos.malformedJson),
    wrongContentType: Boolean(chaos.wrongContentType),
    randomErrors: Boolean(chaos.randomErrors),
    latency: Boolean(chaos.latency),
    paginationGlitch: ["repeat", "skip", "endless"].includes(chaos.paginationGlitch)
      ? chaos.paginationGlitch
      : "none",
  };
}

function cleanHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  let count = 0;
  for (const [key, value] of Object.entries(headers)) {
    if (count >= 15) break;
    const name = key.toLowerCase().trim();
    if (!/^[a-z0-9-]{1,40}$/.test(name)) continue;
    if (typeof value !== "string" || value.length > 200 || /[\r\n]/.test(value)) continue;
    out[name] = value;
    count += 1;
  }
  return out;
}

function cleanList(values: string[] | undefined, max: number, length: number): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const list = values
    .filter((value) => typeof value === "string")
    .map((value) => value.trim().slice(0, length))
    .filter(Boolean)
    .slice(0, max);
  return list.length ? list : undefined;
}

function cleanOptional(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function token(value: unknown, fallback: string): string {
  const text = String(value || fallback);
  return /^[A-Za-z0-9_$.-]{1,40}$/.test(text) ? text : fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
