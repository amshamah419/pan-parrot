import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("preset cross-check", () => {
  it("parses urljoin, one method hop, and a contradicted envelope", () => {
    const output = execFileSync("python3", ["scripts/crosscheck_presets.py", "--self-test"], {
      encoding: "utf8",
    });
    expect(output).toContain("self-test ok");
  });
});
