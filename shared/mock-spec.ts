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
  /** Repeat this array once per record in the current page. */
  pageItems?: boolean;
  xml?: {
    attribute?: boolean;
    namespace?: string;
    prefix?: string;
  };
}

export type Envelope =
  | { type: "array" }
  | { type: "object" }
  | { type: "ndjson"; trailer: "akamai-offset" | "none" }
  | { type: "wrapped"; arrayKey: string }
  | { type: "odata"; context: string }
  | { type: "falcon" }
  | { type: "slack" }
  | { type: "azure" }
  | { type: "splunk-export" }
  | { type: "token-page"; arrayKey: string; tokenKey: string }
  | { type: "xml" }
  | { type: "soap"; version: "1.1" | "1.2" }
  | { type: "graphql" }
  | AwsQueryEnvelope;

/** EC2 and IAM/STS/SQS/SNS query-protocol XML. boto3 parses this, not JSON. */
export interface AwsQueryEnvelope {
  type: "aws-query";
  /** ec2 puts fields on the response root and lists `item`. query wraps ActionResult and lists `member`. */
  protocol: "ec2" | "query";
  action: string;
  namespace: string;
  /**
   * list: wrapper plus item/member and a paging token.
   * flattened: repeated listElement tags directly under the result (SQS Message).
   * structure: one object under ActionResult (STS).
   * empty: ActionResult with no children (SQS DeleteMessage).
   */
  result?: "list" | "flattened" | "structure" | "empty";
  listElement: string;
  itemElement: "item" | "member";
  paging: "nextToken" | "marker";
}

export interface PaginationSpec {
  style: "none" | "offset" | "cursor" | "page" | "link" | "header" | "akamai";
  limitParam: string;
  offsetParam: string;
  pageParam: string;
  cursorParam: string;
  defaultLimit: number;
  maxLimit: number;
  /** When set, a time query such as Akamai `from` ignores offset. */
  timeParam?: string;
  timeOverridesOffset?: boolean;
  /** Response header that carries the next page token when style is header. */
  headerName?: string;
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
  /** Query keys that must match before this operation is chosen. Form body fields count too. */
  queryMatch?: Record<string, string>;
  /** Header name to exact value. A blank value means the header only has to be present. */
  headerMatch?: Record<string, string>;
  /** JSONPath (`$.a.b`) or XPath (`/a/b`, `/a/@attr`, `//name`). */
  bodyMatch?: { path: string; equals?: string };
  /** When set, the GraphQL operation name in the request must match. */
  graphqlOperation?: string;
  /** Higher values win when several operations match. */
  priority?: number;
  /** Used when this path matches but no stricter rule does. */
  fallback?: boolean;
  soapAction?: string;
  requestElement?: string;
  /** Send list rows as chunked NDJSON instead of one buffered body. */
  stream?: boolean;
  /** Exact JSON body from an integration test_data file. Returned when chaos is off. */
  fixture?: string;
  /** When set, the catch URL repeats the sample until this many bytes, up to the download cap. */
  downloadBytes?: number;
  pack?: {
    format: "zip" | "gzip" | "octet";
    filename: string;
    entryName: string;
    entryFormat: "json" | "ndjson" | "csv" | "wrapped-json";
    wrapperType?: string;
  };
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
  /** Pause between streamed lines, or once before a buffered body. */
  slowDrip: boolean;
  /** End the body early, as a truncated download or stream. */
  partial: boolean;
  malformedJson: boolean;
  wrongContentType: boolean;
  randomErrors: boolean;
  latency: boolean;
  paginationGlitch: "none" | "repeat" | "skip" | "endless";
  malformedXml: boolean;
  wrongNamespace: boolean;
  soapFault: boolean;
  authExpired: boolean;
  authDenied: boolean;
  authTokenFailure: boolean;
  authClockSkew: boolean;
  /** Return `{ data: null, errors: [...] }` instead of a selection set. */
  graphqlErrors: boolean;
}

export type AuthMode =
  | "none"
  | "api-key"
  | "basic"
  | "bearer"
  | "oauth2"
  | "session"
  | "panos-key"
  | "edgegrid"
  | "signed-headers"
  | "sigv4"
  | "digest"
  | "jwt"
  | "wsse"
  | "ntlm";

