import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface DatasetSample {
  dataset: string;
  schemaPath: string;
  xifPath: string;
  parsingPath: string;
  vendor: string;
  product: string;
  fields: Array<{ name: string }>;
  sample: Record<string, unknown>;
  sampleSource: string;
  fieldsFromTestData: string[];
  fieldsAbsentFromTestData: string[];
  declaredInXif: boolean;
}

interface Catalog {
  contentCommit: string;
  datasets: DatasetSample[];
  correlations: Array<{ name: string; xqlQuery: string; sourcePath: string; dataset: string }>;
}

const catalog = JSON.parse(readFileSync("public/xsiam/samples.json", "utf8")) as Catalog;

describe("XSIAM samples", () => {
  it("keeps sample keys inside the modeling-rule schema", () => {
    expect(catalog.contentCommit).toBe("ff4a8f7ee870499a73807b538cdbf42ee9f6c8f1");
    expect(catalog.datasets.length).toBeGreaterThan(0);
    for (const dataset of catalog.datasets) {
      const names = new Set(dataset.fields.map((field) => field.name));
      for (const key of Object.keys(dataset.sample)) {
        expect(names.has(key), `${dataset.dataset} invented ${key}`).toBe(true);
      }
      expect(dataset.schemaPath).toContain("/ModelingRules/");
      expect(dataset.schemaPath.endsWith("_schema.json")).toBe(true);
      expect(dataset.xifPath.endsWith(".xif")).toBe(true);
      expect(dataset.declaredInXif).toBe(true);
      for (const name of dataset.fieldsFromTestData) {
        expect(name in dataset.sample).toBe(true);
      }
      for (const name of dataset.fieldsAbsentFromTestData) {
        expect(name in dataset.sample).toBe(false);
      }
      if (dataset.sampleSource) {
        expect(dataset.sampleSource).toContain("/test_data/");
        expect(dataset.fieldsFromTestData.length).toBeGreaterThan(0);
      }
    }
  });

  it("copies the Okta test event and the Defender correlation query", () => {
    const okta = catalog.datasets.find((dataset) => dataset.dataset === "okta_okta_raw");
    expect(okta?.sample.eventType).toBe("group.user_membership.remove");
    expect(okta?.sampleSource).toBe("Packs/Okta/Integrations/Okta_v2/test_data/get_logs_response.json");
    expect(okta?.vendor).toBe("okta");
    expect(okta?.product).toBe("okta");
    expect(okta?.parsingPath).toContain("/ParsingRules/");
    expect(okta?.fieldsAbsentFromTestData).toEqual([]);
    const rule = catalog.correlations.find((item) => item.sourcePath.includes("MicrosoftDefenderAdvancedThreatProtection"));
    expect(rule?.name).toBe("Microsoft Defender for Endpoint - Malware Detected");
    expect(rule?.xqlQuery).toContain("microsoft_365_defender_raw");
    expect(rule?.dataset).toBe("alerts");
  });
});
