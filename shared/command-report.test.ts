import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { reportCommands, type CatalogCommands } from "./command-report";

describe("local integration command report", () => {
  const catalog: CatalogCommands[] = [
    {
      id: "github-github",
      commands: [
        { command: "GitHub-get-branch", status: "vendor" },
        { command: "GitHub-create-issue", status: "missing" },
      ],
    },
    {
      id: "github-iam",
      commands: [{ command: "GitHub-iam-only", status: "approximate" }],
    },
  ];

  it("scores commands on the matching preset and marks unknown commands missing", () => {
    const report = reportCommands("GitHub", ["GitHub-get-branch", "GitHub-create-issue", "GitHub-nope"], catalog);
    expect(report.presetId).toBe("github-github");
    expect(report.scored).toBe(true);
    expect(report.commands.map((row) => row.status)).toEqual(["vendor", "missing", "missing"]);
    expect(report.summary).toEqual({ vendor: 1, approximate: 0, missing: 2, unscored: 0, total: 3 });
  });

  it("does not invent a score when the integration is not in the catalog", () => {
    const report = reportCommands("HelloWorld", ["hello-world"], catalog);
    expect(report.scored).toBe(false);
    expect(report.commands).toEqual([{ command: "hello-world", status: "unscored" }]);
  });
});

describe("committed command docs index", () => {
  it("matches the command docs on the scored presets", () => {
    const index = JSON.parse(readFileSync("public/presets/command-docs.json", "utf8")) as {
      presets: CatalogCommands[];
    };
    const dir = path.resolve("public/presets/integrations");
    const fromFiles: CatalogCommands[] = [];
    for (const name of readdirSync(dir).filter((file) => file.endsWith(".json")).sort()) {
      const preset = JSON.parse(readFileSync(path.join(dir, name), "utf8")) as {
        id: string;
        spec?: { source?: { commandDocs?: Array<{ command?: string; status?: string }> } };
      };
      const docs = preset.spec?.source?.commandDocs;
      if (!Array.isArray(docs) || !docs.length) continue;
      fromFiles.push({
        id: preset.id,
        commands: docs.map((row) => ({
          command: String(row.command || "").slice(0, 80),
          status: row.status === "vendor" || row.status === "approximate" ? row.status : "missing",
        })),
      });
    }
    expect(index.presets).toEqual(fromFiles);
    const summary = { vendor: 0, approximate: 0, missing: 0 };
    for (const preset of index.presets) {
      for (const row of preset.commands) summary[row.status] += 1;
    }
    expect(summary).toEqual({ vendor: 952, approximate: 412, missing: 1936 });
    expect(index.presets).toHaveLength(129);
  });
});
