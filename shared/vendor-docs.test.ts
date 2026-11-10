import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateMockSpec } from "./mock-spec";
import { defaultChaos } from "./mock-spec";

type Scrub = { find: string; replace: string };
type Repair = { type: string; location?: number | string; before: string; after: string };

function applyRepairs(text: string, repairs: Repair[]): string {
  for (const repair of repairs) {
    if (typeof repair.location === "number") {
      const end = repair.location + repair.before.length;
      if (text.slice(repair.location, end) !== repair.before) {
        throw new Error(`${repair.type} does not match at ${repair.location}`);
      }
      text = text.slice(0, repair.location) + repair.after + text.slice(end);
      continue;
    }
    const count = text.split(repair.before).length - 1;
    if (count !== 1) throw new Error(`${repair.type} before-text must occur once`);
    text = text.replace(repair.before, repair.after);
  }
  return text;
}

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
    expect(vendor + approximate).toBe(301);
    for (const name of files) {
      const source = JSON.parse(readFileSync(`public/presets/sources/${name}`, "utf8")) as {
        id: string;
        sourceType: string;
        docUrl: string;
        label?: string;
        operations: Array<{
          method: string;
          path: string;
          operationId?: string;
          excerpt: unknown;
          scrubs?: Scrub[];
          repairs?: Repair[];
        }>;
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
        const repairs = entry.repairs || [];
        const repaired = repairs.length
          ? scrub(applyRepairs(String(entry.excerpt), repairs), entry.scrubs || [])
          : scrub(entry.excerpt, entry.scrubs || []);
        const expectBody = (fixture: string | undefined) => {
          if (repairs.length || (typeof entry.excerpt !== "string" && String(fixture || "").trim().startsWith("{"))) {
            expect(JSON.parse(fixture || "")).toEqual(
              typeof repaired === "string" ? JSON.parse(repaired) : repaired,
            );
            return;
          }
          if (typeof entry.excerpt === "string") {
            expect(fixture?.trim()).toBe(String(repaired).trim());
            return;
          }
          expect(JSON.parse(fixture || "")).toEqual(repaired);
        };
        expectBody(operation.fixture);
        const kept = validated.operations.find((item) => item.id === operation.id);
        expectBody(kept?.fixture);
      }
      if (source.operations.some((entry) => entry.repairs?.length)) {
        expect(source.label).toBe("From vendor docs (formatting fixed)");
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
