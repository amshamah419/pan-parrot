import { describe, expect, it } from "vitest";
import { defaultBehavior, validateMockSpec } from "./mock-spec";
import { recordedStepName, scrubRecording, scrubText } from "./recording";

describe("recorded response scrubbing", () => {
  it("removes secrets, tokens, and obvious contact details", () => {
    const raw = JSON.stringify({
      id: "inc-1",
      password: "hunter2",
      apiKey: "abcd",
      owner: "ada@example.com",
      note: "Bearer super-secret-token and AKIAIOSFODNN7EXAMPLE",
      jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.signature",
      ssn: "123-45-6789",
      phone: "415-555-1212",
      status: "open",
    });
    const { body } = scrubRecording(raw, "application/json");
    const parsed = JSON.parse(body) as Record<string, string>;
    expect(parsed.status).toBe("open");
    expect(parsed.id).toBe("inc-1");
    expect(parsed.password).toBe("[redacted]");
    expect(parsed.apiKey).toBe("[redacted]");
    expect(parsed.owner).toBe("[redacted-email]");
    expect(parsed.phone).toBe("[redacted]");
    expect(parsed.ssn).toBe("[redacted]");
    expect(body).not.toContain("hunter2");
    expect(body).not.toContain("super-secret-token");
    expect(body).not.toContain("AKIA");
    expect(body).not.toContain("ada@example.com");
    expect(body).not.toContain("eyJhbGci");
    expect(body).not.toContain("123-45-6789");
    expect(body).not.toContain("415-555-1212");
  });

  it("redacts secret XML tags and keeps the step name free of the query", () => {
    const { body } = scrubRecording("<key>s3cret</key><msg>ada@example.com</msg>", "text/xml");
    expect(body).toContain("<key>[redacted]</key>");
    expect(body).not.toContain("s3cret");
    expect(body).not.toContain("ada@example.com");
    expect(recordedStepName("GET", "https://api.example.com/v1/items?token=hide-me")).toBe(
      "Recorded GET /v1/items",
    );
    expect(scrubText("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----")).toBe("[redacted]");
  });

  it("keeps a recorded error status and an 8 KB body on the spec", () => {
    const spec = validateMockSpec({
      version: 1,
      source: { kind: "manual", name: "Recorded" },
      operations: [
        {
          id: "op",
          method: "GET",
          pathTemplate: "/items",
          status: 200,
          contentType: "application/json",
          list: false,
          envelope: { type: "object" },
          record: { name: "item", kind: "string" },
        },
      ],
      chaos: { enabled: false },
      totalRecords: 1,
      behavior: {
        ...defaultBehavior(),
        scenario: {
          enabled: true,
          repeat: "last",
          steps: [{ name: "Recorded GET /items", status: 404, body: "x".repeat(9000) }],
        },
      },
    });
    expect(spec.behavior?.scenario.steps[0].status).toBe(404);
    expect(spec.behavior?.scenario.steps[0].body?.length).toBe(8000);
  });
});
