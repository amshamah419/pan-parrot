import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateMockSpec, type MockSpec, type PushSpec } from "../shared/mock-spec";
import { deliverPush } from "./push";
import { fetchPublic } from "./ssrf";

function spec(push: PushSpec): MockSpec {
  return validateMockSpec({
    version: 1,
    source: { kind: "manual", name: "Push" },
    operations: [
      {
        id: "op",
        method: "POST",
        pathTemplate: "/events",
        status: 200,
        contentType: "application/json",
        list: false,
        envelope: { type: "object" },
        record: {
          name: "event",
          kind: "object",
          children: [{ name: "title", kind: "const", constValue: "alert" }],
        },
      },
    ],
    chaos: { enabled: false },
    totalRecords: 1,
    push,
  });
}

const base: PushSpec = {
  enabled: true,
  url: "https://collector.example.com/hook",
  intervalMinutes: 0,
  batch: 1,
  retries: 1,
  signing: "hmac-sha256",
  secret: "topsecret",
};

describe("outbound push", () => {
  it("signs the body, retries a 500, and does not follow a redirect", async () => {
    const seen: Array<{ body?: string; signature?: string }> = [];
    let calls = 0;
    const outcome = await deliverPush(spec(base), async (_url, init) => {
      calls += 1;
      seen.push({ body: init?.body, signature: init?.headers?.["x-pan-parrot-signature"] });
      if (calls === 1) return { status: 500, contentType: "text/plain", body: "no", truncated: false };
      return { status: 202, contentType: "application/json", body: "{}", truncated: false };
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.attempts).toBe(2);
    const digest = createHmac("sha256", "topsecret").update(seen[0].body || "").digest("hex");
    expect(seen[0].signature).toBe(`sha256=${digest}`);
    expect(JSON.stringify(outcome)).not.toContain("topsecret");

    const redirected = await deliverPush(spec({ ...base, retries: 2, signing: "none", secret: undefined }), async () => {
      return { status: 302, contentType: "", body: "", truncated: false };
    });
    expect(redirected.ok).toBe(false);
    expect(redirected.attempts).toBe(1);
    expect(redirected.error).toContain("redirect");
  });

  it("rejects a private URL before any request and hides the secret", async () => {
    expect(() => spec({ ...base, url: "https://127.0.0.1/hook", signing: "bearer", secret: "super-secret-push" })).toThrow(
      /not allowed/,
    );
    const saved = spec(base);
    saved.push = { ...base, url: "https://10.1.2.3/hook", signing: "bearer", secret: "super-secret-push" };
    const outcome = await deliverPush(saved, fetchPublic);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("not allowed");
    expect(JSON.stringify(outcome)).not.toContain("super-secret-push");
  });
});
