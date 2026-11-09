import type { FieldSpec } from "./mock-spec";
import { defaultPagination, type MockSpec } from "./mock-spec";
import { defaultChaos } from "./mock-spec";

export function mockFromSample(sampleText: string, name = "Pasted sample"): MockSpec {
  const parsed = parseSample(sampleText);
  const list = Array.isArray(parsed);
  const rows = list ? parsed : [parsed];
  const objects = rows.filter((row) => row && typeof row === "object" && !Array.isArray(row));
  if (objects.length === 0) {
    throw new Error("Sample must be a JSON object, an array of objects, or newline-delimited JSON objects");
  }
  const record = mergeObjects(objects as Record<string, unknown>[], "record");
  return {
    version: 1,
    source: {
      kind: "sample",
      name,
      fidelity: "sample",
      notes: ["Field shapes were inferred from the pasted sample. Identifier and timestamp fields are generated so records stay unique."],
    },
    operations: [
      {
        id: "get-root",
        method: "GET",
        pathTemplate: "/",
        summary: "Inferred from a sample payload",
        status: 200,
        contentType: "application/json; charset=utf-8",
        headers: {},
        list,
        envelope: list ? { type: "array" } : { type: "object" },
        pagination: { ...defaultPagination(), style: list ? "offset" : "none" },
        record,
      },
    ],
    chaos: defaultChaos(),
    totalRecords: Math.max(20, objects.length),
  };
}

function parseSample(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Sample is empty");
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const rows = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown);
    return rows;
  }
}

function mergeObjects(
  objects: Record<string, unknown>[],
  name: string,
  depth = 0,
): FieldSpec {
  const keys = new Set<string>();
  for (const object of objects) {
    for (const key of Object.keys(object)) keys.add(key);
  }
  const children = [...keys].slice(0, 40).map((key) => {
    const values = objects.map((object) => object[key]).filter((value) => value !== undefined);
    const optional = values.length < objects.length;
    const field = inferValue(key, values[0], depth + 1);
    field.optional = optional || values.some((value) => value === null);
    return field;
  });
  return { name, kind: "object", children };
}

export function inferValue(name: string, value: unknown, depth = 0): FieldSpec {
  if (depth > 5) return { name, kind: "string", example: "nested" };
  if (value === null || value === undefined) {
    return { name, kind: "string", optional: true };
  }
  if (Array.isArray(value)) {
    const first = value.find((item) => item !== null && item !== undefined);
    return {
      name,
      kind: "array",
      item: inferValue("item", first ?? "", depth + 1),
      minItems: 0,
      maxItems: Math.min(3, Math.max(1, value.length)),
    };
  }
  if (typeof value === "object") {
    return mergeObjects([value as Record<string, unknown>], name, depth);
  }
  if (typeof value === "boolean") return { name, kind: "boolean" };
  if (typeof value === "number") {
    return { name, kind: Number.isInteger(value) ? "integer" : "number" };
  }
  const text = String(value);
  if (isSecretName(name) || text.startsWith("eyJ")) {
    return { name, kind: "string", example: "redacted" };
  }
  if (isIdentifier(name)) return { name, kind: "id", example: text.slice(0, 80) };
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return { name, kind: "timestamp", format: "iso" };
  if (/^\d{10}$/.test(text) && /time|date|start|stamp/i.test(name)) {
    return { name, kind: "timestamp", format: "unix-string" };
  }
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(text)) return { name, kind: "ip", example: text };
  if (text.includes("@") && text.includes(".")) return { name, kind: "email" };
  return { name, kind: "string", example: text.slice(0, 120) };
}

function isSecretName(name: string): boolean {
  return /password|secret|token|api[-_]?key|authorization|credential/i.test(name);
}

function isIdentifier(name: string): boolean {
  return /(^id$|Id$|_id$|requestId|uuid)/i.test(name) && !/config/i.test(name);
}
