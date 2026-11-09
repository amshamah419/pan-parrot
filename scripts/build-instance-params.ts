import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { xsoarFromDocument } from "../shared/xsoar-instance";

const contentRoot = process.argv.includes("--content")
  ? process.argv[process.argv.indexOf("--content") + 1]
  : "";
if (!contentRoot) {
  console.error("Usage: npm run presets:instances -- --content /path/to/demisto/content");
  process.exit(1);
}

const bySource = new Map<string, string>();
const presetDir = path.resolve("public/presets/integrations");
for (const file of await readdir(presetDir)) {
  if (!file.endsWith(".json")) continue;
  const preset = JSON.parse(await readFile(path.join(presetDir, file), "utf8")) as {
    id?: string;
    sourceUrl?: string;
    spec?: { source?: { id?: string; sourceUrl?: string } };
  };
  const id = preset.id || preset.spec?.source?.id;
  const sourceUrl = preset.sourceUrl || preset.spec?.source?.sourceUrl || "";
  const match = sourceUrl.match(/Packs\/([^/]+)\/Integrations\/([^/]+)/);
  if (id && match) bySource.set(`${match[1]}/${match[2]}`, id);
}

const catalog: Record<string, ReturnType<typeof xsoarFromDocument>> = {};
let scanned = 0;
let kept = 0;
for (const dir of await integrationDirs(path.join(contentRoot, "Packs"))) {
  scanned += 1;
  const ymlName = (await readdir(dir)).find((name) => name.endsWith(".yml") && !name.includes("_description"));
  if (!ymlName) continue;
  let document: unknown;
  try {
    document = parseYaml(await readFile(path.join(dir, ymlName), "utf8"));
  } catch {
    continue;
  }
  const integration = xsoarFromDocument(document);
  if (!integration) continue;
  const pack = path.basename(path.dirname(path.dirname(dir)));
  const folder = path.basename(dir);
  const slugId = slug(`${pack}--${folder}`).slice(0, 80);
  const presetId = bySource.get(`${pack}/${folder}`) || slugId;
  catalog[presetId] = integration;
  kept += 1;
}

const out = path.resolve("public/presets/instance-params.json");
await writeFile(out, JSON.stringify(catalog));
console.log({ scanned, kept, bytes: (await readFile(out)).length });

async function integrationDirs(packs: string): Promise<string[]> {
  const dirs: string[] = [];
  for (const pack of await readdir(packs, { withFileTypes: true })) {
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

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
