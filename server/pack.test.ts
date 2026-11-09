import { describe, expect, it } from "vitest";
import { readZip, zipEntries } from "./pack";

describe("zip packing", () => {
  it("round-trips a JSON entry and rejects a path that escapes", () => {
    const packed = zipEntries([{ name: "mta.json", data: Buffer.from('{"type":"MTA"}') }]);
    const entries = readZip(packed);
    expect(entries[0].name).toBe("mta.json");
    expect(entries[0].data.toString()).toBe('{"type":"MTA"}');
    expect(() => zipEntries([{ name: "../secret.txt", data: Buffer.from("no") }])).toThrow(/path/);
  });
});
