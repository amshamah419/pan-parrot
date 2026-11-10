import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const roots = ["client", "public", "index.html"];

describe("local images", () => {
  it("does not point src, href, or CSS urls at an external image host", () => {
    const offenders: string[] = [];
    for (const file of files()) {
      const text = readFileSync(file, "utf8");
      if (text.includes("builder.io")) offenders.push(`${file} builder.io`);
      if (/<img\b[^>]*\bsrc\s*=\s*["']https?:\/\//i.test(text)) offenders.push(`${file} external img`);
      if (/\bsrc\s*=\s*["']https?:\/\/[^"']+\.(?:png|jpe?g|gif|webp|svg|ico)\b/i.test(text)) {
        offenders.push(`${file} external image`);
      }
      if (/url\(\s*["']?https?:\/\//.test(text)) offenders.push(`${file} external url()`);
    }
    expect(offenders).toEqual([]);
  });
});

function files(): string[] {
  const found: string[] = [];
  for (const root of roots) {
    walk(root, found);
  }
  return found;
}

function walk(target: string, found: string[]): void {
  const info = statSync(target);
  if (info.isFile()) {
    if (/\.(test|spec)\.[jt]sx?$/.test(target)) return;
    if (/\.(tsx|ts|html|css|js)$/.test(target)) found.push(target);
    return;
  }
  for (const name of readdirSync(target)) {
    if (name === "node_modules" || name === "presets" || name === "ui") continue;
    walk(path.join(target, name), found);
  }
}
