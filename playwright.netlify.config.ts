import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "netlify-gate.spec.ts",
  timeout: 60_000,
  use: {
    baseURL: process.env.NETLIFY_ORIGIN || "http://127.0.0.1:8899",
  },
});