export interface MockAuth {
  mode: AuthMode;
  apiKey?: { in: "header" | "query" | "form"; name: string; value: string };
  basic?: { username: string; password: string };
  bearer?: { token: string };
  oauth2?: {
    tokenPath: string;
    clientId: string;
    clientSecret: string;
    ttlSeconds: number;
    shape: "generic" | "microsoft" | "crowdstrike";
    /** When true, the token response includes a refresh_token and that grant is accepted. */
    refresh?: boolean;
  };
  session?: { loginPath: string; username: string; password: string };
  panos?: { username: string; password: string; apiKey: string };
  edgegrid?: {
    clientToken: string;
    accessToken: string;
    clientSecret: string;
    verify: "signature" | "format-only";
  };
  signedHeaders?: { names: string[]; verify: "format-only" };
  sigv4?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    service: string;
    /** Temporary key returned by AssumeRole. Accepted in addition to accessKeyId when checks are on. */
    sessionAccessKeyId?: string;
    /** When false, the dummy key is stored and signatures are not required. Missing means check. */
    verify?: boolean;
    /** Accept the service name in the credential scope. Used when one catch URL answers sts and sqs. */
    anyService?: boolean;
  };
  digest?: { realm: string; username: string; password: string };
  jwt?: { hmacSecret: string; issuer: string; audience: string };
  wsse?: { username: string; password: string };
  ntlm?: { username: string; password: string; domain: string };
}

export interface XsoarParam {
  name: string;
  display: string;
  /** XSOAR configuration type. 0 short text, 4 encrypted, 8 boolean, 9 credentials. */
  type: number;
  required?: boolean;
  defaultValue?: string;
  /** Label of the password side of a type 9 credentials parameter. */
  passwordLabel?: string;
}

export interface XsoarIntegration {
  brand: string;
  display: string;
  params: XsoarParam[];
}

/** One row in the integration-in-progress coverage table. */
export interface CommandCoverage {
  command: string;
  operationId?: string;
  response: "test_data" | "sample-shape" | "outputs" | "arguments" | "none";
  pathFrom: "client" | "description" | "mapped" | "command-name" | "none";
  fixture?: string;
}

export interface MockSpec {
  version: 1;
  source: {
    kind: "preset" | "openapi" | "swagger" | "postman" | "sample" | "wsdl" | "manual" | "graphql";
    id?: string;
    name: string;
    attribution?: string;
    sourceUrl?: string;
    fidelity?: "verified" | "high" | "sample" | "shape" | "generated";
    notes?: string[];
    unsupported?: string[];
    verification?: {
      status: "verified" | "sample" | "shape";
      docUrl?: string;
      checkedAt?: string;
      differences?: string[];
    };
    /** Parameter names taken from an XSOAR integration YAML configuration list. */
    xsoar?: XsoarIntegration;
    /** Commands from an integration YAML, including ones that did not become an operation. */
    coverage?: CommandCoverage[];
  };
  operations: MockOperation[];
  chaos: ChaosSpec;
  totalRecords: number;
  auth?: MockAuth;
  behavior?: MockBehavior;
  push?: PushSpec;
  /** Deterministic 429 after N calls in a window. Off unless enabled. */
  rateLimit?: RateQuota;
  /** SDL or introspection JSON. Queries against a graphql operation use this schema. */
  graphql?: {
    schema: string;
    exampleQuery?: string;
  };
}

export interface RateQuota {
  enabled: boolean;
  limit: number;
  windowSeconds: number;
  retryAfterSeconds: number;
}

export interface PushSpec {
  enabled: boolean;
  url: string;
  /** 0 sends only when you click Push now. 15, 60, and 1440 are scheduled. */
  intervalMinutes: number;
  batch: number;
  retries: number;
  signing: "none" | "hmac-sha256" | "bearer";
  secret?: string;
  /** Set on read so the studio can say a secret is saved without returning it. */
  hasSecret?: boolean;
}

export interface ScenarioStep {
  name?: string;
  status?: number;
  /** Replaces the generated body when set. Keep it short. */
  body?: string;
}

