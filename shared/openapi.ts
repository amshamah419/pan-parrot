import { defaultChaos, defaultPagination, type FieldSpec, type MockOperation, type MockSpec } from "./mock-spec";
import { inferValue } from "./infer";

export interface ImportResult {
  spec: MockSpec;
  warnings: string[];
  unsupported: string[];
}

export function specFromDocument(doc: unknown): ImportResult {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("API spec must be a JSON object");
  }
  const record = doc as Record<string, unknown>;
  if (isPostman(record)) return fromPostman(record);
  if (typeof record.openapi === "string") return fromOpenApi3(record);
  if (record.swagger === "2.0") return fromSwagger2(record);
  throw new Error("Unsupported spec. Use OpenAPI 3.x, Swagger 2.0, or a Postman Collection v2 JSON.");
}

function isPostman(doc: Record<string, unknown>): boolean {
  const info = doc.info as Record<string, unknown> | undefined;
  const schema = String(info?.schema || "");
  return schema.includes("schema.getpostman.com") || Array.isArray(doc.item) && Boolean(info?.name);
}

function fromOpenApi3(doc: Record<string, unknown>): ImportResult {
  const warnings: string[] = [];
  const unsupported: string[] = [];
  const paths = (doc.paths || {}) as Record<string, Record<string, unknown>>;
  const operations = operationsFromPaths(paths, (node) => resolveRef(doc, node, warnings), warnings, unsupported);
  if (operations.length === 0) {
    throw new Error("No operations with a JSON response were found in this OpenAPI document");
  }
  if (doc.webhooks) unsupported.push("OpenAPI webhooks are not mocked");
  if (doc.security || (doc.components as Record<string, unknown> | undefined)?.securitySchemes) {
    warnings.push("Security schemes are not enforced. The mock does not require the vendor's credentials.");
  }
  return finish(doc, "openapi", String((doc.info as Record<string, unknown> | undefined)?.title || "OpenAPI"), operations, warnings, unsupported);
}

function fromSwagger2(doc: Record<string, unknown>): ImportResult {
  const warnings: string[] = [];
  const unsupported: string[] = [];
  const paths = (doc.paths || {}) as Record<string, Record<string, unknown>>;
  const operations = operationsFromPaths(paths, (node) => resolveRef(doc, node, warnings), warnings, unsupported);
  if (operations.length === 0) {
    throw new Error("No operations with a JSON response were found in this Swagger document");
  }
  warnings.push("Security schemes are not enforced.");
  return finish(doc, "swagger", String((doc.info as Record<string, unknown> | undefined)?.title || "Swagger"), operations, warnings, unsupported);
}

function operationsFromPaths(
  paths: Record<string, Record<string, unknown>>,
  resolve: (node: unknown) => unknown,
  warnings: string[],
  unsupported: string[],
): MockOperation[] {
  const methods = ["get", "post", "put", "patch", "delete", "head"];
  const operations: MockOperation[] = [];
  for (const [path, item] of Object.entries(paths)) {
    if (!item || typeof item !== "object") continue;
    for (const method of methods) {
      const operation = item[method] as Record<string, unknown> | undefined;
      if (!operation) continue;
      const built = operationFrom(method, path, operation, resolve, warnings, unsupported);
      if (built) operations.push(built);
      if (operations.length >= 40) {
        unsupported.push("Only the first 40 operations were imported");
        return operations;
      }
    }
  }
  return operations;
}

function operationFrom(
  method: string,
  path: string,
  operation: Record<string, unknown>,
  resolve: (node: unknown) => unknown,
  warnings: string[],
  unsupported: string[],
): MockOperation | null {
  const responses = (operation.responses || {}) as Record<string, unknown>;
  const statusKey = Object.keys(responses).find((key) => key.startsWith("2")) || Object.keys(responses)[0];
  if (!statusKey) {
    unsupported.push(`${method.toUpperCase()} ${path} has no responses`);
    return null;
  }
  const response = resolve(responses[statusKey]) as Record<string, unknown>;
  const media = pickJsonMedia(response);
  if (!media) {
    unsupported.push(`${method.toUpperCase()} ${path} has no JSON response schema or example`);
    return null;
  }
  const schema = media.schema ? (resolve(media.schema) as Record<string, unknown>) : undefined;
  const example = media.example ?? exampleFromSchema(schema);
  let record: FieldSpec;
  let list = false;
  let envelope: MockOperation["envelope"] = { type: "object" };
  if (schema) {
    const built = schemaToField("record", schema, resolve, warnings, 0);
    if (schema.type === "array" || built.kind === "array") {
      list = true;
      envelope = { type: "array" };
      record = built.item || { name: "record", kind: "object", children: [] };
      record.name = "record";
    } else if (built.kind === "object" && built.children?.some((child) => child.kind === "array")) {
      const arrayChild = built.children.find((child) => child.kind === "array");
      if (arrayChild?.item) {
        list = true;
        envelope = { type: "wrapped", arrayKey: arrayChild.name };
        record = arrayChild.item;
        record.name = "record";
        warnings.push(`${method.toUpperCase()} ${path} uses wrapper "${arrayChild.name}" around the generated list`);
      } else {
        record = built;
      }
    } else {
      record = built;
    }
  } else {
    record = inferValue("record", example);
    list = Array.isArray(example);
    envelope = list ? { type: "array" } : { type: "object" };
    if (list && record.kind === "array" && record.item) record = record.item;
  }
  const parameters = [
    ...(((operation.parameters as unknown[]) || [])),
    ...(((response as { parameters?: unknown[] }).parameters || [])),
  ].map((parameter) => resolve(parameter) as Record<string, unknown>);
  const pagination = paginationFrom(parameters, schema);
  const status = Number(statusKey) || 200;
  return {
    id: String(operation.operationId || `${method}${path}`).slice(0, 80),
    method: method.toUpperCase(),
    pathTemplate: path.startsWith("/") ? path : `/${path}`,
    summary: typeof operation.summary === "string" ? operation.summary.slice(0, 200) : undefined,
    status: status >= 200 && status <= 599 ? status : 200,
    contentType: "application/json; charset=utf-8",
    headers: {},
    list,
    envelope,
    pagination,
    record,
  };
}

