import { describe, expect, it } from "vitest";
import { capturedPackFiles, contentPackFiles, diffJsonShape } from "./content-pack";
import { defaultBehavior, defaultChaos, validateMockSpec, type MockOperation } from "./mock-spec";

const operation: MockOperation = {
  id: "list-offenses",
  method: "GET",
  pathTemplate: "/siem/offenses",
  status: 200,
  contentType: "application/json",
  headers: {},
  list: true,
  envelope: { type: "array" },
  pagination: {
    style: "offset",
    limitParam: "limit",
    offsetParam: "offset",
    pageParam: "page",
    cursorParam: "cursor",
    defaultLimit: 2,
    maxLimit: 10,
  },
  record: {
    name: "offense",
    kind: "object",
    children: [
      { name: "id", kind: "integer" },
      { name: "status", kind: "const", constValue: "OPEN" },
      { name: "note", kind: "string", optional: true },
    ],
  },
};

function spec() {
  return validateMockSpec({
    version: 1,
    source: { kind: "manual", name: "QRadar" },
    operations: [operation],
    chaos: defaultChaos("qradar"),
    totalRecords: 2,
    auth: { mode: "api-key", apiKey: { in: "header", name: "SEC", value: "dummy-secret-value" } },
    behavior: {
      ...defaultBehavior(),
      scenario: {
        enabled: true,
        repeat: "last",
        steps: [{ name: "Empty page", status: 200, body: "{\"offenses\":[]}" }],
      },
    },
  });
}

describe("content pack fixtures", () => {
  it("writes a raw test_data file, a scenario file, and a README snippet", () => {
    const files = contentPackFiles(spec());
    const offense = files.find((file) => file.name === "test_data/list-offenses.json");
    const step = files.find((file) => file.name.startsWith("test_data/scenario-1-"));
    const readme = files.find((file) => file.name === "README.md");
    expect(JSON.parse(offense?.text || "[]")[0].status).toBe("OPEN");
    expect(step?.text).toContain("offenses");
    expect(readme?.text).toContain("util_load_json");
    expect(readme?.text).toContain("mock_response");
    expect(JSON.stringify(files)).not.toContain("dummy-secret-value");
  });

  it("turns captured response previews into raw files", () => {
    const files = capturedPackFiles([
      { method: "GET", path: "/siem/offenses", status: 200, responsePreview: "[{\"id\":1}]", truncated: false },
    ]);
    expect(files[0].name).toMatch(/test_data\/1-get-siem-offenses\.json/);
    expect(JSON.parse(files[0].text)).toEqual([{ id: 1 }]);
    expect(files.find((file) => file.name === "README.md")?.text).toContain("GET /siem/offenses");
  });

  it("flags missing and extra fields and skips optional ones", () => {
    const diff = diffJsonShape(operation, [{ id: 1, status: "OPEN", extra: true }]);
    expect(diff.missing).toEqual([]);
    expect(diff.extra).toEqual(["extra"]);
    const missing = diffJsonShape(operation, [{ status: "OPEN" }]);
    expect(missing.missing).toEqual(["id"]);
    const optional = diffJsonShape(operation, [{ id: 2, status: "OPEN" }]);
    expect(optional.missing).not.toContain("note");
  });

  it("unwraps an OData value array before comparing", () => {
    const alerts: MockOperation = {
      ...operation,
      id: "alerts",
      envelope: { type: "odata", context: "https://example.test/$metadata#Alerts" },
      record: {
        name: "alert",
        kind: "object",
        children: [{ name: "id", kind: "id" }, { name: "title", kind: "string" }],
      },
    };
    const diff = diffJsonShape(alerts, { "@odata.context": "x", value: [{ id: "a" }] });
    expect(diff.missing).toEqual(["title"]);
    expect(diff.extra).toEqual([]);
  });
});
