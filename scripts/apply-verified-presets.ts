import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkedNotUpgraded, verifiedPresets } from "../shared/verified-presets";
import { validateMockSpec } from "../shared/mock-spec";

const dir = path.resolve("public/presets/integrations");
const indexPath = path.resolve("public/presets/index.json");

for (const preset of verifiedPresets) {
  validateMockSpec(preset.spec);
  await writeFile(path.join(dir, `${preset.id}.json`), `${JSON.stringify(preset, null, 2)}\n`);
}

const index = JSON.parse(await readFile(indexPath, "utf8")) as {
  presets: Array<Record<string, unknown>>;
};
const byId = new Map(verifiedPresets.map((preset) => [preset.id, preset]));
for (const entry of index.presets) {
  const preset = byId.get(String(entry.id));
  if (!preset) continue;
  entry.fidelity = "verified";
  entry.curated = true;
  entry.summary = preset.summary;
  entry.verification = preset.spec.source.verification;
  entry.operations = preset.spec.operations.length;
}
const akamai = index.presets.find((entry) => entry.id === "akamai-waf-siem");
if (akamai) {
  const file = JSON.parse(await readFile(path.join(dir, "akamai-waf-siem.json"), "utf8"));
  validateMockSpec(file.spec);
  akamai.fidelity = "verified";
  akamai.curated = true;
  akamai.verification = file.spec.source.verification;
}
for (const preset of verifiedPresets) {
  if (index.presets.some((entry) => entry.id === preset.id)) continue;
  index.presets.push({
    id: preset.id,
    name: preset.name,
    pack: preset.pack,
    fidelity: "verified",
    curated: true,
    summary: preset.summary,
    operations: preset.spec.operations.length,
    verification: preset.spec.source.verification,
  });
}
for (const note of checkedNotUpgraded) {
  const filePath = path.join(dir, `${note.id}.json`);
  const file = JSON.parse(await readFile(filePath, "utf8"));
  file.spec.source.verification = {
    status: file.fidelity === "sample" ? "sample" : "shape",
    docUrl: note.docUrl,
    checkedAt: "2026-11-09",
    differences: note.differences,
  };
  validateMockSpec(file.spec);
  await writeFile(filePath, `${JSON.stringify(file)}\n`);
  const entry = index.presets.find((item) => item.id === note.id);
  if (entry) entry.verification = file.spec.source.verification;
}
index.presets.sort((a, b) => String(a.name).localeCompare(String(b.name)));
await writeFile(indexPath, `${JSON.stringify(index)}\n`);
const lines = [
  "# Preset verification",
  "",
  "Checked against public vendor API references. Rows through 2026-11-09 use the vendor page. The 2026-11-10 fetch-incidents batch says in the notes when that page was login-gated or not reloaded, and then the shape is the integration test fixture plus the public client in demisto/content. The other catalog entries stay inferred and are not marked verified.",
  "",
  "| Preset | Status | Doc | Notes |",
  "| --- | --- | --- | --- |",
];
for (const entry of index.presets) {
  const verification = entry.verification as
    | { status?: string; docUrl?: string; differences?: string[] }
    | undefined;
  if (!verification) continue;
  const notes = (verification.differences || []).join(" ").replace(/\|/g, "/");
  lines.push(
    `| ${entry.name} | ${verification.status} | ${verification.docUrl || ""} | ${notes} |`,
  );
}
lines.push("");
lines.push(`Verified: ${index.presets.filter((entry) => (entry.verification as { status?: string } | undefined)?.status === "verified").length}. Checked and left as samples because the public response is XML or a zip: ${checkedNotUpgraded.length}. Catalog size: ${index.presets.length}.`);
await writeFile(path.resolve("public/presets/VERIFICATION.md"), `${lines.join("\n")}\n`);
console.log(`verified presets written: ${verifiedPresets.length + 1}`);
