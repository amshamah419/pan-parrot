import { describe, expect, it } from "vitest";
import { diffJsonShape } from "./content-pack";
import { generateMockResponse } from "./generate";
import type { FieldSpec, MockOperation } from "./mock-spec";
import { verifiedPresets } from "./verified-presets";
import { localName, parseXml, type XmlElement } from "./xml";

describe("verified preset shapes", () => {
  it("runs each documented sample through its declared shape", () => {
    const failures: string[] = [];
    for (const preset of verifiedPresets) {
      for (const operation of preset.spec.operations) {
        const result = generateMockResponse({
          spec: preset.spec,
          operation,
          pathParams: { index: "logs", userId: "me", id: "1", search_id: "abc", job_id: "job", org_key: "org" },
          query: {
            limit: "2",
            $top: "2",
            size: "2",
            MaxResults: "2",
            MaxItems: "2",
            [operation.pagination.limitParam]: "2",
            ...(operation.queryMatch || {}),
          },
          requestIndex: 1,
        });
        const problem = shapeProblem(operation, result.body);
        if (problem) failures.push(`${preset.id} ${operation.id}: ${problem}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

function shapeProblem(operation: MockOperation, body: string): string | null {
  if (operation.envelope.type === "graphql") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return "GraphQL sample is not JSON";
    }
    if (!parsed || typeof parsed !== "object" || !("data" in parsed)) return "GraphQL sample has no data";
    return null;
  }
  if (
    operation.envelope.type === "aws-query" ||
    operation.envelope.type === "xml" ||
    operation.envelope.type === "soap" ||
    operation.contentType.includes("xml")
  ) {
    return xmlProblem(operation, body);
  }
  let sample: unknown;
  try {
    sample = firstJson(operation, body);
  } catch (error) {
    return error instanceof Error ? error.message : "sample did not parse";
  }
  const missing = diffJsonShape(operation, sample).missing;
  return missing.length ? `missing ${missing.join(", ")}` : null;
}

function firstJson(operation: MockOperation, body: string): unknown {
  if (
    operation.envelope.type === "splunk-export" ||
    operation.envelope.type === "ndjson" ||
    operation.pagination.style === "akamai"
  ) {
    const line = body.split("\n").find((item) => item.trim().startsWith("{"));
    if (!line) throw new Error("no JSON sample line");
    const parsed = JSON.parse(line) as Record<string, unknown>;
    if (operation.envelope.type === "splunk-export") return parsed.result;
    return parsed;
  }
  return JSON.parse(body);
}

function xmlProblem(operation: MockOperation, body: string): string | null {
  let root: XmlElement;
  try {
    root = parseXml(body);
  } catch (error) {
    return error instanceof Error ? error.message : "XML did not parse";
  }
  const names = new Set<string>();
  collect(root, names);
  const required: string[] = [];
  if (operation.envelope.type === "aws-query") {
    required.push(
      `${operation.envelope.action}Response`,
      operation.envelope.listElement,
      operation.envelope.itemElement,
    );
    if (operation.envelope.protocol === "ec2") required.push("requestId");
    else required.push(`${operation.envelope.action}Result`, "ResponseMetadata", "RequestId", "IsTruncated");
    collectAwsNames(operation.record, required);
    if (root.namespace !== operation.envelope.namespace) return `namespace ${root.namespace || "missing"}`;
  } else {
    xmlRequired(operation.record, required, true);
  }
  const missing = required.filter((name) => !names.has(name));
  return missing.length ? `missing XML ${missing.join(", ")}` : null;
}

function collect(element: XmlElement, names: Set<string>): void {
  names.add(localName(element.name));
  for (const attribute of element.attributes) names.add(localName(attribute.name));
  for (const child of element.children) collect(child, names);
}

function xmlRequired(field: FieldSpec, names: string[], asRoot: boolean): void {
  if (field.optional) return;
  if (asRoot || field.kind !== "array") names.push(field.name);
  if (field.kind === "object") {
    for (const child of field.children ?? []) xmlRequired(child, names, false);
  } else if (field.kind === "array" && field.item) {
    xmlRequired(field.item, names, true);
  }
}

function collectAwsNames(field: FieldSpec, names: string[]): void {
  if (field.optional) return;
  if (field.kind === "array") {
    if (field.item) collectAwsNames(field.item, names);
    return;
  }
  if (field.kind !== "object") return;
  for (const child of field.children ?? []) {
    if (child.optional) continue;
    names.push(child.name);
    collectAwsNames(child, names);
  }
}
