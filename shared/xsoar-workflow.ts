import { parse as parseYaml } from "yaml";
import { mockFromSample } from "./infer";
import {
  defaultChaos,
  validateMockSpec,
  type CommandCoverage,
  type FieldSpec,
  type MockOperation,
  type MockSpec,
} from "./mock-spec";
import { MOCK_LIMITS } from "./policy";
import { callForCommand, cleanPath, type ClientCall } from "./xsoar-client";
import { xsoarFromDocument } from "./xsoar-instance";
import { fieldsFromOutputs, type OutputField } from "./xsoar-shape";

export interface TestDataFile {
  name: string;
  text: string;
}

export interface CommandMapping {
  command: string;
  method: string;
  path: string;
}

export interface IntegrationBuildInput {
  yaml: string;
  testData?: TestDataFile[];
  clientSource?: string;
  mappings?: CommandMapping[];
}

interface Command {
  name?: string;
  description?: string;
  outputs?: OutputField[];
  arguments?: Array<{ name?: string }>;
}

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/** One operation per command. test_data wins over outputs. A client call wins over the description path. */
export function buildIntegrationMock(input: IntegrationBuildInput): { spec: MockSpec; warnings: string[] } {
  let document: unknown;
  try {
    document = parseYaml(input.yaml);
  } catch {
    throw new Error("Integration YAML is not valid");
  }
  const commands = (document as { script?: { commands?: unknown } })?.script?.commands;
  if (!Array.isArray(commands)) throw new Error("YAML is not an XSOAR integration");
  const doc = document as { name?: string; display?: string; script?: { commands?: Command[] } };
  const files = (input.testData || []).slice(0, 20);
  const warnings: string[] = [];
  const coverage: CommandCoverage[] = [];
  const operations: MockOperation[] = [];
  const used = new Set<string>();
  let fields = 0;
  for (const command of doc.script?.commands || []) {
    const name = String(command.name || "").trim();
    if (!name) continue;
    if (operations.length >= MOCK_LIMITS.maxOperations) {
      coverage.push({ command: name.slice(0, 80), response: "none", pathFrom: "none" });
      warnings.push(`Stopped at ${MOCK_LIMITS.maxOperations} commands.`);
      continue;
    }
    const fixture = matchTestData(name, files);
    const outputs = fieldsFromOutputs(command.outputs);
    const fromArguments = outputs ? null : fieldsFromArguments(command.arguments);
    const sample = fixture ? sampleRecord(fixture.text) : null;
    const record = sample?.record || outputs || fromArguments;
    const response: CommandCoverage["response"] = sample
      ? sample.raw
        ? "test_data"
        : "sample-shape"
      : outputs
        ? "outputs"
        : fromArguments
          ? "arguments"
          : "none";
    if (!record) {
      coverage.push({ command: name.slice(0, 80), response: "none", pathFrom: "none", fixture: fixture?.name });
      continue;
    }
    const route = routeFor(name, command.description, input.clientSource || "", input.mappings || []);
    const id = uniqueId(slug(name), used);
    const operation = operationFor(id, command, record, sample, route.call);
    const added = countFields(operation.record);
    if (fields + added > MOCK_LIMITS.maxFields) {
      coverage.push({ command: name.slice(0, 80), response: "none", pathFrom: "none" });
      warnings.push("Stopped because the field cap was reached.");
      continue;
    }
    fields += added;
    operations.push(operation);
    coverage.push({
      command: name.slice(0, 80),
      operationId: id,
      response,
      pathFrom: route.from,
      fixture: fixture ? fixture.name.split("/").pop()?.slice(0, 120) : undefined,
    });
  }
  if (!operations.length) throw new Error("Integration YAML has no commands with outputs, arguments, or test_data");
  const display = String(doc.display || doc.name || "Integration").trim().slice(0, 120) || "Integration";
  const notes = [
    "Built from an integration YAML. Each command with a shape is one operation.",
    "A test_data file whose name matches the command is the response. Otherwise the outputs context paths are the shape.",
    "The path is the Python client call when that command's function can be found, then METHOD /path in the description, otherwise /command-name.",
  ];
  const guessed = coverage.filter((row) => row.response === "outputs" || row.response === "arguments").length;
  const seeded = coverage.filter((row) => row.response === "test_data" || row.response === "sample-shape").length;
  const missing = coverage.filter((row) => row.response === "none").length;
  if (seeded) notes.push(`${seeded} command${seeded === 1 ? "" : "s"} use test_data.`);
  if (guessed) notes.push(`${guessed} command${guessed === 1 ? "" : "s"} use a guessed shape from outputs or arguments.`);
  if (missing) notes.push(`${missing} command${missing === 1 ? "" : "s"} have no mock.`);
  const xsoar = xsoarFromDocument(document);
  const spec = validateMockSpec({
    version: 1,
    source: {
      kind: "manual",
      name: display,
      fidelity: seeded ? "sample" : "shape",
      notes,
      ...(xsoar ? { xsoar } : {}),
      coverage,
    },
    operations,
    chaos: defaultChaos("xsoar"),
    totalRecords: 3,
  });
  return { spec, warnings };
}

