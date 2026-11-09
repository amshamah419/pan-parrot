import { describe, expect, it } from "vitest";
import { generateMockResponse } from "./generate";
import { verifiedPresets } from "./verified-presets";

describe("verified presets", () => {
  it("generates a body for every operation", () => {
    const ids = new Set<string>();
    for (const preset of verifiedPresets) {
      expect(ids.has(preset.id), preset.id).toBe(false);
      ids.add(preset.id);
      expect(preset.spec.source.verification?.status).toBe("verified");
      expect(preset.spec.source.verification?.docUrl).toMatch(/^https:\/\//);
      expect(preset.spec.source.verification?.checkedAt).toBe("2026-11-09");
      expect(preset.spec.source.verification?.differences?.length).toBeGreaterThan(0);
      for (const operation of preset.spec.operations) {
        const result = generateMockResponse({
          spec: preset.spec,
          operation,
          pathParams: { index: "logs", userId: "me", id: "1", search_id: "abc", job_id: "job", org_key: "org" },
          query: { limit: "2", $top: "2", size: "2", MaxResults: "2" },
          requestIndex: 1,
        });
        expect(result.body.length, `${preset.id} ${operation.id}`).toBeGreaterThan(0);
        const loose = operation.envelope.type === "xml" || operation.envelope.type === "soap" || operation.envelope.type === "splunk-export" || operation.envelope.type === "ndjson";
        if (!loose) {
          expect(() => JSON.parse(result.body), `${preset.id} ${operation.id}`).not.toThrow();
        }
      }
    }
    expect(ids.size).toBeGreaterThanOrEqual(35);
  });
});