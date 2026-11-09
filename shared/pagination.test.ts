import { describe, expect, it } from "vitest";
import { generateMockResponse, matchOperation } from "./generate";
import { validateMockSpec, type MockSpec } from "./mock-spec";
import { applyVendorPagination, type VendorPageStyle } from "./pagination";

function specFor(style: VendorPageStyle): MockSpec {
  const base = validateMockSpec({
    version: 1,
    source: { name: "Paging" },
    totalRecords: 7,
    operations: [
      {
        id: "list",
        method: "GET",
        pathTemplate: "/incidents",
        list: true,
        record: {
          name: "incident",
          kind: "object",
          children: [{ name: "id", kind: "id" }],
        },
        pagination: {
          style: "offset",
          limitParam: "limit",
          offsetParam: "offset",
          pageParam: "page",
          cursorParam: "cursor",
          defaultLimit: 3,
          maxLimit: 3,
        },
      },
    ],
  });
  return validateMockSpec({
    ...base,
    operations: [applyVendorPagination(base.operations[0], style)],
  });
}

function respond(spec: MockSpec, query: Record<string, string>) {
  const matched = matchOperation(spec, "GET", "/incidents");
  if (!matched) throw new Error("missing operation");
  return generateMockResponse({
    spec,
    operation: matched.operation,
    pathParams: {},
    query,
    requestIndex: 1,
    requestUrl: "https://parrot.example/catch/demo/incidents",
  });
}

function idsFrom(style: VendorPageStyle, body: string): string[] {
  if (style === "akamai") {
    return body
      .split("\n")
      .slice(0, -1)
      .filter(Boolean)
      .map((line) => JSON.parse(line).id as string);
  }
  const parsed = JSON.parse(body) as unknown;
  const rows = Array.isArray(parsed)
    ? parsed
    : ((parsed as { items?: unknown[] }).items ?? []);
  return rows.map((row) => (row as { id: string }).id);
}

function nextQuery(style: VendorPageStyle, body: string, headers: Record<string, string>, query: Record<string, string>): Record<string, string> | null {
  if (style === "cursor") {
    const token = (JSON.parse(body) as { nextToken?: string }).nextToken;
    return token ? { ...query, cursor: token } : null;
  }
  if (style === "link") {
    const header = headers.link || "";
    const match = header.match(/[?&]cursor=([^&>]+)/);
    return match ? { ...query, cursor: decodeURIComponent(match[1]) } : null;
  }
  if (style === "page") {
    const page = Number(query.page || 1) + 1;
    return idsFrom(style, body).length === 0 ? null : { ...query, page: String(page) };
  }
  if (style === "akamai") {
    const trailer = JSON.parse(body.split("\n").at(-1) || "{}") as { offset?: string; total?: number };
    if (!trailer.offset || trailer.total === 0) return null;
    return { ...query, offset: trailer.offset };
  }
  const count = idsFrom(style, body).length;
  if (count === 0) return null;
  const offset = Number(query.offset || 0) + count;
  return { ...query, offset: String(offset) };
}

describe("vendor pagination", () => {
  it.each(["offset", "page", "cursor", "link", "akamai"] as VendorPageStyle[])(
    "walks the catalog with %s",
    (style) => {
      const spec = specFor(style);
      const seen: string[] = [];
      let query: Record<string, string> | null = { limit: "3" };
      for (let hop = 0; hop < 6 && query; hop += 1) {
        const result = respond(spec, query);
        const ids = idsFrom(style, result.body);
        if (ids.length === 0) break;
        seen.push(...ids);
        const next = nextQuery(style, result.body, result.headers, query);
        if (style === "page" && ids.length < 3) query = null;
        else if (style === "offset" && Number(next?.offset) >= 7) query = null;
        else query = next;
      }
      expect(seen).toHaveLength(7);
      expect(new Set(seen).size).toBe(7);
    },
  );

  it("puts the next offset on the last Akamai line and ignores offset when from is set", () => {
    const spec = specFor("akamai");
    const first = respond(spec, { limit: "3" });
    expect(first.headers["content-type"]).toContain("ndjson");
    const trailer = JSON.parse(first.body.split("\n").at(-1) || "");
    expect(trailer.offset).toMatch(/^pp_/);
    const withTime = respond(spec, { limit: "3", offset: trailer.offset, from: "1700000000" });
    const fresh = respond(spec, { limit: "3", from: "1700000000" });
    expect(withTime.body).toBe(fresh.body);
  });
});