function routeFor(
  command: string,
  description: string | undefined,
  clientSource: string,
  mappings: CommandMapping[],
): { call: ClientCall; from: CommandCoverage["pathFrom"] } {
  const mapped = mappings.find((item) => item.command === command);
  const mappedPath = mapped ? cleanPath(mapped.path) : null;
  if (mapped && mappedPath && METHODS.has(mapped.method.toUpperCase())) {
    return { call: { method: mapped.method.toUpperCase() as ClientCall["method"], path: mappedPath }, from: "mapped" };
  }
  const client = callForCommand(command, clientSource);
  if (client) return { call: client, from: "client" };
  const described = methodAndPath(description);
  if (described) return { call: described, from: "description" };
  return { call: { method: "GET", path: `/${slug(command)}` }, from: "command-name" };
}

function operationFor(
  id: string,
  command: Command,
  record: FieldSpec,
  sample: { list: boolean; raw: string | null } | null,
  call: ClientCall,
): MockOperation {
  return {
    id,
    method: call.method,
    pathTemplate: call.path,
    summary: String(command.description || command.name || "Command").replace(/\s+/g, " ").slice(0, 160),
    status: 200,
    contentType: "application/json; charset=utf-8",
    headers: {},
    list: Boolean(sample?.list),
    envelope: sample?.list ? { type: "array" } : { type: "object" },
    pagination: {
      style: "none",
      limitParam: "limit",
      offsetParam: "offset",
      pageParam: "page",
      cursorParam: "cursor",
      defaultLimit: 1,
      maxLimit: 1,
    },
    record,
    ...(sample?.raw ? { fixture: sample.raw } : {}),
  };
}

function sampleRecord(text: string): { record: FieldSpec; list: boolean; raw: string | null } | null {
  const body = httpBody(text);
  if (!body || (typeof body !== "object")) return null;
  let drafted: MockSpec;
  try {
    drafted = mockFromSample(JSON.stringify(body), "fixture");
  } catch {
    return null;
  }
  const operation = drafted.operations[0];
  const raw = JSON.stringify(body);
  return {
    record: operation.record,
    list: Array.isArray(body),
    raw: raw.length <= MOCK_LIMITS.maxScenarioBodyBytes ? raw : null,
  };
}

function httpBody(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    if ("mock_response" in record) return unwrapMaybeJson(record.mock_response);
    if ("Contents" in record && ("Type" in record || "EntryContext" in record)) return record.Contents;
  }
  return parsed;
}

function unwrapMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function matchTestData(command: string, files: TestDataFile[]): TestDataFile | null {
  const key = norm(command);
  if (!key) return null;
  let best: { file: TestDataFile; score: number; length: number } | null = null;
  for (const file of files) {
    const base = norm((file.name.split("/").pop() || "").replace(/\.(json|txt)$/i, ""));
    let score = 0;
    if (base === key) score = 3;
    else if (key.length >= 4 && (base.endsWith(key) || base.startsWith(key))) score = 2;
    if (!score) continue;
    if (!best || score > best.score || (score === best.score && base.length < best.length)) {
      best = { file, score, length: base.length };
    }
  }
  return best?.file || null;
}

function fieldsFromArguments(args: Array<{ name?: string }> | undefined): FieldSpec | null {
  const children = (args || [])
    .map((arg) => String(arg.name || "").replace(/[^A-Za-z0-9_.:@$-]/g, "").slice(0, 80))
    .filter((item) => /^[A-Za-z_][A-Za-z0-9_.:@$-]{0,79}$/.test(item))
    .slice(0, 20)
    .map((item) => ({ name: item, kind: "string" as const, example: item }));
  if (!children.length) return null;
  return { name: "record", kind: "object", children };
}

function methodAndPath(description: string | undefined): ClientCall | null {
  const match = String(description || "").match(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[A-Za-z0-9_{}./-]{1,120})/);
  if (!match) return null;
  const path = cleanPath(match[2]);
  if (!path) return null;
  return { method: match[1] as ClientCall["method"], path };
}

function countFields(field: FieldSpec): number {
  let count = 1;
  for (const child of field.children || []) count += countFields(child);
  if (field.item) count += countFields(field.item);
  return count;
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function slug(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  return cleaned || "command";
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`.slice(0, 60);
    n += 1;
  }
  used.add(id);
  return id;
}
