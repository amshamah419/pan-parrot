import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pins: Record<string, string> = {
  "microsoftgraphfiles-microsoftgraphfiles": "/v1.0/sites",
  "microsoftgraphdevicemanagement-microsoftgraphdevicemanagement": "/v1.0/deviceManagement/managedDevices",
  "azureriskyusers-azureriskyusers": "/v1.0/identityProtection/riskDetections",
  "azurecompute-azurecompute-v2": "/{resource_group}/providers/Microsoft.Compute/virtualMachines",
  "oktastandardconnector-oktastandardconnector": "/api/v1/logs",
  "box-boxv2": "/2.0/events",
  "salesforcev2-salesforcev2": "/services/data/v39.0/sobjects/Case/describe",
  "darktrace-darktraceeventcollector": "/modelbreaches",
  "vectra-ai-vectradetect": "/api/v2.5/search/detections",
  "virustotal-virustotal-v3-premium": "/api/v3/intelligence/search",
};

describe("popular catalog presets", () => {
  it("verifies client paths from the most-used packs", () => {
    const files = readdirSync("public/presets/integrations").filter((name) => name.endsWith(".json"));
    let clientChecked = 0;
    for (const name of files) {
      const preset = JSON.parse(readFileSync(`public/presets/integrations/${name}`, "utf8")) as {
        fidelity?: string;
        spec?: { operations?: Array<{ pathTemplate?: string }> };
      };
      if (preset.fidelity !== "approximate" && preset.fidelity !== "vendor") continue;
      clientChecked += 1;
      for (const operation of preset.spec?.operations || []) {
        expect(operation.pathTemplate || "", name).not.toContain("/:");
      }
    }
    expect(clientChecked).toBe(300);
    for (const [id, path] of Object.entries(pins)) {
      const preset = JSON.parse(readFileSync(`public/presets/integrations/${id}.json`, "utf8")) as {
        fidelity: string;
        sourceUrl: string;
        spec: { operations: Array<{ pathTemplate: string }> };
      };
      expect(["vendor", "approximate"]).toContain(preset.fidelity);
      expect(preset.sourceUrl).toContain("github.com/demisto/content/");
      expect(preset.spec.operations[0]?.pathTemplate).toBe(path);
    }
  });
});
