import { afterEach, describe, expect, it, vi } from "vitest";
import { clearPresetCatalogCache, loadPresetCatalog } from "./preset-catalog";

afterEach(() => {
  clearPresetCatalogCache();
  vi.useRealTimers();
});

describe("preset catalog fetch", () => {
  it("stops after the first try and two retries", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("/presets/index.json");
      return new Response("nope", { status: 503 });
    });
    await expect(loadPresetCatalog({ fetch: fetchImpl, delayMs: () => 0 })).rejects.toThrow(/503/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    await expect(loadPresetCatalog({ fetch: fetchImpl, delayMs: () => 0 })).rejects.toThrow(/503/);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it("caches a successful catalog and does not fetch again", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ presets: [{ id: "okta", name: "Okta", pack: "Okta" }] }));
    const first = await loadPresetCatalog({ fetch: fetchImpl, delayMs: () => 0 });
    const second = await loadPresetCatalog({ fetch: fetchImpl, delayMs: () => 0 });
    expect(first).toEqual(second);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