export interface MockBehavior {
  state: {
    enabled: boolean;
    idField: string;
  };
  scenario: {
    enabled: boolean;
    repeat: "last" | "loop";
    steps: ScenarioStep[];
  };
  fetch: {
    enabled: boolean;
    sinceParam: string;
    firstFetchParam: string;
    timeField: string;
    windowSeconds: number;
    dedup: boolean;
    perPoll: number;
  };
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
    slowDrip: false,
    partial: false,
    malformedJson: false,
    wrongContentType: false,
    randomErrors: false,
    latency: false,
    paginationGlitch: "none",
    malformedXml: false,
    wrongNamespace: false,
    soapFault: false,
    authExpired: false,
    authDenied: false,
    authTokenFailure: false,
    authClockSkew: false,
    graphqlErrors: false,
  };
}

export function defaultAuth(): MockAuth {
  return { mode: "none" };
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
      notes: cleanList(raw.source.notes, 12, 500),
      unsupported: cleanList(raw.source.unsupported, 20, 300),
      verification: normalizeVerification(raw.source.verification),
      xsoar: normalizeXsoar(raw.source.xsoar),
      coverage: normalizeCoverage(raw.source.coverage),
    },
    operations,
    chaos: normalizeChaos(raw.chaos),
    totalRecords: total,
    auth: normalizeAuth(raw.auth),
    behavior: normalizeBehavior(raw.behavior),
    push: normalizePush(raw.push),
    rateLimit: normalizeRateLimit(raw.rateLimit),
    graphql: normalizeGraphql(raw.graphql),
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
    queryMatch: normalizeQueryMatch(operation.queryMatch),
    headerMatch: normalizeHeaderMatch(operation.headerMatch),
    bodyMatch: normalizeBodyMatch(operation.bodyMatch),
    graphqlOperation: cleanOptional(operation.graphqlOperation, 80),
    priority: clampInt(operation.priority, -100, 1000, 0) || undefined,
    fallback: Boolean(operation.fallback) || undefined,
    soapAction: cleanOptional(operation.soapAction, 200),
    requestElement: cleanOptional(operation.requestElement, 80),
    stream: Boolean(operation.stream) || undefined,
    fixture: normalizeFixture(operation.fixture),
    downloadBytes: clampInt(operation.downloadBytes, 0, MOCK_LIMITS.maxDownloadBytes, 0) || undefined,
    pack: normalizePack(operation.pack),
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
  if (envelope.type === "odata") {
    const context = String(envelope.context || "").slice(0, 240);
    if (!context.startsWith("http")) throw new Error("OData context must be an https URL");
    return { type: "odata", context };
  }
  if (envelope.type === "falcon") return { type: "falcon" };
  if (envelope.type === "slack") return { type: "slack" };
  if (envelope.type === "azure") return { type: "azure" };
  if (envelope.type === "splunk-export") return { type: "splunk-export" };
  if (envelope.type === "token-page") {
    return {
      type: "token-page",
      arrayKey: token(envelope.arrayKey, "items"),
      tokenKey: token(envelope.tokenKey, "nextPageToken"),
    };
  }
  if (envelope.type === "graphql") return { type: "graphql" };
  if (envelope.type === "aws-query") return normalizeAwsQuery(envelope);
  if (envelope.type === "xml") return { type: "xml" };
  if (envelope.type === "soap") return { type: "soap", version: envelope.version === "1.2" ? "1.2" : "1.1" };
  if (envelope.type === "array" || envelope.type === "object") return envelope;
  return list ? { type: "array" } : { type: "object" };
}

function normalizeAwsQuery(envelope: AwsQueryEnvelope): AwsQueryEnvelope {
  const protocol = envelope.protocol === "ec2" ? "ec2" : envelope.protocol === "query" ? "query" : null;
  if (!protocol) throw new Error("AWS query protocol must be ec2 or query");
  const action = String(envelope.action || "");
  if (!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(action)) throw new Error("Invalid AWS action");
  const namespace = String(envelope.namespace || "");
  if (!/^https?:\/\/[A-Za-z0-9._/-]{1,180}$/.test(namespace)) throw new Error("Invalid AWS namespace");
  const result =
    envelope.result === "flattened" || envelope.result === "structure" || envelope.result === "empty" || envelope.result === "list"
      ? envelope.result
      : "list";
  const listElement = String(envelope.listElement || (result === "empty" || result === "structure" ? "Result" : ""));
  if ((result === "list" || result === "flattened") && !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(listElement)) {
    throw new Error("Invalid AWS list element");
  }
  const itemElement = envelope.itemElement === "item" ? "item" : "member";
  const paging = envelope.paging === "nextToken" ? "nextToken" : "marker";
  return { type: "aws-query", protocol, action, namespace, result, listElement, itemElement, paging };
}

