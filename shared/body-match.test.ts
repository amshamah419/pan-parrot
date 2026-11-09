import { describe, expect, it } from "vitest";
import { bodyMatches } from "./body-match";
import { defaultChaos, defaultPagination, type MockSpec } from "./mock-spec";
import { matchOperation } from "./generate";

describe("body matchers", () => {
  it("reads a JSONPath and an XPath", () => {
    expect(bodyMatches('{"incident":{"status":"closed"}}', { path: "$.incident.status", equals: "closed" })).toBe(true);
    expect(bodyMatches('{"items":[{"id":"a"}]}', { path: "$.items[0].id", equals: "a" })).toBe(true);
    expect(bodyMatches('{"incident":{"status":"open"}}', { path: "$.incident.status", equals: "closed" })).toBe(false);
    expect(bodyMatches('<response status="success"><result>ok</result></response>', { path: "/response/@status", equals: "success" })).toBe(true);
    expect(bodyMatches('<response><result>ok</result></response>', { path: "//result", equals: "ok" })).toBe(true);
    expect(bodyMatches("<!DOCTYPE foo [<!ENTITY x SYSTEM \"file:///etc/passwd\">]><foo/>", { path: "//foo" })).toBe(false);
  });
});

function operation(partial: Partial<MockSpec["operations"][number]>): MockSpec["operations"][number] {
  return {
    id: partial.id || "op",
    method: partial.method || "POST",
    pathTemplate: partial.pathTemplate || "/incidents",
    status: 200,
    contentType: "application/json",
    headers: {},
    list: false,
    envelope: { type: "object" },
    pagination: { ...defaultPagination(), style: "none" },
    record: { name: "incident", kind: "string" },
    ...partial,
  };
}

describe("operation priority", () => {
  const spec: MockSpec = {
    version: 1,
    source: { kind: "manual", name: "Incidents" },
    operations: [
      operation({ id: "fallback", fallback: true }),
      operation({
        id: "closed",
        priority: 10,
        bodyMatch: { path: "$.status", equals: "closed" },
      }),
      operation({
        id: "header",
        priority: 5,
        headerMatch: { "x-env": "lab" },
      }),
    ],
    chaos: defaultChaos(),
    totalRecords: 1,
  };

  it("prefers the highest matching rule and otherwise uses the fallback", () => {
    expect(matchOperation(spec, "POST", "/incidents", {}, { body: '{"status":"closed"}' })?.operation.id).toBe("closed");
    expect(matchOperation(spec, "POST", "/incidents", {}, { headers: { "x-env": "lab" } })?.operation.id).toBe("header");
    expect(matchOperation(spec, "POST", "/incidents", {}, { body: '{"status":"open"}' })?.operation.id).toBe("fallback");
    expect(matchOperation(spec, "POST", "/incidents")?.operation.id).toBe("fallback");
  });
});