function paginationFrom(
  parameters: Record<string, unknown>[],
  schema: Record<string, unknown> | undefined,
): MockOperation["pagination"] {
  const names = new Set(
    parameters
      .filter((parameter) => parameter.in === "query" && typeof parameter.name === "string")
      .map((parameter) => String(parameter.name)),
  );
  const base = defaultPagination();
  if (names.has("$top") || names.has("$skip")) {
    return { ...base, style: "offset", limitParam: "$top", offsetParam: "$skip" };
  }
  if (names.has("page") || names.has("pageNumber")) {
    return { ...base, style: "page", pageParam: names.has("page") ? "page" : "pageNumber" };
  }
  if (names.has("cursor") || names.has("next") || names.has("pageToken")) {
    return {
      ...base,
      style: "cursor",
      cursorParam: names.has("cursor") ? "cursor" : names.has("pageToken") ? "pageToken" : "next",
    };
  }
  if (names.has("offset") || names.has("skip")) {
    return { ...base, style: "offset", offsetParam: names.has("offset") ? "offset" : "skip" };
  }
  const text = JSON.stringify(schema || {});
  if (text.includes("@odata.nextLink") || text.includes("nextLink")) {
    return { ...base, style: "cursor", cursorParam: "$skiptoken" };
  }
  return { ...base, style: "none" };
}

function pickJsonMedia(response: Record<string, unknown>): { schema?: unknown; example?: unknown } | null {
  const content = response.content as Record<string, Record<string, unknown>> | undefined;
  if (content) {
    const key = Object.keys(content).find((item) => item.includes("json"));
    if (!key) return null;
    const media = content[key];
    const example = media.example ?? firstExample(media.examples);
    return { schema: media.schema, example };
  }
  if (response.schema) {
    const schema = response.schema as Record<string, unknown>;
    if (schema.type === "file" || schema.format === "binary" || schema.type === "string" && schema.format === "binary") {
      return null;
    }
    return { schema: response.schema, example: firstExample(response.examples) };
  }
  return null;
}

function firstExample(examples: unknown): unknown {
  if (!examples || typeof examples !== "object") return undefined;
  const first = Object.values(examples as Record<string, unknown>)[0] as Record<string, unknown> | undefined;
  return first?.value ?? first;
}

function exampleFromSchema(schema: Record<string, unknown> | undefined): unknown {
  if (!schema) return {};
  if ("example" in schema) return schema.example;
  return undefined;
}

function schemaToField(
  name: string,
  schema: Record<string, unknown>,
  resolve: (node: unknown) => unknown,
  warnings: string[],
  depth: number,
): FieldSpec {
  if (depth > 8) return { name, kind: "string", example: "nested" };
  const resolved = resolve(schema) as Record<string, unknown>;
  if (Array.isArray(resolved.allOf)) {
    const merged: Record<string, unknown> = { type: "object", properties: {}, required: [] };
    for (const part of resolved.allOf) {
      const item = resolve(part) as Record<string, unknown>;
      Object.assign(merged.properties as object, item.properties || {});
    }
    return schemaToField(name, merged, resolve, warnings, depth + 1);
  }
  if (Array.isArray(resolved.oneOf) || Array.isArray(resolved.anyOf)) {
    warnings.push(`${name} uses oneOf/anyOf; the first schema was used`);
    const choice = (resolved.oneOf || resolved.anyOf) as unknown[];
    return schemaToField(name, resolve(choice[0]) as Record<string, unknown>, resolve, warnings, depth + 1);
  }
  if (resolved.example !== undefined && resolved.type !== "object" && resolved.type !== "array") {
    const inferred = inferValue(name, resolved.example);
    if (!isGeneratedIdentity(name)) return inferred;
  }
  if (resolved.type === "array") {
    const items = (resolve(resolved.items) as Record<string, unknown>) || { type: "string" };
    return { name, kind: "array", item: schemaToField("item", items, resolve, warnings, depth + 1), minItems: 1, maxItems: 2 };
  }
  if (resolved.type === "object" || resolved.properties) {
    const properties = (resolved.properties || {}) as Record<string, unknown>;
    const required = new Set((resolved.required as string[]) || []);
    const children = Object.entries(properties).slice(0, 60).map(([key, value]) => {
      const child = schemaToField(key, resolve(value) as Record<string, unknown>, resolve, warnings, depth + 1);
      child.optional = !required.has(key);
      return child;
    });
    return { name, kind: "object", children };
  }
  if (Array.isArray(resolved.enum)) {
    return {
      name,
      kind: "enum",
      enumValues: resolved.enum.map((item) => String(item)).slice(0, 30),
    };
  }
  if (resolved.type === "integer") return { name, kind: isGeneratedIdentity(name) ? "id" : "integer" };
  if (resolved.type === "number") return { name, kind: "number" };
  if (resolved.type === "boolean") return { name, kind: "boolean" };
  if (resolved.format === "date-time" || resolved.format === "date") {
    return { name, kind: "timestamp", format: "iso" };
  }
  if (resolved.format === "uuid") return { name, kind: "uuid" };
  if (resolved.format === "ipv4") return { name, kind: "ip" };
  if (typeof resolved.example === "string") return inferValue(name, resolved.example);
  return { name, kind: isGeneratedIdentity(name) ? "id" : "string" };
}

