import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateMockSpec } from "./mock-spec";
import { defaultChaos } from "./mock-spec";

type Scrub = { find: string; replace: string };

function scrub(value: unknown, scrubs: Scrub[]): unknown {
  if (typeof value === "string") {
    return scrubs.reduce((text, item) => text.split(item.find).join(item.replace), value);
  }
  if (Array.isArray(value)) return value.map((item) => scrub(item, scrubs));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrub(item, scrubs)]));
  }
  return value;
}

describe("vendor doc provenance", () => {
  it("deep-equals each vendor fixture to the scrubbed excerpt", () => {
    const files = readdirSync("public/presets/sources").filter((name) => name.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    let vendor = 0;
    let approximate = 0;
    for (const name of readdirSync("public/presets/integrations")) {
      if (!name.endsWith(".json")) continue;
      const preset = JSON.parse(readFileSync(`public/presets/integrations/${name}`, "utf8")) as {
        fidelity?: string;
      };
      expect(preset.fidelity).not.toBe("verified");
      if (preset.fidelity === "vendor") vendor += 1;
      if (preset.fidelity === "approximate") approximate += 1;
    }
    expect(vendor).toBe(files.length);
    expect(vendor + approximate).toBe(295);
    for (const name of files) {
      const source = JSON.parse(readFileSync(`public/presets/sources/${name}`, "utf8")) as {
        id: string;
        sourceType: string;
        docUrl: string;
        operations: Array<{ method: string; path: string; operationId?: string; excerpt: unknown; scrubs: Scrub[] }>;
      };
      expect(["vendor-example", "vendor-schema"]).toContain(source.sourceType);
      expect(source.docUrl.startsWith("https://")).toBe(true);
      const preset = JSON.parse(readFileSync(`public/presets/integrations/${name}`, "utf8")) as {
        spec: { operations: Array<{ id?: string; method: string; pathTemplate: string; fixture?: string }> };
      };
      const validated = validateMockSpec(preset.spec);
      const covered = new Set<string>();
      for (const entry of source.operations) {
        const matches = preset.spec.operations.filter((item) => {
          if (entry.operationId) return item.id === entry.operationId;
          return item.method === entry.method && item.pathTemplate === entry.path;
        });
        expect(matches, `${name} ${entry.method} ${entry.path}`).toHaveLength(1);
        const operation = matches[0];
        covered.add(operation.id || "");
        expect(operation.fixture, `${name} ${entry.method} ${entry.path}`).toBeTruthy();
        const expected = scrub(entry.excerpt, entry.scrubs || []);
        if (typeof entry.excerpt === "string") {
          expect(operation.fixture?.trim()).toBe(String(expected).trim());
        } else {
          expect(JSON.parse(operation.fixture || "")).toEqual(expected);
        }
        const kept = validated.operations.find((item) => item.id === operation.id);
        if (typeof entry.excerpt === "string") {
          expect(kept?.fixture?.trim()).toBe(String(expected).trim());
        } else {
          expect(JSON.parse(kept?.fixture || "")).toEqual(expected);
        }
      }
      for (const operation of preset.spec.operations) {
        if (operation.fixture) expect(covered.has(operation.id || "")).toBe(true);
      }
    }
  });

  it("keeps a vendor example larger than the recorded-step cap", () => {
    const fixture = JSON.stringify({ value: "x".repeat(9000) });
    const spec = validateMockSpec({
      version: 1,
      source: { kind: "manual", name: "Wide", fidelity: "vendor" },
      operations: [
        {
          id: "wide",
          method: "GET",
          pathTemplate: "/wide",
          status: 200,
          list: false,
          envelope: { type: "object" },
          record: { name: "body", kind: "object", children: [] },
          fixture,
        },
      ],
      chaos: defaultChaos(),
      totalRecords: 1,
    });
    expect(spec.operations[0].fixture).toBe(fixture);
    expect(spec.source.fidelity).toBe("vendor");
  });
});
