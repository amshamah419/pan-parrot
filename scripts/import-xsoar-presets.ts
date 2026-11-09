import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { mockFromSample } from "../shared/infer";
import { validateMockSpec, type MockOperation, type MockSpec } from "../shared/mock-spec";

const contentRoot = process.argv.includes("--content")
  ? process.argv[process.argv.indexOf("--content") + 1]
  : "";
const outDir = path.resolve("public/presets");
const integrationDir = path.join(outDir, "integrations");

if (!contentRoot) {
  console.error("Usage: npm run presets:import -- --content /path/to/demisto/content");
  process.exit(1);
}

const curatedIds = new Set([
  "akamai-waf-siem",
  "okta-okta-v2",
  "crowdstrikefalcon-crowdstrikefalcon",
  "microsoftgraphsecurity-microsoftgraphsecurity",
  "virustotal-virustotalv3",
  "jira-jirav3",
  "servicenow-servicenowv2",
  "slack-slackv3",
  "proofpointtap-proofpointtap-v2",
  "zscaler-zscaler",
  "azuresentinel-azuresentinel",
  "gsuitesecurityalertcenter-gsuitesecurityalertcenter",
  "ciscoumbrellareporting-ciscoumbrellareporting",
  "microsoft365defender-microsoft365defender",
  "splunkpy-splunkpy",
]);
const stats = {
  scanned: 0,
  usable: 0,
  withPath: 0,
  skippedNoSample: 0,
  skippedError: 0,
};

const generated: Array<Record<string, unknown>> = [];

for (const dir of await integrationDirs(path.join(contentRoot, "Packs"))) {
  stats.scanned += 1;
  try {
    const preset = await presetFromDir(dir);
    if (!preset) {
      stats.skippedNoSample += 1;
      continue;
    }
    if (presetHasPath(preset.spec)) stats.withPath += 1;
    stats.usable += 1;
    const file = `${preset.id}.json`;
    if (!curatedIds.has(preset.id)) {
      await writeFile(path.join(integrationDir, file), JSON.stringify(preset));
    }
    generated.push(indexEntry(preset));
  } catch {
    stats.skippedError += 1;
  }
}

const curated = await readCurated();
const byId = new Map<string, Record<string, unknown>>();
for (const entry of curated) byId.set(String(entry.id), entry);
for (const entry of generated) {
  if (!byId.has(String(entry.id))) byId.set(String(entry.id), entry);
}
const presets = [...byId.values()].sort((a, b) =>
  String(a.name).localeCompare(String(b.name)),
);
await writeFile(
  path.join(outDir, "index.json"),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    contentRepo: "https://github.com/demisto/content",
    license: "MIT",
    attribution: "/presets/ATTRIBUTION.md",
    presets,
  }),
);
await writeFile(path.join(outDir, "COVERAGE.md"), coverageMarkdown());
console.log(stats);
console.log(`index presets: ${presets.length}`);

function coverageMarkdown(): string {
  return `# Preset coverage

Generated ${new Date().toISOString()} from a local checkout of [demisto/content](https://github.com/demisto/content) (MIT).

| | |
| --- | --- |
| Integration directories scanned | ${stats.scanned} |
| Usable presets inferred from sample JSON | ${stats.usable} |
| Of those, with at least one HTTP path taken from the Python client | ${stats.withPath} |
| Skipped, no usable sample body | ${stats.skippedNoSample} |
| Skipped, importer error | ${stats.skippedError} |
| Hand-curated and not overwritten | ${curatedIds.size} (Akamai WAF SIEM) |

A usable preset means at least one JSON object or array was found in \`test_data/\` or an integration \`*_test/\` fixture. XSOAR command-result wrappers are unwrapped at \`Contents\` when that field is present. Paths come from string literals in the client that look like URL paths. When none are found, the operation is \`GET /\` and the preset fidelity is \`shape\` rather than \`sample\`.

This is structural fidelity for XSOAR content development, not a claim that every response matches the vendor's current API. Akamai WAF SIEM is the hand-checked preset. Regenerate with \`npm run presets:import -- --content ./content\`.
`;
}

