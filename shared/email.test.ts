import { describe, expect, it } from "vitest";
import { normalizePanEmail } from "./email";

describe("normalizePanEmail", () => {
  it("accepts a real PAN address case-insensitively", () => {
    expect(normalizePanEmail("Ashamah@PaloAltoNetworks.COM")).toBe(
      "ashamah@paloaltonetworks.com",
    );
  });

  it("trims surrounding whitespace and allows plus addressing", () => {
    expect(normalizePanEmail("  first.last+ops@paloaltonetworks.com  ")).toBe(
      "first.last+ops@paloaltonetworks.com",
    );
  });

  it("accepts a fullwidth domain only when NFKC folds it to the real domain", () => {
    const fullwidth = "ashamah@\uff50aloaltonetworks.com";
    expect(normalizePanEmail(fullwidth)).toBe("ashamah@paloaltonetworks.com");
  });

  it.each([
    ["subdomain", "ashamah@mail.paloaltonetworks.com"],
    ["lookalike suffix", "ashamah@paloaltonetworks.com.evil.com"],
    ["trailing dot", "ashamah@paloaltonetworks.com."],
    ["leading dot in domain", "ashamah@.paloaltonetworks.com"],
    ["plus that changes the domain", "ashamah@paloaltonetworks.com+evil.com"],
    ["second at sign", "ashamah@paloaltonetworks.com@evil.com"],
    ["cyrillic lookalike", "ashamah@p\u0430loaltonetworks.com"],
    ["null byte", "ashamah@paloaltonetworks.com\u0000.evil.com"],
    ["encoded newline text", "ashamah@paloaltonetworks.com%0a.evil.com"],
    ["header injection", "ashamah@paloaltonetworks.com\r\nBcc:evil@evil.com"],
    ["missing local part", "@paloaltonetworks.com"],
    ["other domain", "ashamah@gmail.com"],
    ["almost the domain", "ashamah@paloaltonetworks.co"],
    ["quoted local part", '"ashamah"@paloaltonetworks.com'],
    ["empty", ""],
    ["not a string", null],
  ])("rejects %s", (_label, value) => {
    expect(normalizePanEmail(value)).toBeNull();
  });
});