function resolveRef(root: Record<string, unknown>, node: unknown, warnings: string[]): unknown {
  if (!node || typeof node !== "object") return node;
  const ref = (node as { $ref?: string }).$ref;
  if (!ref) return node;
  if (!ref.startsWith("#/")) {
    warnings.push(`External $ref ${ref} was not loaded; a string field was used`);
    return { type: "string" };
  }
  const parts = ref.slice(2).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current: unknown = root;
  for (const part of parts) {
    if (!current || typeof current !== "object") return { type: "string" };
    current = (current as Record<string, unknown>)[part];
  }
  return current ?? { type: "string" };
}

function fromPostman(doc: Record<string, unknown>): ImportResult {
  const warnings = ["Postman examples are used when present. Requests without a JSON example get a generic object."];
  const unsupported: string[] = [];
  const operations: MockOperation[] = [];
  walkPostman(doc.item, operations, unsupported);
  if (operations.length === 0) throw new Error("No requests were found in this Postman collection");
  const info = doc.info as Record<string, unknown> | undefined;
  return finish(doc, "postman", String(info?.name || "Postman collection"), operations, warnings, unsupported);
}

function walkPostman(items: unknown, operations: MockOperation[], unsupported: string[]): void {
  if (!Array.isArray(items) || operations.length >= 40) return;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (Array.isArray(record.item)) {
      walkPostman(record.item, operations, unsupported);
      continue;
    }
    const request = record.request as Record<string, unknown> | undefined;
    if (!request) continue;
    const method = String(request.method || "GET").toUpperCase();
    const url = request.url as Record<string, unknown> | string | undefined;
    const raw = typeof url === "string" ? url : String(url?.raw || "");
    let path = "/";
    try {
      const parsed = raw.startsWith("http") ? new URL(raw) : new URL(raw || "/", "https://example.com");
      path = parsed.pathname || "/";
    } catch {
      path = "/";
    }
    const responses = (record.response as Record<string, unknown>[]) || [];
    const sample = responses.map((response) => response.body).find((body) => typeof body === "string");
    let parsed: unknown = {};
    if (typeof sample === "string" && sample.trim()) {
      try {
        parsed = JSON.parse(sample);
      } catch {
        unsupported.push(`${method} ${path} example body was not JSON`);
      }
    }
    const inferred = inferValue("record", parsed);
    const list = Array.isArray(parsed);
    operations.push({
      id: `${method}${path}`.slice(0, 80),
      method,
      pathTemplate: path,
      summary: typeof record.name === "string" ? record.name.slice(0, 200) : undefined,
      status: Number(responses[0]?.code) || 200,
      contentType: "application/json; charset=utf-8",
      headers: {},
      list,
      envelope: list ? { type: "array" } : { type: "object" },
      pagination: { ...defaultPagination(), style: list ? "offset" : "none" },
      record: list && inferred.kind === "array" && inferred.item ? inferred.item : inferred,
    });
  }
}

function finish(
  doc: Record<string, unknown>,
  kind: MockSpec["source"]["kind"],
  name: string,
  operations: MockOperation[],
  warnings: string[],
  unsupported: string[],
): ImportResult {
  const info = doc.info as Record<string, unknown> | undefined;
  const version = String(info?.version || doc.openapi || doc.swagger || "");
  if (version) warnings.push(`Imported ${kind} ${version} as "${name}"`);
  return {
    spec: {
      version: 1,
      source: {
        kind,
        name: name.slice(0, 120),
        fidelity: "generated",
        notes: warnings,
        unsupported,
      },
      operations,
      chaos: defaultChaos(),
      totalRecords: 100,
    },
    warnings,
    unsupported,
  };
}

function isGeneratedIdentity(name: string): boolean {
  return /(^id$|Id$|_id$|uuid|requestId)/i.test(name);
}