function normalizePagination(pagination: PaginationSpec | undefined): PaginationSpec {
  const base = defaultPagination();
  if (!pagination) return base;
  const style = ["none", "offset", "cursor", "page", "link", "header", "akamai"].includes(pagination.style)
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
    timeParam: pagination.timeParam ? token(pagination.timeParam, "from") : undefined,
    timeOverridesOffset: Boolean(pagination.timeOverridesOffset),
    headerName: pagination.headerName ? token(pagination.headerName, "x-next-token") : undefined,
  };
}

export function defaultRateLimit(): RateQuota {
  return { enabled: false, limit: 5, windowSeconds: 60, retryAfterSeconds: 2 };
}

function normalizeRateLimit(value: RateQuota | undefined): RateQuota {
  const base = defaultRateLimit();
  if (!value) return base;
  return {
    enabled: Boolean(value.enabled),
    limit: clampInt(value.limit, 1, 10_000, base.limit),
    windowSeconds: clampInt(value.windowSeconds, 1, 3600, base.windowSeconds),
    retryAfterSeconds: clampInt(value.retryAfterSeconds, 0, 3600, base.retryAfterSeconds),
  };
}

function normalizeFixture(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MOCK_LIMITS.maxScenarioBodyBytes) return undefined;
  if (trimmed.includes("\0")) return undefined;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return undefined;
  try {
    JSON.parse(trimmed);
  } catch {
    return undefined;
  }
  return trimmed;
}

function normalizeCoverage(value: CommandCoverage[] | undefined): CommandCoverage[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows: CommandCoverage[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const command = String(row.command || "").trim().slice(0, 80);
    if (!command) continue;
    const response = ["test_data", "sample-shape", "outputs", "arguments", "none"].includes(row.response)
      ? row.response
      : "none";
    const pathFrom = ["client", "description", "mapped", "command-name", "none"].includes(row.pathFrom)
      ? row.pathFrom
      : "none";
    rows.push({
      command,
      operationId: cleanOptional(row.operationId, 80),
      response,
      pathFrom,
      fixture: cleanOptional(row.fixture, 120),
    });
    if (rows.length >= MOCK_LIMITS.maxOperations) break;
  }
  return rows.length ? rows : undefined;
}

function normalizeXsoar(value: unknown): XsoarIntegration | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<XsoarIntegration>;
  const brand = cleanOptional(raw.brand, 80);
  const display = cleanOptional(raw.display, 120);
  if (!brand || !display || !Array.isArray(raw.params)) return undefined;
  const params: XsoarParam[] = [];
  for (const param of raw.params.slice(0, 16)) {
    if (!param || typeof param !== "object") continue;
    const name = cleanOptional(param.name, 80);
    if (!name || !/^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(name)) continue;
    const type = Number(param.type);
    if (!Number.isInteger(type) || type < 0 || type > 30) continue;
    params.push({
      name,
      display: cleanOptional(param.display, 160) || name,
      type,
      required: Boolean(param.required),
      defaultValue: cleanOptional(param.defaultValue, 80),
      passwordLabel: cleanOptional(param.passwordLabel, 80),
    });
  }
  return params.length ? { brand, display, params } : undefined;
}

