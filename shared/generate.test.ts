import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateMockResponse, matchOperation } from "./generate";
import { mockFromSample } from "./infer";
import { validateMockSpec, type MockSpec } from "./mock-spec";
import { specFromDocument } from "./openapi";

const akamai = validateMockSpec(
  JSON.parse(
    readFileSync(
      "public/presets/integrations/akamai-waf-siem.json",
      "utf8",
    ),
  ).spec,
);

function page(spec: MockSpec, query: Record<string, string>, requestIndex = 1) {
  const matched = matchOperation(spec, "GET", "/siem/v1/configs/50170");
  if (!matched) throw new Error("missing operation");
  return generateMockResponse({
    spec,
    operation: matched.operation,
    pathParams: matched.pathParams,
    query,
    requestIndex,
  });
}

describe("akamai siem preset", () => {
  it("returns ndjson events and an offset trailer the XSOAR parser can split", () => {
    const result = page(akamai, { limit: "2" });
    const lines = result.body.split("\n");
    const trailer = JSON.parse(lines.at(-1) || "");
    const events = lines.slice(0, -1).map((line) => JSON.parse(line));
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("akamai_siem");
    expect(events[0].attackData.configId).toBe("50170");
    expect(events[0].httpMessage.query).toBe("q=login");
    expect(events[0].httpMessage.start).toMatch(/^\d+$/);
    expect(events[0].httpMessage.requestId).not.toBe(events[1].httpMessage.requestId);
    expect(trailer.total).toBe(2);
    expect(trailer.offset).toMatch(/^pp_/);
    expect(decodeAkamaiRule(events[0].attackData.ruleActions).length).toBeGreaterThan(0);
  });

  it("pages unique records and repeats a page for the same seed and offset", () => {
    const spec = validateMockSpec({ ...akamai, totalRecords: 1000 });
    const first = page(spec, { limit: "500" });
    const trailer = JSON.parse(first.body.split("\n").at(-1) || "");
    const second = page(spec, { limit: "500", offset: trailer.offset });
    const ids = [...idsOf(first), ...idsOf(second)];
    expect(new Set(ids).size).toBe(1000);
    const again = page(spec, { limit: "500" });
    expect(again.body).toBe(first.body);
  });

  it("applies a deterministic missing timestamp when chaos is forced", () => {
    const spec = validateMockSpec({
      ...akamai,
      chaos: {
        ...akamai.chaos,
        enabled: true,
        mode: "every-nth",
        everyNth: 1,
        missingFields: true,
        seed: "flake",
      },
    });
    const result = page(spec, { limit: "1" }, 1);
    const event = JSON.parse(result.body.split("\n")[0]);
    expect(event.httpMessage.start).toBeUndefined();
    expect(result.chaosEffects).toContain("missing-fields");
    expect(page(spec, { limit: "1" }, 1).body).toBe(result.body);
  });

  it("ignores offset when a time window is present, matching Akamai", () => {
    const withOffset = page(akamai, { limit: "1", offset: "pp_a" });
    const withTime = page(akamai, { limit: "1", offset: "pp_a", from: "1700000000" });
    const first = page(akamai, { limit: "1", from: "1700000000" });
    expect(withTime.body).toBe(first.body);
    expect(withTime.body).not.toBe(withOffset.body);
  });
});

describe("verified vendor envelopes", () => {
  it("pages Okta logs with a Link header and Graph alerts with nextLink", () => {
    const okta = validateMockSpec(
      JSON.parse(readFileSync("public/presets/integrations/okta-okta-v2.json", "utf8")).spec,
    );
    const logs = matchOperation(okta, "GET", "/api/v1/logs");
    if (!logs) throw new Error("okta");
    const oktaPage = generateMockResponse({
      spec: okta,
      operation: logs.operation,
      pathParams: logs.pathParams,
      query: { limit: "1" },
      requestIndex: 1,
      requestUrl: "https://parrot.example/catch/okta/api/v1/logs",
    });
    expect(Array.isArray(JSON.parse(oktaPage.body))).toBe(true);
    expect(oktaPage.headers.link).toContain('rel="next"');
    expect(oktaPage.headers["x-rate-limit-limit"]).toBe("100");

    const graph = validateMockSpec(
      JSON.parse(
        readFileSync("public/presets/integrations/microsoftgraphsecurity-microsoftgraphsecurity.json", "utf8"),
      ).spec,
    );
    const alerts = matchOperation(graph, "GET", "/v1.0/security/alerts_v2");
    if (!alerts) throw new Error("graph");
    const graphPage = generateMockResponse({
      spec: graph,
      operation: alerts.operation,
      pathParams: alerts.pathParams,
      query: { $top: "1" },
      requestIndex: 1,
      requestUrl: "https://parrot.example/catch/graph/v1.0/security/alerts_v2",
    });
    const body = JSON.parse(graphPage.body);
    expect(body.value).toHaveLength(1);
    expect(decodeURIComponent(body["@odata.nextLink"])).toContain("$skip=");
  });
});

