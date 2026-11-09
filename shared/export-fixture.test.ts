import { describe, expect, it } from "vitest";
import { defaultChaos, validateMockSpec } from "./mock-spec";
import { exportFixture } from "./export-fixture";

describe("pytest export", () => {
  it("writes an offline requests_mock test and leaves out dummy secrets", () => {
    const spec = validateMockSpec({
      version: 1,
      source: { kind: "manual", name: "Hello" },
      operations: [
        {
          id: "hello",
          method: "GET",
          pathTemplate: "/hello/{id}",
          status: 200,
          contentType: "application/json",
          list: false,
          envelope: { type: "object" },
          record: {
            name: "hello",
            kind: "object",
            children: [{ name: "message", kind: "const", constValue: "hi" }],
          },
        },
      ],
      chaos: defaultChaos(),
      totalRecords: 1,
      auth: { mode: "api-key", apiKey: { in: "header", name: "X-Api-Key", value: "dummy-secret-value" } },
    });
    const files = exportFixture(spec, "https://example.test/catch/hello");
    expect(files.pytest).toContain("requests_mock");
    expect(files.pytest).not.toContain("dummy-secret-value");
    const data = JSON.parse(files.testData) as { operations: Array<{ path: string; body: { message: string } }> };
    expect(data.operations[0].path).toBe("/hello/example");
    expect(data.operations[0].body.message).toBe("hi");
    expect(files.testData).not.toContain("dummy-secret-value");
  });
});
