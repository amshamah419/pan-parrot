import { describe, expect, it } from "vitest";
import { checkMockAuth, signEdgeGrid } from "./mock-auth";
import { defaultChaos, type MockSpec } from "./mock-spec";

function spec(auth: MockSpec["auth"]): MockSpec {
  return {
    version: 1,
    source: { kind: "manual", name: "auth" },
    operations: [
      {
        id: "get",
        method: "GET",
        pathTemplate: "/data",
        status: 200,
        contentType: "application/json",
        headers: {},
        list: false,
        envelope: { type: "object" },
        pagination: {
          style: "none",
          limitParam: "limit",
          offsetParam: "offset",
          pageParam: "page",
          cursorParam: "cursor",
          defaultLimit: 1,
          maxLimit: 1,
        },
        record: { name: "item", kind: "string" },
      },
    ],
    chaos: defaultChaos(),
    totalRecords: 1,
    auth,
  };
}

const request = {
  method: "GET",
  path: "/catch/demo/data",
  query: {},
  headers: {},
  body: "",
  scheme: "https",
  host: "parrot.example",
};

describe("mock auth", () => {
  it("answers a Digest client with a challenge, then accepts the response", () => {
    const now = Date.parse("2026-11-09T12:00:00Z");
    const mock = spec({
      mode: "digest",
      digest: { realm: "pan-parrot", username: "lab", password: "dummy-not-a-real-password" },
    });
    const challenge = checkMockAuth(mock, request, now);
    expect(challenge.status).toBe(401);
    expect(challenge.headers["www-authenticate"]).toContain("Digest");
    const nonce = /nonce="([^"]+)"/.exec(challenge.headers["www-authenticate"])?.[1] || "";
    const crypto = require("node:crypto");
    const md5 = (value: string) => crypto.createHash("md5").update(value).digest("hex");
    const ha1 = md5("lab:pan-parrot:dummy-not-a-real-password");
    const ha2 = md5("GET:/catch/demo/data");
    const response = md5(`${ha1}:${nonce}:00000001:abc:auth:${ha2}`);
    const ok = checkMockAuth(mock, {
      ...request,
      headers: {
        authorization: `Digest username="lab", realm="pan-parrot", nonce="${nonce}", uri="/catch/demo/data", qop=auth, nc=00000001, cnonce="abc", response="${response}"`,
      },
    }, now + 1000);
    expect(ok.ok).toBe(true);
  });

  it("issues a CrowdStrike-shaped token and accepts it until it expires", () => {
    const now = Date.parse("2026-11-09T00:00:00Z");
    const mock = spec({
      mode: "oauth2",
      oauth2: {
        tokenPath: "/oauth2/token",
        clientId: "dummy-falcon-client",
        clientSecret: "dummy-falcon-secret",
        ttlSeconds: 60,
        shape: "crowdstrike",
      },
    });
    const issued = checkMockAuth(mock, {
      ...request,
      method: "POST",
      path: "/oauth2/token",
      body: "client_id=dummy-falcon-client&client_secret=dummy-falcon-secret",
    }, now);
    const token = JSON.parse(issued.body).access_token as string;
    const accepted = checkMockAuth(mock, {
      ...request,
      headers: { authorization: `Bearer ${token}` },
    }, now + 1000);
    expect(accepted.ok).toBe(true);
    const expired = checkMockAuth(mock, {
      ...request,
      headers: { authorization: `Bearer ${token}` },
    }, now + 120_000);
    expect(expired.status).toBe(401);
  });

  it("checks an EdgeGrid signature and rejects a stale timestamp", () => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}+0000`;
    const edge = {
      clientToken: "dummy-client-token",
      accessToken: "dummy-access-token",
      clientSecret: "dummy-not-a-real-secret",
      verify: "signature" as const,
    };
    const authorization = signEdgeGrid({
      method: "GET",
      scheme: "https",
      host: "parrot.example",
      path: "/catch/demo/siem/v1/configs/1",
      clientToken: edge.clientToken,
      accessToken: edge.accessToken,
      clientSecret: edge.clientSecret,
      timestamp,
      nonce: "nonce-1",
    });
    const mock = spec({ mode: "edgegrid", edgegrid: edge });
    const ok = checkMockAuth(mock, {
      ...request,
      path: "/catch/demo/siem/v1/configs/1",
      headers: { authorization },
    });
    expect(ok.ok).toBe(true);
    const stale = signEdgeGrid({
      method: "GET",
      scheme: "https",
      host: "parrot.example",
      path: "/catch/demo/siem/v1/configs/1",
      clientToken: edge.clientToken,
      accessToken: edge.accessToken,
      clientSecret: edge.clientSecret,
      timestamp: "20200101T00:00:00+0000",
      nonce: "nonce-1",
    });
    expect(checkMockAuth(mock, {
      ...request,
      path: "/catch/demo/siem/v1/configs/1",
      headers: { authorization: stale },
    }).ok).toBe(false);
  });
});