async function integrationDirs(packs: string): Promise<string[]> {
  const dirs: string[] = [];
  const packNames = await readdir(packs, { withFileTypes: true });
  for (const pack of packNames) {
    if (!pack.isDirectory()) continue;
    const integrations = path.join(packs, pack.name, "Integrations");
    let children: import("node:fs").Dirent[] = [];
    try {
      children = await readdir(integrations, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      if (child.isDirectory()) dirs.push(path.join(integrations, child.name));
    }
  }
  return dirs;
}

async function presetFromDir(dir: string): Promise<{
  id: string;
  name: string;
  pack: string;
  fidelity: string;
  curated: boolean;
  summary: string;
  operations: number;
  spec: MockSpec;
} | null> {
  const pack = path.basename(path.dirname(path.dirname(dir)));
  const folder = path.basename(dir);
  if (pack === "Akamai_SIEM" && folder === "Akamai_SIEM") return null;
  const ymlName = (await readdir(dir)).find((name) => name.endsWith(".yml") && !name.includes("_description"));
  if (!ymlName) return null;
  const meta = readMeta(await readFile(path.join(dir, ymlName), "utf8"), folder);
  const samples = await collectSamples(dir);
  if (samples.length === 0) return null;
  const paths = await collectPaths(dir);
  const operations: MockOperation[] = [];
  for (const [index, sample] of samples.slice(0, 6).entries()) {
    let spec: MockSpec;
    try {
      spec = validateMockSpec(mockFromSample(sample.text, meta.name));
    } catch {
      continue;
    }
    const operation = spec.operations[0];
    operation.id = slug(sample.name).slice(0, 60) || `op-${index}`;
    operation.summary = sample.name.slice(0, 160);
    if (paths[index]) {
      operation.pathTemplate = paths[index];
      operation.method = "GET";
    } else if (paths[0] && samples.length === 1) {
      operation.pathTemplate = paths[0];
    } else {
      operation.pathTemplate = "/";
    }
    operations.push(operation);
  }
  if (operations.length === 0) return null;
  const fidelity = operations.some((operation) => operation.pathTemplate !== "/")
    ? "sample"
    : "shape";
  const id = slug(`${pack}--${folder}`).slice(0, 80);
  const spec = validateMockSpec({
    version: 1,
    source: {
      kind: "preset",
      id,
      name: meta.name,
      fidelity,
      attribution: "Derived from demisto/content (MIT). See /presets/ATTRIBUTION.md.",
      sourceUrl: `https://github.com/demisto/content/tree/master/Packs/${pack}/Integrations/${folder}`,
      notes: [
        fidelity === "shape"
          ? "No HTTP path was recovered from the client. The sample shape is served at the catch URL root."
          : "HTTP paths were guessed from string literals in the integration client and may not match every command.",
        "Identifier and timestamp fields are generated so pages stay unique. Other fields keep an example from the XSOAR fixture.",
      ],
    },
    operations,
    chaos: specChaos(),
    totalRecords: 200,
  });
  return {
    id,
    name: meta.name,
    pack,
    fidelity,
    curated: false,
    summary: meta.description.slice(0, 180),
    operations: operations.length,
    spec,
  };
}

function specChaos() {
  return {
    enabled: false,
    seed: "xsoar",
    mode: "probability" as const,
    probability: 0.25,
    everyNth: 5,
    duplicateRecords: false,
    missingFields: false,
    mixedTimestamps: false,
    outOfOrder: false,
    wrongTypes: false,
    truncatedJson: false,
    malformedJson: false,
    wrongContentType: false,
    randomErrors: false,
    latency: false,
    paginationGlitch: "none" as const,
  };
}

async function collectSamples(dir: string): Promise<{ name: string; text: string }[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "test_data" || entry.name.endsWith("_test")) {
      await walk(path.join(dir, entry.name), files);
    }
  }
  if (files.length === 0) await walk(dir, files);
  const samples: { name: string; text: string }[] = [];
  for (const file of files) {
    if (!/\.(json|txt)$/i.test(file)) continue;
    const statName = path.basename(file);
    if (/expected|context|hr_|human/i.test(statName)) continue;
    const raw = await readFile(file, "utf8");
    if (raw.length < 2 || raw.length > 100_000) continue;
    const text = toSampleText(raw);
    if (!text) continue;
    samples.push({ name: path.relative(dir, file), text });
    if (samples.length >= 8) break;
  }
  return samples;
}

