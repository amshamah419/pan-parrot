import { describe, expect, it } from "vitest";
import { trustLabel } from "./TrustBadge";

describe("trust label", () => {
  it("names a repaired vendor example", () => {
    expect(trustLabel("vendor", "vendor", true)).toBe("From vendor docs (formatting fixed)");
    expect(trustLabel("vendor", "vendor")).toBe("From vendor docs");
    expect(trustLabel("approximate", "approximate", true)).toBe("Approximate");
  });
});
