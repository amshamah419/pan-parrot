export type CatalogStatus = "vendor" | "approximate" | "missing";
export type ReportedStatus = CatalogStatus | "unscored";

export interface CatalogCommands {
  id: string;
  commands: Array<{ command: string; status: CatalogStatus }>;
}

export interface CommandReport {
  presetId: string | null;
  scored: boolean;
  summary: { vendor: number; approximate: number; missing: number; unscored: number; total: number };
  commands: Array<{ command: string; status: ReportedStatus }>;
}

/** Score a local integration's commands against the catalog's per-command docs. */
export function reportCommands(integrationId: string, commands: string[], catalog: CatalogCommands[]): CommandReport {
  const names = commands.map((command) => command.trim()).filter(Boolean).slice(0, 400);
  const preset = pickPreset(integrationId, names, catalog);
  if (!preset) {
    return {
      presetId: null,
      scored: false,
      summary: { vendor: 0, approximate: 0, missing: 0, unscored: names.length, total: names.length },
      commands: names.map((command) => ({ command, status: "unscored" })),
    };
  }
  const byName = new Map(preset.commands.map((row) => [norm(row.command), row.status]));
  const rows = names.map((command) => ({
    command,
    status: byName.get(norm(command)) || "missing",
  }));
  const summary = { vendor: 0, approximate: 0, missing: 0, unscored: 0, total: rows.length };
  for (const row of rows) summary[row.status] += 1;
  return { presetId: preset.id, scored: true, summary, commands: rows };
}

function pickPreset(integrationId: string, commands: string[], catalog: CatalogCommands[]): CatalogCommands | null {
  const id = norm(integrationId);
  const wanted = new Set(commands.map(norm).filter(Boolean));
  let best: { preset: CatalogCommands; score: number } | null = null;
  for (const preset of catalog) {
    const known = new Set(preset.commands.map((row) => norm(row.command)));
    let overlap = 0;
    for (const name of wanted) if (known.has(name)) overlap += 1;
    const same = Boolean(id) && preset.id === `${id}-${id}`;
    const idHit = Boolean(id) && (same || preset.id.endsWith(`-${id}`) || preset.id.startsWith(`${id}-`));
    if (overlap === 0 && !idHit) continue;
    const score = overlap * 10 + (same ? 5 : 0) + (idHit ? 1 : 0);
    if (!best || score > best.score || (score === best.score && preset.id < best.preset.id)) best = { preset, score };
  }
  return best?.preset || null;
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
