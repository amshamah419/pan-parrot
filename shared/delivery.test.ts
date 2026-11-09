import { describe, expect, it } from "vitest";
import { expandToBytes, generateMockResponse } from "./generate";
import { defaultChaos, validateMockSpec, type MockSpec } from "./mock-spec";
import { singleByteRange } from "./range";

function spec(partial: Partial<MockSpec["operations"][number]>, chaos = defaultChaos()): MockSpec {
  return validateMockSpec({
    version: 1,
    source: { kind: "manual", name: "Delivery" },
    operations: [
      {
        id: "rows",
        method: "GET",
        pathTemplate: "/rows",
        status: 200,
        contentType: "application/json",
        list: true,
        envelope: { type: "array" },
        record: {
          name: "row",
          kind: "object",
          children: [{ name: "id", kind: "const", constValue: "row" }],
        },
        ...partial,
      },
    ],
    chaos,
    totalRecords: 4,
  });
}

describe("large responses", () => {
  it("streams list rows as NDJSON and can pad a download to a byte target", () => {
    const streamed = generateMockResponse({
      spec: spec({ stream: true }),
      operation: spec({ stream: true }).operations[0],
      pathParams: {},
      query: { limit: "2" },
      requestIndex: 1,
    });
    expect(streamed.stream).toBe(true);
    expect(streamed.headers["content-type"]).toContain("ndjson");
    expect(streamed.body.split("\n").length).toBeGreaterThan(1);

    const file = generateMockResponse({
      spec: spec({ downloadBytes: 5000, pack: { format: "gzip", filename: "rows.csv.gz", entryName: "rows.csv", entryFormat: "csv" } }),
      operation: spec({ downloadBytes: 5000 }).operations[0],
      pathParams: {},
      query: { limit: "1" },
      requestIndex: 1,
    });
    expect(file.body.length).toBe(5000);
    expect(expandToBytes("a", 12)).toBe("aaaaaaaaaaaa");
  });

  it("cuts a partial body and parses one byte range", () => {
    const chaos = { ...defaultChaos(), enabled: true, mode: "every-nth" as const, everyNth: 1, partial: true };
    const result = generateMockResponse({
      spec: spec({ stream: true }, chaos),
      operation: spec({ stream: true }, chaos).operations[0],
      pathParams: {},
      query: { limit: "2" },
      requestIndex: 1,
    });
    expect(result.chaosEffects).toContain("partial");
    expect(result.body.length).toBeGreaterThan(0);
    expect(singleByteRange(100, "bytes=0-9")).toEqual({ start: 0, end: 9 });
    expect(singleByteRange(100, "bytes=-5")).toEqual({ start: 95, end: 99 });
    expect(singleByteRange(100, "bytes=0-1,2-3")).toBe("invalid");
    expect(singleByteRange(100, "bytes=100-120")).toBe("invalid");
  });
});