describe("sample and openapi import", () => {
  it("infers a list from a pasted array", () => {
    const spec = mockFromSample(
      JSON.stringify([
        { id: "a", created: "2024-01-01T00:00:00Z", ip: "203.0.113.4" },
      ]),
    );
    const validated = validateMockSpec(spec);
    expect(validated.operations[0].list).toBe(true);
    expect(validated.operations[0].record.kind).toBe("object");
    const matched = matchOperation(validated, "GET", "/");
    if (!matched) throw new Error("sample");
    const body = JSON.parse(
      generateMockResponse({
        spec: validated,
        operation: matched.operation,
        pathParams: matched.pathParams,
        query: { limit: "1" },
        requestIndex: 1,
      }).body,
    );
    expect(body[0].created).toBe("2024-01-01T00:00:00Z");
    expect(body[0].ip).toBe("203.0.113.4");
  });

  it("builds an operation per OpenAPI path and honors offset parameters", () => {
    const imported = specFromDocument({
      openapi: "3.0.3",
      info: { title: "Widget", version: "1.0.0" },
      paths: {
        "/widgets": {
          get: {
            parameters: [
              { name: "limit", in: "query", schema: { type: "integer" } },
              { name: "offset", in: "query", schema: { type: "integer" } },
            ],
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        data: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string" },
                              name: { type: "string", example: "widget" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const spec = validateMockSpec(imported.spec);
    expect(spec.operations[0].pathTemplate).toBe("/widgets");
    expect(spec.operations[0].pagination.style).toBe("offset");
    expect(spec.operations[0].envelope).toEqual({ type: "wrapped", arrayKey: "data" });
    const matched = matchOperation(spec, "GET", "/widgets");
    const body = generateMockResponse({
      spec,
      operation: matched!.operation,
      pathParams: {},
      query: { limit: "2" },
      requestIndex: 1,
    });
    const parsed = JSON.parse(body.body);
    expect(parsed.data).toHaveLength(2);
    expect(parsed.data[0].id).not.toBe(parsed.data[1].id);
  });

  it("reads Swagger 2 definitions and reports unsupported non-JSON operations", () => {
    const imported = specFromDocument({
      swagger: "2.0",
      info: { title: "Legacy", version: "1" },
      paths: {
        "/items": {
          get: {
            responses: {
              "200": {
                schema: { $ref: "#/definitions/Item" },
              },
            },
          },
          post: {
            responses: {
              "200": { schema: { type: "file" } },
            },
          },
        },
      },
      definitions: {
        Item: {
          type: "object",
          properties: { id: { type: "string" }, status: { type: "string", enum: ["open", "closed"] } },
        },
      },
    });
    expect(imported.unsupported.some((line) => line.includes("POST /items"))).toBe(true);
    expect(validateMockSpec(imported.spec).operations).toHaveLength(1);
  });
});

describe("audited response shapes", () => {
  it("returns an OpenPhish feed as text, not a JSON object", () => {
    const spec = validateMockSpec({
      version: 1,
      source: { kind: "preset", id: "feed", name: "Feed" },
      totalRecords: 2,
      operations: [
        {
          id: "feed",
          method: "GET",
          pathTemplate: "/feed.txt",
          status: 200,
          contentType: "text/plain; charset=utf-8",
          list: false,
          envelope: { type: "object" },
          record: {
            name: "body",
            kind: "string",
            example: "https://phish.example/a\nhttps://phish.example/b",
          },
          pagination: {
            style: "none",
            limitParam: "limit",
            offsetParam: "offset",
            pageParam: "page",
            cursorParam: "cursor",
            defaultLimit: 20,
            maxLimit: 100,
          },
        },
      ],
    });
    const matched = matchOperation(spec, "GET", "/feed.txt");
    if (!matched) throw new Error("missing feed");
    const result = generateMockResponse({
      spec,
      operation: matched.operation,
      pathParams: matched.pathParams,
      query: {},
      requestIndex: 1,
    });
    expect(result.headers["content-type"]).toMatch(/^text\/plain/);
    expect(result.body).toBe("https://phish.example/a\nhttps://phish.example/b");
  });

  it("renders a Sophos Status code attribute and its text", () => {
    const spec = validateMockSpec({
      version: 1,
      source: { kind: "preset", id: "api", name: "API" },
      totalRecords: 2,
      operations: [
        {
          id: "api",
          method: "GET",
          pathTemplate: "/webconsole/APIController",
          status: 200,
          contentType: "text/xml; charset=utf-8",
          list: false,
          envelope: { type: "xml" },
          record: {
            name: "Response",
            kind: "object",
            children: [
              {
                name: "Status",
                kind: "object",
                children: [
                  { name: "code", kind: "string", example: "200", xml: { attribute: true } },
                  { name: "message", kind: "string", example: "Successful", xml: { text: true } },
                ],
              },
            ],
          },
          pagination: {
            style: "none",
            limitParam: "limit",
            offsetParam: "offset",
            pageParam: "page",
            cursorParam: "cursor",
            defaultLimit: 20,
            maxLimit: 100,
          },
        },
      ],
    });
    const matched = matchOperation(spec, "GET", "/webconsole/APIController");
    if (!matched) throw new Error("missing api");
    const result = generateMockResponse({
      spec,
      operation: matched.operation,
      pathParams: matched.pathParams,
      query: {},
      requestIndex: 1,
    });
    expect(result.body).toContain('<Status code="200">Successful</Status>');
  });
});

function idsOf(result: { body: string }): string[] {
  return result.body
    .split("\n")
    .slice(0, -1)
    .map((line) => JSON.parse(line).httpMessage.requestId as string);
}

function decodeAkamaiRule(value: string): string {
  const decoded = decodeURIComponent(value);
  const bytes = Uint8Array.from(atob(decoded), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