function normalizeVerification(
  verification: MockSpec["source"]["verification"],
): MockSpec["source"]["verification"] {
  if (!verification || typeof verification !== "object") return undefined;
  const status = verification.status;
  if (status !== "verified" && status !== "sample" && status !== "shape") return undefined;
  return {
    status,
    docUrl: cleanOptional(verification.docUrl, 300),
    checkedAt: cleanOptional(verification.checkedAt, 20),
    differences: cleanList(verification.differences, 8, 400),
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
    next.pageItems = Boolean(field.pageItems);
  }
  if (field.xml && typeof field.xml === "object") {
    const namespace = cleanOptional(field.xml.namespace, 200);
    const prefix = field.xml.prefix && /^[A-Za-z][A-Za-z0-9]{0,12}$/.test(field.xml.prefix)
      ? field.xml.prefix
      : undefined;
    if (field.xml.attribute || namespace || prefix) {
      next.xml = { attribute: Boolean(field.xml.attribute), namespace, prefix };
    }
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
    slowDrip: Boolean(chaos.slowDrip),
    partial: Boolean(chaos.partial),
    malformedJson: Boolean(chaos.malformedJson),
    wrongContentType: Boolean(chaos.wrongContentType),
    randomErrors: Boolean(chaos.randomErrors),
    latency: Boolean(chaos.latency),
    paginationGlitch: ["repeat", "skip", "endless"].includes(chaos.paginationGlitch)
      ? chaos.paginationGlitch
      : "none",
    malformedXml: Boolean(chaos.malformedXml),
    wrongNamespace: Boolean(chaos.wrongNamespace),
    soapFault: Boolean(chaos.soapFault),
    authExpired: Boolean(chaos.authExpired),
    authDenied: Boolean(chaos.authDenied),
    authTokenFailure: Boolean(chaos.authTokenFailure),
    authClockSkew: Boolean(chaos.authClockSkew),
    graphqlErrors: Boolean(chaos.graphqlErrors),
  };
}

function normalizeGraphql(value: MockSpec["graphql"] | undefined): MockSpec["graphql"] | undefined {
  if (!value || typeof value.schema !== "string") return undefined;
  const schema = value.schema.trim();
  if (!schema) return undefined;
  if (schema.length > MOCK_LIMITS.maxGraphqlSchemaChars) throw new Error("GraphQL schema is too large");
  const example = typeof value.exampleQuery === "string" ? value.exampleQuery.trim().slice(0, 8_000) : "";
  return { schema, exampleQuery: example || undefined };
}

