import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { commandCoverageLabel, validateMockSpec } from "./mock-spec";

describe("AWS command coverage", () => {
  it("states vendor, approximate, and missing counts", () => {
    expect(commandCoverageLabel({ total: 66, vendor: 62, approximate: 0, missing: 4 })).toBe(
      "62 of 66 commands from vendor docs, 0 approximate, 4 missing",
    );
  });

  it("keeps the catalog counts and the IAM vendor examples", () => {
    const index = JSON.parse(readFileSync("public/presets/index.json", "utf8")) as {
      presets: Array<{ id: string; commandCoverage?: { total: number; vendor: number; approximate: number; missing: number } }>;
    };
    const covered = index.presets.filter((preset) => preset.commandCoverage);
    expect(covered.length).toBeGreaterThan(0);
    let vendor = 0;
    let approximate = 0;
    let missing = 0;
    for (const preset of covered) {
      const row = preset.commandCoverage!;
      expect(row.vendor + row.approximate + row.missing).toBe(row.total);
      vendor += row.vendor;
      approximate += row.approximate;
      missing += row.missing;
    }
    expect(vendor).toBe(194);
    expect(approximate).toBe(31);
    expect(missing).toBe(447);

    const iam = JSON.parse(readFileSync("public/presets/integrations/aws-iam-aws-iam.json", "utf8")) as {
      spec: Parameters<typeof validateMockSpec>[0];
    };
    const spec = validateMockSpec(iam.spec);
    const users = spec.source.commandDocs?.find((row) => row.command === "aws-iam-list-users");
    expect(users).toMatchObject({ status: "vendor", calls: ["iam:ListUsers"] });
    const operation = spec.operations.find((item) => item.awsAction === "ListUsers");
    expect(operation?.fixture).toContain("ListUsersResponse");
    expect(operation?.queryMatch).toEqual({ Action: "ListUsers" });
  });
});
