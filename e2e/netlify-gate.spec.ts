import { expect, test } from "@playwright/test";
import { signGate } from "../shared/gate-cookie";

const origin = process.env.NETLIFY_ORIGIN || "http://127.0.0.1:8899";
const secret = process.env.SESSION_SECRET || "ci-session-secret-should-be-32chars";

test("a signed-in gate cookie can read the preset catalog on the Netlify build", async ({ request }) => {
  const token = await signGate(Math.floor(Date.now() / 1000) + 3600, secret);
  const signedOut = await request.get(`${origin}/presets/index.json`);
  expect(signedOut.status()).toBe(404);
  const signedIn = await request.get(`${origin}/presets/index.json`, {
    headers: { cookie: `pp_gate=${token}` },
  });
  expect(signedIn.status()).toBe(200);
  expect(signedIn.headers()["content-type"] || "").toContain("application/json");
  const body = (await signedIn.json()) as { presets?: unknown[] };
  expect(body.presets?.length).toBeGreaterThan(100);
});

test("the sign-in logo is a local image on the Netlify build", async ({ request }) => {
  const logo = await request.get(`${origin}/logo.webp`);
  expect(logo.status()).toBe(200);
  expect(logo.headers()["content-type"] || "").toMatch(/^image\//);
  const page = await request.get(`${origin}/login`);
  expect(page.status()).toBe(200);
  expect(await page.text()).toContain('src="/logo.webp"');
});