function normalizeAuth(auth: MockAuth | undefined): MockAuth {
  if (!auth || auth.mode === "none") return { mode: "none" };
  const mode = auth.mode;
  if (mode === "api-key" && auth.apiKey) {
    const place = auth.apiKey.in === "query" || auth.apiKey.in === "form" ? auth.apiKey.in : "header";
    return {
      mode,
      apiKey: {
        in: place,
        name: token(auth.apiKey.name, "x-api-key"),
        value: secretText(auth.apiKey.value),
      },
    };
  }
  if (mode === "basic" && auth.basic) {
    return {
      mode,
      basic: { username: secretText(auth.basic.username), password: secretText(auth.basic.password) },
    };
  }
  if (mode === "bearer" && auth.bearer) return { mode, bearer: { token: secretText(auth.bearer.token) } };
  if (mode === "oauth2" && auth.oauth2) {
    const shape = ["microsoft", "crowdstrike"].includes(auth.oauth2.shape) ? auth.oauth2.shape : "generic";
    return {
      mode,
      oauth2: {
        tokenPath: String(auth.oauth2.tokenPath || "/oauth/token").startsWith("/")
          ? String(auth.oauth2.tokenPath).slice(0, 120)
          : "/oauth/token",
        clientId: secretText(auth.oauth2.clientId),
        clientSecret: secretText(auth.oauth2.clientSecret),
        ttlSeconds: clampInt(auth.oauth2.ttlSeconds, 60, 86_400, 3600),
        shape,
        refresh: auth.oauth2.refresh ?? shape !== "crowdstrike",
      },
    };
  }
  if (mode === "session" && auth.session) {
    return {
      mode,
      session: {
        loginPath: String(auth.session.loginPath || "/login").startsWith("/")
          ? String(auth.session.loginPath).slice(0, 120)
          : "/login",
        username: secretText(auth.session.username),
        password: secretText(auth.session.password),
      },
    };
  }
  if (mode === "panos-key" && auth.panos) {
    return {
      mode,
      panos: {
        username: secretText(auth.panos.username),
        password: secretText(auth.panos.password),
        apiKey: secretText(auth.panos.apiKey),
      },
    };
  }
  if (mode === "edgegrid" && auth.edgegrid) {
    return {
      mode,
      edgegrid: {
        clientToken: secretText(auth.edgegrid.clientToken),
        accessToken: secretText(auth.edgegrid.accessToken),
        clientSecret: secretText(auth.edgegrid.clientSecret),
        verify: auth.edgegrid.verify === "format-only" ? "format-only" : "signature",
      },
    };
  }
  if (mode === "signed-headers" && auth.signedHeaders) {
    const names = (auth.signedHeaders.names || [])
      .map((name) => String(name).toLowerCase())
      .filter((name) => /^[a-z0-9-]{1,40}$/.test(name))
      .slice(0, 8);
    return { mode, signedHeaders: { names, verify: "format-only" } };
  }
  if (mode === "sigv4" && auth.sigv4) {
    const sessionAccessKeyId = cleanOptional(auth.sigv4.sessionAccessKeyId, 128);
    return {
      mode,
      sigv4: {
        accessKeyId: secretText(auth.sigv4.accessKeyId),
        secretAccessKey: secretText(auth.sigv4.secretAccessKey),
        region: token(auth.sigv4.region, "us-east-1"),
        service: token(auth.sigv4.service, "execute-api"),
        ...(sessionAccessKeyId ? { sessionAccessKeyId } : {}),
        verify: auth.sigv4.verify === false ? false : true,
        ...(auth.sigv4.anyService ? { anyService: true } : {}),
      },
    };
  }
  if (mode === "digest" && auth.digest) {
    return {
      mode,
      digest: {
        realm: token(auth.digest.realm, "pan-parrot"),
        username: secretText(auth.digest.username),
        password: secretText(auth.digest.password),
      },
    };
  }
  if (mode === "jwt" && auth.jwt) {
    return {
      mode,
      jwt: {
        hmacSecret: secretText(auth.jwt.hmacSecret),
        issuer: cleanOptional(auth.jwt.issuer, 120) || "",
        audience: cleanOptional(auth.jwt.audience, 120) || "",
      },
    };
  }
  if (mode === "wsse" && auth.wsse) {
    return {
      mode,
      wsse: { username: secretText(auth.wsse.username), password: secretText(auth.wsse.password) },
    };
  }
  if (mode === "ntlm" && auth.ntlm) {
    return {
      mode,
      ntlm: {
        username: secretText(auth.ntlm.username),
        password: secretText(auth.ntlm.password),
        domain: cleanOptional(auth.ntlm.domain, 40) || "",
      },
    };
  }
  return { mode: "none" };
}

function normalizeBehavior(behavior: MockBehavior | undefined): MockBehavior {
  const base = defaultBehavior();
  if (!behavior) return base;
  const steps = Array.isArray(behavior.scenario?.steps) ? behavior.scenario.steps : [];
  return {
    state: {
      enabled: Boolean(behavior.state?.enabled),
      idField: token(behavior.state?.idField, "id"),
    },
    scenario: {
      enabled: Boolean(behavior.scenario?.enabled),
      repeat: behavior.scenario?.repeat === "loop" ? "loop" : "last",
      steps: steps.slice(0, MOCK_LIMITS.maxScenarioSteps).map((step, index) => ({
        name: cleanOptional(step?.name, 80) || `Call ${index + 1}`,
        status: step?.status == null ? undefined : clampInt(step.status, 100, 599, 200),
        body: cleanOptional(step?.body, MOCK_LIMITS.maxScenarioBodyBytes),
      })),
    },
    fetch: {
      enabled: Boolean(behavior.fetch?.enabled),
      sinceParam: token(behavior.fetch?.sinceParam, "since"),
      firstFetchParam: token(behavior.fetch?.firstFetchParam, "first_fetch"),
      timeField: token(behavior.fetch?.timeField, "created"),
      windowSeconds: clampInt(behavior.fetch?.windowSeconds, 1, 86_400, 300),
      dedup: behavior.fetch?.dedup !== false,
      perPoll: clampInt(behavior.fetch?.perPoll, 1, 50, 3),
    },
  };
}

