import { describe, expect, it } from "vitest";
import { outboundHeaders, recordUpstream } from "./record";
import type { PublicFetchResult } from "./ssrf";
import { HttpError } from "./http";

describe("record one upstream call", () => {
  it("sends the credential and returns only the scrubbed fixture", async () => {
    let sent: Record<string, string> = {};
    const result = await recordUpstream(
      {
        url: "https://api.example.com/v1/incidents?token=hide-me",
        method: "post",
        headers: {
          Authorization: "Bearer super-secret-token",
          "X-Api-Key": "key-value",
          Host: "evil.example",
          "X-Bad\r\n": "nope",
        },
        body: JSON.stringify({ name: "Ada" }),
      },
      async (_url, init) => {
        sent = init?.headers || {};
        const body: PublicFetchResult = {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "1",
            password: "hunter2",
            echo: "Bearer super-secret-token",
            owner: "ada@example.com",
          }),
          truncated: false,
        };
        return body;
      },
    );
    expect(sent.authorization).toBe("Bearer super-secret-token");
    expect(sent.host).toBeUndefined();
    expect(result.status).toBe(201);
    expect(result.step.name).toBe("Recorded POST /v1/incidents");
    const encoded = JSON.stringify(result);
    expect(encoded).not.toContain("super-secret-token");
    expect(encoded).not.toContain("hunter2");
    expect(encoded).not.toContain("ada@example.com");
    expect(encoded).not.toContain("hide-me");
    expect(result.body).toContain("\"id\":\"1\"");
  });

  it("rejects a private URL before the exchange and does not echo the credential", async () => {
    let called = false;
    await expect(
      recordUpstream(
        {
          url: "https://127.0.0.1/latest/meta-data",
          headers: { Authorization: "Bearer super-secret-token" },
        },
        async () => {
          called = true;
          return { status: 200, contentType: "text/plain", body: "no", truncated: false };
        },
      ),
    ).rejects.toBeInstanceOf(HttpError);
    expect(called).toBe(false);
  });

  it("drops header injection and hop-by-hop names", () => {
    expect(
      outboundHeaders({
        Authorization: "Bearer abc",
        "Content-Length": "10",
        "X-Name": "line\r\ninjected",
        "": "x",
      }),
    ).toEqual({ authorization: "Bearer abc" });
  });
});
