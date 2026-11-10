import { MOCK_LIMITS } from "../shared/policy";
import type { TestDataFile } from "../shared/xsoar-workflow";
import { HttpError } from "./http";
import { fetchPublic } from "./ssrf";

const CONTENT_PATH = /^Packs\/[A-Za-z0-9._-]{1,80}\/Integrations\/[A-Za-z0-9._-]{1,80}$/;

interface GithubEntry {
  name?: string;
  type?: string;
  path?: string;
  download_url?: string;
  size?: number;
}

export interface ContentBundle {
  yaml: string;
  clientSource: string;
  testData: TestDataFile[];
}

/** A demisto/content integration directory, not an arbitrary URL. */
export function contentDirectoryUrl(contentPath: string): string {
  const path = contentPath.trim().replace(/^\/+|\/+$/g, "");
  if (!CONTENT_PATH.test(path) || path.includes("..")) {
    throw new HttpError(400, "Content path must look like Packs/Name/Integrations/Name");
  }
  return `https://api.github.com/repos/demisto/content/contents/${path}?ref=master`;
}

export async function loadContentIntegration(contentPath: string): Promise<ContentBundle> {
  const listing = await githubList(contentDirectoryUrl(contentPath));
  const folder = contentPath.trim().replace(/^\/+|\/+$/g, "").split("/").pop() || "";
  const yml = listing
    .filter((entry) => entry.type === "file" && /\.ya?ml$/i.test(entry.name || "") && !/readme/i.test(entry.name || ""))
    .sort((a, b) => scoreYml(b.name || "", folder) - scoreYml(a.name || "", folder))[0];
  if (!yml?.download_url) throw new HttpError(400, "That content path has no integration YAML");
  const yaml = await githubText(yml.download_url, MOCK_LIMITS.maxFetchedSpecBytes);
  const pyFiles = listing.filter((entry) => entry.type === "file" && entry.name?.endsWith(".py")).slice(0, 6);
  const sources: string[] = [];
  for (const file of pyFiles) {
    if (!file.download_url) continue;
    sources.push(await githubText(file.download_url, 200_000));
  }
  const testDir = listing.find((entry) => entry.type === "dir" && entry.name === "test_data");
  const testData: TestDataFile[] = [];
  if (testDir?.path) {
    const files = await githubList(`https://api.github.com/repos/demisto/content/contents/${testDir.path}?ref=master`);
    for (const file of files) {
      if (testData.length >= 12) break;
      if (file.type !== "file" || !/\.json$/i.test(file.name || "") || !file.download_url) continue;
      if ((file.size || 0) > 100_000) continue;
      const text = await githubText(file.download_url, 100_000);
      testData.push({ name: file.name || "fixture.json", text });
    }
  }
  return { yaml, clientSource: sources.join("\n\n"), testData };
}

function scoreYml(name: string, folder: string): number {
  const base = name.replace(/\.ya?ml$/i, "");
  if (base === folder) return 2;
  if (base.toLowerCase() === folder.toLowerCase()) return 1;
  return 0;
}

async function githubList(url: string): Promise<GithubEntry[]> {
  const result = await fetchPublic(url, {
    method: "GET",
    headers: { accept: "application/vnd.github+json", "user-agent": "pan-parrot" },
    maxBytes: 500_000,
    oversize: "throw",
  });
  if (result.status === 404) throw new HttpError(400, "Content path was not found on demisto/content");
  if (result.status < 200 || result.status >= 300) throw new HttpError(400, "Could not read that content path");
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.body) as unknown;
  } catch {
    throw new HttpError(400, "Content listing was not JSON");
  }
  if (!Array.isArray(parsed)) throw new HttpError(400, "Content path is not a directory");
  return parsed as GithubEntry[];
}

async function githubText(url: string, maxBytes: number): Promise<string> {
  const parsed = new URL(url);
  if (parsed.hostname !== "raw.githubusercontent.com") {
    throw new HttpError(400, "Content file URL is not allowed");
  }
  const result = await fetchPublic(url, {
    method: "GET",
    headers: { "user-agent": "pan-parrot" },
    maxBytes,
    oversize: "throw",
  });
  if (result.status < 200 || result.status >= 300) throw new HttpError(400, "Could not download a content file");
  return result.body;
}
