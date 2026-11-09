import { describe, expect, it } from "vitest";
import { validateMockSpec } from "./mock-spec";
import { fieldsFromOutputs, sampleFromReadme } from "./xsoar-shape";

describe("XSOAR YAML shapes", () => {
  it("nests context paths and keeps types", () => {
    const record = fieldsFromOutputs([
      { contextPath: "CloudShark.CaptureInfo.CaptureID", type: "String" },
      { contextPath: "CloudShark.CaptureInfo.Size", type: "Number" },
      { contextPath: "CloudShark.CaptureInfo.CreatedAt", type: "Date" },
      { contextPath: "File", type: "String" },
    ]);
    expect(record?.kind).toBe("object");
    const cloud = record?.children?.find((child) => child.name === "CloudShark");
    const info = cloud?.children?.find((child) => child.name === "CaptureInfo");
    expect(info?.children?.find((child) => child.name === "CaptureID")?.kind).toBe("id");
    expect(info?.children?.find((child) => child.name === "Size")?.kind).toBe("number");
    expect(info?.children?.find((child) => child.name === "CreatedAt")?.kind).toBe("timestamp");
    expect(record?.children?.find((child) => child.name === "File")?.kind).toBe("string");
    validateMockSpec({
      version: 1,
      source: { kind: "preset", name: "CloudShark" },
      operations: [
        {
          id: "info",
          method: "GET",
          pathTemplate: "/info/{id}",
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
        },
      ],
      chaos: {
        enabled: false,
        seed: "xsoar",
        mode: "probability",
        probability: 0.25,
        everyNth: 5,
        duplicateRecords: false,
        missingFields: false,
        mixedTimestamps: false,
        outOfOrder: false,
        wrongTypes: false,
        truncatedJson: false,
        malformedJson: false,
        wrongContentType: false,
        randomErrors: false,
        latency: false,
        paginationGlitch: "none",
      },
      totalRecords: 20,
    });
  });

  it("reads a JSON example out of a README fence", () => {
    const sample = sampleFromReadme("Example:\n```json\n{\"id\": \"1\"}\n```\n");
    expect(JSON.parse(sample || "{}").id).toBe("1");
    expect(sampleFromReadme("```\nnot json\n```")).toBeNull();
  });
});
