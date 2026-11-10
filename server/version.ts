import { env } from "./config";

export function appVersion(): { version: string; commit: string } {
  return {
    version: process.env.npm_package_version || "1.0.0",
    commit: (env("COMMIT_REF") || env("GITHUB_SHA") || "local").slice(0, 40),
  };
}
