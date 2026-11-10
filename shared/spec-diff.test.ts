import { describe, expect, it } from "vitest";
import { revertDiff } from "./spec-diff";

const spec = (value: string, status = 200) => ({
  operations: [
    {
      method: "GET",
      pathTemplate: "/rows",
      status,
      record: { name: "row", kind: "object", children: [{ name: "id", kind: "const", constValue: value }] },
    },
  ],
});

describe("revert diff", () => {
  it("names the field change and hides secret values", () => {
    const current = spec("two");
    current.operations[0].record.children.push({ name: "password", kind: "const", constValue: "super-secret" });
    const previous = spec("one");
    const lines = revertDiff(current, previous);
    expect(lines.some((line) => line.includes("id") && line.includes("two") && line.includes("one"))).toBe(true);
    expect(lines.some((line) => line.includes("password"))).toBe(true);
    expect(lines.join(" ")).not.toContain("super-secret");
  });

  it("says when an operation would be removed", () => {
    const current = spec("one");
    current.operations.push({ method: "POST", pathTemplate: "/rows", status: 201, record: { name: "row", kind: "object", children: [] } });
    const lines = revertDiff(current, spec("one"));
    expect(lines).toContain("Revert would remove POST /rows.");
  });
});