function normalizePush(push: PushSpec | undefined): PushSpec | undefined {
  if (!push || typeof push !== "object") return undefined;
  const signing = push.signing === "hmac-sha256" || push.signing === "bearer" ? push.signing : "none";
  const interval = [15, 60, 1440].includes(Number(push.intervalMinutes)) ? Number(push.intervalMinutes) : 0;
  const secret = cleanOptional(push.secret, 200);
  const url = cleanOptional(push.url, 300);
  if (url) assertPushUrl(url);
  if (!url && !push.enabled) return undefined;
  if (push.enabled && !url) throw new Error("Push URL is required");
  return {
    enabled: Boolean(push.enabled),
    url: url || "",
    intervalMinutes: interval,
    batch: clampInt(push.batch, 1, 3, 1),
    retries: clampInt(push.retries, 0, 2, 1),
    signing,
    secret,
  };
}

function assertPushUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Push URL is not valid");
  }
  if (url.protocol !== "https:") throw new Error("Push URL must use https");
  if (url.username || url.password) throw new Error("Push URL must not include credentials");
  if (url.port && url.port !== "443") throw new Error("Push URL must use port 443");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    isPrivateLiteral(host)
  ) {
    throw new Error("Push URL host is not allowed");
  }
}

function isPrivateLiteral(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127 || a === 255) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function defaultBehavior(): MockBehavior {
  return {
    state: { enabled: false, idField: "id" },
    scenario: { enabled: false, repeat: "last", steps: [] },
    fetch: {
      enabled: false,
      sinceParam: "since",
      firstFetchParam: "first_fetch",
      timeField: "created",
      windowSeconds: 300,
      dedup: true,
      perPoll: 3,
    },
  };
}

function normalizeHeaderMatch(match: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!match || typeof match !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(match).slice(0, 6)) {
    const name = key.toLowerCase().trim();
    if (!/^[a-z0-9-]{1,40}$/.test(name)) continue;
    if (typeof value !== "string" || value.length > 80 || /[\r\n]/.test(value)) continue;
    out[name] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeBodyMatch(
  match: { path?: string; equals?: string } | undefined,
): { path: string; equals?: string } | undefined {
  if (!match || typeof match.path !== "string") return undefined;
  const path = match.path.trim().slice(0, 120);
  if (!path.startsWith("$") && !path.startsWith("/")) return undefined;
  if (/[()<>]/.test(path)) return undefined;
  const equals = cleanOptional(match.equals, 80);
  return equals ? { path, equals } : { path };
}

function normalizeQueryMatch(match: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!match || typeof match !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(match).slice(0, 6)) {
    if (!/^[A-Za-z0-9_$.-]{1,40}$/.test(key)) continue;
    if (typeof value !== "string" || value.length > 80) continue;
    out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizePack(pack: MockOperation["pack"]): MockOperation["pack"] {
  if (!pack || typeof pack !== "object") return undefined;
  const format = pack.format === "gzip" || pack.format === "octet" ? pack.format : pack.format === "zip" ? "zip" : undefined;
  if (!format) return undefined;
  const entryFormat = ["json", "ndjson", "csv", "wrapped-json"].includes(pack.entryFormat)
    ? pack.entryFormat
    : "json";
  const filename = String(pack.filename || "download.bin").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 80) || "download.bin";
  const entryName = String(pack.entryName || "records.json").replace(/[^A-Za-z0-9._/-]/g, "").slice(0, 80);
  if (!entryName || entryName.includes("..") || entryName.startsWith("/")) return undefined;
  return {
    format,
    filename,
    entryName,
    entryFormat,
    wrapperType: cleanOptional(pack.wrapperType, 40),
  };
}

function secretText(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error("Mock credential is empty. Use a dummy value, never a real secret.");
  if (text.length > 200) throw new Error("Mock credential is too long");
  return text;
}

function cleanHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  let count = 0;
  for (const [key, value] of Object.entries(headers)) {
    if (count >= 15) break;
    const name = key.toLowerCase().trim();
    if (!/^[a-z0-9_-]{1,40}$/.test(name)) continue;
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
