import { parse as parseYaml } from "yaml";
import { defaultChaos, validateMockSpec, type FieldSpec, type MockOperation, type MockSpec } from "./mock-spec";
import { fieldsFromOutputs, type OutputField } from "./xsoar-shape";

interface Command {
  name?: string;
  description?: string;
  outputs?: OutputField[];
  arguments?: Array<{ name?: string }>;
}

export function isXsoarIntegration(document: unknown): boolean {
  if (!document || typeof document !== "object" || Array.isArray(document)) return false;
  const commands = (document as { script?: { commands?: unknown } }).script?.commands;
  return Array.isArray(commands);
}

export function isOpenApiDocument(document: unknown): boolean {
  if (!document || typeof document !== "object" || Array.isArray(document)) return false;
  const doc = document as { openapi?: unknown; swagger?: unknown };
  return typeof doc.openapi === "string" || typeof doc.swagger === "string";
}

/** One operation per command. Paths are /command-name unless the description contains METHOD /path. */
export function mockFromIntegrationYaml(text: string): MockSpec {
  let document: unknown;
  try {
    document = parseYaml(text);
  } catch {
    throw new Error("Integration YAML is not valid");
  }
  if (!isXsoarIntegration(document)) throw new Error("YAML is not an XSOAR integration");
  const doc = document as { name?: string; display?: string; script?: { commands?: Command[] } };
  const used = new Set<string>();
  const operations: MockOperation[] = [];
  let fromArguments = false;
  for (const command of doc.script?.commands || []) {
    if (operations.length >= 12) break;
    const outputs = fieldsFromOutputs(command.outputs);
    const record = outputs || fieldsFromArguments(command.arguments);
    if (!record) continue;
    if (!outputs) fromArguments = true;
    const id = uniqueId(slug(String(command.name || "command")), used);
    const call = methodAndPath(command.description, id);
    operations.push({
      id,
      method: call.method,
      pathTemplate: call.path,
      summary: String(command.description || command.name || "Command").replace(/\s+/g, " ").slice(0, 160),
      status: 200,
      contentType: "application/json; charset=utf-8",
      headers: {},
      list: false,
      envelope: { type: "object" },
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
    });
  }
  if (!operations.length) throw new Error("Integration YAML has no commands with outputs or arguments");
  const name = String(doc.display || doc.name || "Integration").trim().slice(0, 120) || "Integration";
  const notes = [
    "Built from an integration YAML. Each command is one operation. A path is /command-name unless the command description contains METHOD /path.",
  ];
  if (fromArguments) notes.push("Commands without outputs echo their argument names.");
  return validateMockSpec({
    version: 1,
    source: { kind: "manual", name, fidelity: "shape", notes },
    operations,
    chaos: defaultChaos("xsoar"),
    totalRecords: 3,
  });
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

function methodAndPath(description: string | undefined, id: string): { method: MockOperation["method"]; path: string } {
  const match = String(description || "").match(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[A-Za-z0-9_{}./-]{1,120})/);
  if (match) return { method: match[1] as MockOperation["method"], path: match[2] };
  return { method: "GET", path: `/${id}` };
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
