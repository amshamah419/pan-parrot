import { defineConfig, devices } from "@playwright/test";

const port = 8080;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "e2e",
  testIgnore: "netlify-gate.spec.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ||
        "postgresql://panparrot:local-dev-only@127.0.0.1:5432/panparrot",
      SESSION_SECRET: process.env.SESSION_SECRET || "local-dev-session-secret-32chars-min",
      AUTH_DEV_EXPOSE_CODE: "true",
      SITE_URL: baseURL,
      ADMIN_EMAILS: process.env.ADMIN_EMAILS || "ashamah@paloaltonetworks.com",
    },
  },
});
