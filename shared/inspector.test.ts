import { describe, expect, it } from "vitest";
import type { CapturedRequest } from "./api";
import {
  lineDiff,
  matchesInspector,
  nextTheme,
  replayHeaders,
  themeIsDark,
  toCurl,
  toPythonRequests,
} from "./inspector";

function call(partial: Partial<CapturedRequest>): CapturedRequest {
  return {
    id: partial.id || "1",
    method: partial.method || "POST",
    endpoint: partial.endpoint || "/catch/hooks",
    timestamp: "2026-11-10T00:00:00.000Z",
    status: partial.status ?? 200,
    ip: "203.0.113.10",
    userAgent: "vitest",
    headers: partial.headers || { "content-type": "application/json", authorization: "[redacted]" },
    body: partial.body ?? { event: "login" },
    query: partial.query || {},
    userId: "user",
  };
}

describe("request inspector", () => {
  it("filters by method, status, path, header, and body", () => {
    const rows = [
      call({ id: "a", method: "GET", status: 200, endpoint: "/catch/siem", body: { kind: "dns" } }),
      call({ id: "b", method: "POST", status: 401, endpoint: "/catch/hooks", body: { event: "login" } }),
    ];
    expect(matchesInspector(rows[0], { search: "", method: "GET", status: "", path: "", header: "", body: "" })).toBe(true);
    expect(matchesInspector(rows[1], { search: "", method: "GET", status: "", path: "", header: "", body: "" })).toBe(false);
    expect(matchesInspector(rows[1], { search: "", method: "all", status: "401", path: "", header: "", body: "" })).toBe(true);
    expect(matchesInspector(rows[0], { search: "", method: "all", status: "", path: "siem", header: "", body: "" })).toBe(true);
    expect(matchesInspector(rows[1], { search: "", method: "all", status: "", path: "", header: "authorization", body: "" })).toBe(true);
    expect(matchesInspector(rows[0], { search: "", method: "all", status: "", path: "", header: "", body: "dns" })).toBe(true);
    expect(matchesInspector(rows[0], { search: "post", method: "all", status: "", path: "", header: "", body: "" })).toBe(false);
    expect(matchesInspector(rows[1], { search: "login", method: "all", status: "", path: "", header: "", body: "" })).toBe(true);
  });

  it("copies curl and Python without redacted headers", () => {
    const request = call({ query: { limit: "2" } });
    const curl = toCurl(request, "https://parrot.example");
    expect(curl).toContain("curl -X POST 'https://parrot.example/catch/hooks?limit=2'");
    expect(curl).toContain("content-type: application/json");
    expect(curl).not.toContain("authorization");
    expect(curl).toContain("--data");
    const python = toPythonRequests(request, "https://parrot.example");
    expect(python).toContain("import requests");
    expect(python).toContain('"POST"');
    expect(python).toContain("limit=2");
    expect(python).not.toContain("[redacted]");
  });

  it("diffs two calls side by side", () => {
    const rows = lineDiff("POST /a\nstatus 200\n---\n{}", "POST /a\nstatus 404\n---\n{}");
    expect(rows.some((row) => row.kind === "remove" && row.left === "status 200")).toBe(true);
    expect(rows.some((row) => row.kind === "add" && row.right === "status 404")).toBe(true);
    expect(rows.some((row) => row.kind === "same" && row.left === "POST /a")).toBe(true);
  });

  it("drops hop-by-hop and redacted headers before a replay", () => {
    expect(
      replayHeaders({
        host: "parrot.example",
        "content-length": "12",
        authorization: "[redacted]",
        "content-type": "application/json",
      }),
    ).toEqual({ "content-type": "application/json" });
  });

  it("follows the system theme until a saved choice overrides it", () => {
    expect(themeIsDark("system", true)).toBe(true);
    expect(themeIsDark("system", false)).toBe(false);
    expect(themeIsDark("light", true)).toBe(false);
    expect(themeIsDark("dark", false)).toBe(true);
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });
});
