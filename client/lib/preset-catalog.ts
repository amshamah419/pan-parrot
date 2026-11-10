export interface PresetCatalogEntry {
  id: string;
  name: string;
  pack: string;
  fidelity?: string;
  curated?: boolean;
  summary?: string;
  operations?: number;
  verification?: { status?: string; docUrl?: string };
  formattingFixed?: boolean;
  commandCoverage?: { total: number; vendor: number; approximate: number; missing: number };
}

const CATALOG_URL = "/presets/index.json";
const MAX_ATTEMPTS = 3;

let cached: PresetCatalogEntry[] | null = null;
let inflight: Promise<PresetCatalogEntry[]> | null = null;

export function clearPresetCatalogCache(): void {
  cached = null;
  inflight = null;
}

export async function loadPresetCatalog(options?: {
  fetch?: typeof fetch;
  delayMs?: (attempt: number) => number;
}): Promise<PresetCatalogEntry[]> {
  if (cached) return cached;
  if (inflight) return inflight;
  const run = fetchCatalog(options?.fetch ?? fetch, options?.delayMs ?? ((attempt) => 300 * attempt));
  inflight = run.finally(() => {
    inflight = null;
  });
  return inflight;
}

async function fetchCatalog(
  fetchImpl: typeof fetch,
  delayMs: (attempt: number) => number,
): Promise<PresetCatalogEntry[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 1) await delay(delayMs(attempt - 1));
    try {
      const response = await fetchImpl(CATALOG_URL);
      if (!response.ok) throw new Error(`Catalog responded ${response.status}`);
      const data = (await response.json()) as { presets?: PresetCatalogEntry[] };
      const presets = Array.isArray(data?.presets) ? data.presets : [];
      cached = presets;
      return presets;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not load the integration catalog");
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
