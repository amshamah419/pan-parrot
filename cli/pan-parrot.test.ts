import { describe, expect, it } from "vitest";
import { run, type CliIo } from "./pan-parrot";

function io(fetchImpl: CliIo["fetch"]): CliIo & { out: string[]; err: string[]; config: string } {
  const state = { config: "", out: [] as string[], err: [] as string[], files: new Map<string, string>() };
  return {
    env: {},
    fetch: fetchImpl,
    readConfig: async () => state.config || null,
    writeConfig: async (text) => {
      state.config = text;
    },
    writeFile: async (file, text) => {
      state.files.set(file, text);
    },
    stdout: (text) => state.out.push(text),
    stderr: (text) => state.err.push(text),
    get out() {
      return state.out;
    },
    get err() {
      return state.err;
    },
    get config() {
      return state.config;
    },
  };
}

describe("pan-parrot CLI", () => {
  it("stores a token without printing it, then creates a mock", async () => {
    const calls: string[] = [];
    const client = io(async (url, init) => {
      calls.push(`${init?.method || "GET"} ${url}`);
      const auth = new Headers(init?.headers).get("authorization") || "";
      expect(auth).toBe("Bearer pp_secret-token");
      if (url.endsWith("/api/specs/import")) {
        return new Response(JSON.stringify({ mockSpec: { version: 1 } }));
      }
      if (url.endsWith("/api/endpoints") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: "ep-1", url: "https://example.test/catch/abcd" }));
      }
      return new Response("no", { status: 404 });
    });
    expect(await run(["login", "--url", "https://example.test", "--token", "pp_secret-token"], client)).toBe(0);
    expect(client.out.join("\n")).not.toContain("pp_secret-token");
    expect(client.config).toContain("pp_secret-token");
    client.out.length = 0;
    expect(
      await run(["create", "--name", "Hello", "--yaml", "cli/pan-parrot.test.ts"], client),
    ).toBe(0);
    expect(client.out.join("\n")).toContain("https://example.test/catch/abcd");
    expect(client.out.join("\n")).not.toContain("pp_secret-token");
    expect(calls.some((call) => call.startsWith("POST") && call.includes("/api/specs/import"))).toBe(true);
  });
});
