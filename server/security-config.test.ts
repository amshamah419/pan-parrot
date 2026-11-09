import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public hardening config", () => {
  it("locks static responses down in netlify.toml", () => {
    const toml = readFileSync("netlify.toml", "utf8");
    expect(toml).toContain("X-Robots-Tag");
    expect(toml).toContain("noindex");
    expect(toml).toContain("Content-Security-Policy");
    expect(toml).toContain("frame-ancestors 'none'");
    expect(toml).toContain('script-src \'self\'');
    expect(toml).not.toContain("unsafe-eval");
  });

  it("tells crawlers to stay out", () => {
    const robots = readFileSync("public/robots.txt", "utf8");
    expect(robots).toContain("Disallow: /");
    expect(robots).not.toContain("Allow: /");
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain('name="robots"');
    expect(html).toContain("noindex");
  });
});