function toSampleText(raw: string): string | null {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const unwrapped = unwrap(parsed);
    if (useful(unwrapped)) return JSON.stringify(unwrapped);
  } catch {
    const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 5);
    try {
      const parsed = lines.map((line) => JSON.parse(line) as unknown).filter((row) => useful(row));
      if (parsed.length) return JSON.stringify(parsed.length === 1 ? parsed[0] : parsed);
    } catch {
      return null;
    }
  }
  return null;
}

function unwrap(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if ("Contents" in record && ("Type" in record || "EntryContext" in record)) return record.Contents;
  return value;
}

function useful(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => item && typeof item === "object");
  return Boolean(value) && typeof value === "object";
}

async function collectPaths(dir: string): Promise<string[]> {
  const files = (await readdir(dir)).filter((name) => name.endsWith(".py"));
  const found = new Set<string>();
  for (const file of files) {
    const text = await readFile(path.join(dir, file), "utf8");
    for (const match of text.matchAll(/["'](\/[A-Za-z0-9_.${}\/-]{2,120})["']/g)) {
      const candidate = sanitizePath(match[1].replace(/\$\{[^}]+\}/g, "{id}"));
      if (candidate.includes(" ") || candidate.includes("//")) continue;
      if (!/^\/[A-Za-z0-9_./{}-]+$/.test(candidate)) continue;
      if (candidate.split("/").length < 2) continue;
      found.add(candidate.endsWith("/") ? candidate.slice(0, -1) : candidate);
    }
  }
  return [...found].sort((a, b) => b.length - a.length).slice(0, 6);
}

function readMeta(yml: string, fallback: string): { name: string; description: string } {
  try {
    const doc = parseYaml(yml) as { display?: string; name?: string; description?: string };
    return {
      name: String(doc.display || doc.name || fallback).slice(0, 120),
      description: String(doc.description || doc.display || fallback).replace(/\s+/g, " ").slice(0, 240),
    };
  } catch {
    return { name: fallback, description: fallback };
  }
}

async function readCurated(): Promise<Record<string, unknown>[]> {
  const entries: Record<string, unknown>[] = [];
  for (const id of curatedIds) {
    try {
      const json = JSON.parse(await readFile(path.join(integrationDir, `${id}.json`), "utf8"));
      entries.push(indexEntry(json));
    } catch {
      continue;
    }
  }
  return entries;
}

function indexEntry(preset: {
  id: string;
  name: string;
  pack: string;
  fidelity?: string;
  curated?: boolean;
  summary?: string;
  operations?: number | unknown[];
  spec?: { operations?: unknown[]; source?: { verification?: unknown } };
}): Record<string, unknown> {
  const operations = Array.isArray(preset.operations)
    ? preset.operations.length
    : Array.isArray(preset.spec?.operations)
      ? preset.spec.operations.length
      : Number(preset.operations || 0);
  return {
    id: preset.id,
    name: preset.name,
    pack: preset.pack,
    fidelity: preset.fidelity,
    curated: Boolean(preset.curated),
    summary: preset.summary,
    operations,
    verification: preset.spec?.source?.verification,
  };
}

function presetHasPath(spec: MockSpec): boolean {
  return spec.operations.some((operation) => operation.pathTemplate !== "/");
}

function sanitizePath(candidate: string): string {
  return candidate
    .split("/")
    .map((segment) => {
      if (!segment || (segment.startsWith("{") && segment.endsWith("}"))) return segment;
      const random =
        segment.length >= 24 && /[A-Za-z]/.test(segment) && /[0-9]/.test(segment);
      return random || segment.length >= 40 ? "{id}" : segment;
    })
    .join("/");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function walk(dir: string, files: string[]): Promise<void> {
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      if (files.length > 40) return;
      await walk(full, files);
    } else if (/\.(json|txt)$/i.test(entry.name)) {
      files.push(full);
    }
  }
}
