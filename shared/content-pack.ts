import { generateMockResponse } from "./generate";
import type { FieldSpec, MockOperation, MockSpec } from "./mock-spec";

const FILE_MAX = 8_000;
const JSON_FILES = 19;

export interface PackFile {
  name: string;
  text: string;
}

export interface ShapeDiff {
  missing: string[];
  extra: string[];
}

export function contentPackFiles(spec: MockSpec): PackFile[] {
  const quiet = { ...spec, chaos: { ...spec.chaos, enabled: false } };
  const files: PackFile[] = [];
  const used = new Set<string>();
  for (const operation of spec.operations) {
    if (files.length >= JSON_FILES) break;
    const generated = generateMockResponse({
      spec: quiet,
      operation,
      query: { limit: "2", ...(operation.queryMatch || {}) },
      pathParams: {},
      requestIndex: 1,
    });
    files.push(fileFor(uniqueName(operation.id, used), generated.body, operation.contentType || ""));
  }
  const steps = spec.behavior?.scenario?.steps || [];
  steps.forEach((step, index) => {
    if (files.length >= JSON_FILES || !step.body) return;
    const name = uniqueName(`scenario-${index + 1}-${step.name || "step"}`, used);
    files.push(fileFor(name, step.body, looksLikeXml(step.body) ? "xml" : "json"));
  });
  files.push({
    name: "README.md",
    text: readme({
      title: spec.source.name,
      intro: "These files are raw HTTP bodies, which is what most XSOAR unit tests pass to requests_mock.",
      lines: files.filter((item) => item.name !== "README.md").map((item) => item.name),
      notes: [
        steps.length
          ? "scenario-*.json files are the call-sequence steps that had a body. The sequence is the whole catch URL, not one command."
          : "No sequence steps had a replacement body, so only the generated command samples are included.",
        files.length - 1 >= JSON_FILES ? "The zip stops at 19 JSON or XML files." : "",
      ].filter(Boolean),
    }),
  });
  return files;
}

export function capturedPackFiles(
  calls: Array<{
    method: string;
    path: string;
    status: number;
    responsePreview?: string | null;
    truncated?: boolean;
  }>,
): PackFile[] {
  const files: PackFile[] = [];
  const used = new Set<string>();
  const notes: string[] = [];
  calls.slice(0, JSON_FILES).forEach((call, index) => {
    const preview = call.responsePreview || "";
    const name = uniqueName(`${index + 1}-${call.method}-${call.path}`, used);
    files.push(fileFor(name, preview || "{}", looksLikeXml(preview) ? "xml" : "json"));
    notes.push(
      `${files[files.length - 1].name}: ${call.method} ${call.path} → ${call.status}${call.truncated || preview.length >= 2000 ? " (preview capped at 2000 characters)" : ""}`,
    );
  });
  files.push({
    name: "README.md",
    text: readme({
      title: "Captured calls",
      intro: calls.length
        ? "Each file is the response preview stored for one call that hit this catch URL. Request headers are not included."
        : "No calls have been captured for this mock yet. Send one request, then export again.",
      lines: notes,
      notes: ["The stored preview is at most 2000 characters, so a large vendor body can be cut off."],
    }),
  });
  return files;
}

export function diffJsonShape(operation: MockOperation, value: unknown): ShapeDiff {
  const sample = unwrapResponse(operation, value);
  const missing: string[] = [];
  const extra: string[] = [];
  const shape = operation.record;
  if (shape.kind === "object") {
    compareObject(shape.children || [], sample, "", missing, extra);
  } else if (shape.kind === "array" && shape.item) {
    const item = Array.isArray(sample) ? sample[0] : sample;
    compareField(shape.item, item, "[0]", missing, extra);
  } else {
    compareField(shape, sample, shape.name, missing, extra);
  }
  return { missing, extra };
}

function compareObject(
  children: FieldSpec[],
  value: unknown,
  path: string,
  missing: string[],
  extra: string[],
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (children.length) missing.push(path || "(object)");
    return;
  }
  const obj = value as Record<string, unknown>;
  const known = new Set(children.map((child) => child.name));
  for (const child of children) {
    const childPath = path ? `${path}.${child.name}` : child.name;
    if (!Object.prototype.hasOwnProperty.call(obj, child.name) || obj[child.name] === undefined) {
      if (!child.optional) missing.push(childPath);
      continue;
    }
    compareField(child, obj[child.name], childPath, missing, extra);
  }
  for (const key of Object.keys(obj)) {
    if (!known.has(key)) extra.push(path ? `${path}.${key}` : key);
  }
}

function compareField(
  shape: FieldSpec,
  value: unknown,
  path: string,
  missing: string[],
  extra: string[],
) {
  if (shape.kind === "object") {
    compareObject(shape.children || [], value, path, missing, extra);
    return;
  }
  if (shape.kind === "array") {
    if (!Array.isArray(value)) {
      if (!shape.optional) missing.push(path);
      return;
    }
    if (shape.item && value.length) compareField(shape.item, value[0], `${path}[0]`, missing, extra);
  }
}

function unwrapResponse(operation: MockOperation, value: unknown): unknown {
  if (Array.isArray(value)) return value[0];
  if (!value || typeof value !== "object") return value;
  const envelope = operation.envelope;
  const record = value as Record<string, unknown>;
  if ((envelope.type === "odata" || envelope.type === "azure") && Array.isArray(record.value)) return record.value[0];
  if ((envelope.type === "wrapped" || envelope.type === "token-page") && Array.isArray(record[envelope.arrayKey])) {
    return record[envelope.arrayKey][0];
  }
  if (envelope.type === "falcon" && Array.isArray(record.resources)) return record.resources[0];
  if (envelope.type === "slack" && Array.isArray(record.messages)) return record.messages[0];
  return value;
}

function fileFor(stem: string, body: string, contentType: string): PackFile {
  const text = body.length > FILE_MAX ? body.slice(0, FILE_MAX) : body;
  if (contentType.includes("xml") || looksLikeXml(text)) {
    return { name: `test_data/${stem}.xml`, text };
  }
  const parsed = parseJson(text);
  if (parsed !== undefined) {
    const pretty = JSON.stringify(parsed, null, 2);
    return { name: `test_data/${stem}.json`, text: pretty.length > FILE_MAX ? pretty.slice(0, FILE_MAX) : pretty };
  }
  return { name: `test_data/${stem}.txt`, text };
}

function readme(input: { title: string; intro: string; lines: string[]; notes: string[] }): string {
  return [
    `# ${input.title}`,
    "",
    input.intro,
    "",
    "```python",
    "def util_load_json(path):",
    "    with open(path, encoding=\"utf-8\") as handle:",
    "        return json.loads(handle.read())",
    "```",
    "",
    "The file is the raw HTTP body. Packs that wrap a command fixture can use `{\"args\": {}, \"mock_response\": body}`.",
    "",
    ...input.lines.map((line) => `- ${line}`),
    "",
    ...input.notes.map((line) => line),
    "",
  ].join("\n");
}

function parseJson(text: string): unknown | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

function looksLikeXml(text: string): boolean {
  return text.trim().startsWith("<");
}

function uniqueName(value: string, used: Set<string>): string {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "fixture";
  let name = base;
  let n = 2;
  while (used.has(name)) {
    name = `${base.slice(0, 36)}-${n}`;
    n += 1;
  }
  used.add(name);
  return name;
}
