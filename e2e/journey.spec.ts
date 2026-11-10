import { expect, test, type Page } from "@playwright/test";

const openApi = JSON.stringify({
  openapi: "3.0.3",
  info: { title: "Widget", version: "1.0.0" },
  paths: {
    "/widgets": {
      get: {
        responses: {
          "200": {
            description: "ok",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { id: { type: "string" }, name: { type: "string" } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});

const wsdl = `<?xml version="1.0"?>
<definitions name="Lab" xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/">
  <portType><operation name="GetThing"/></portType>
  <binding><operation name="GetThing"><soap:operation soapAction="urn:GetThing"/></operation></binding>
</definitions>`;

async function noSideScroll(page: Page) {
  const extra = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll("body *")]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          cls: String(el.className || "").slice(0, 100),
          text: (el.textContent || "").replace(/\s+/g, " ").slice(0, 80),
          right: Math.round(rect.right),
        };
      })
      .filter((item) => item.right > width + 1)
      .slice(0, 8);
    return { extra: document.documentElement.scrollWidth - width, offenders };
  });
  expect(extra.extra, JSON.stringify(extra.offenders, null, 2)).toBeLessThanOrEqual(1);
}

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  const code = (await page.locator("code").first().innerText()).trim();
  await page.getByLabel("8-digit code").fill(code);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mocks" })).toBeVisible();
}

const edgeHeaders = {
  authorization:
    "EG1-HMAC-SHA256 client_token=dummy-client-token;access_token=dummy-access-token;timestamp=20240101T00:00:00+0000;nonce=local;signature=dummy",
};

function eventIds(body: string): string[] {
  return body
    .trim()
    .split("\n")
    .slice(0, -1)
    .map((line) => JSON.parse(line).httpMessage.requestId as string);
}

test("home, login, and the catalog dialog fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Mock the APIs your content pack calls/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read the docs" })).toBeVisible();
  await noSideScroll(page);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to PAN Parrot" })).toBeVisible();
  await noSideScroll(page);
});

test("a new content developer can mock, load-test, and share", async ({ page, browser }) => {
  const stamp = Date.now().toString(36);
  const email = `ux.${stamp}@paloaltonetworks.com`;
  const friend = `ux.friend.${stamp}@paloaltonetworks.com`;

  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).first().click();
  await signIn(page, email);

  await expect(page.getByText("Make a catch URL in under a minute")).toBeVisible();
  await page.getByRole("button", { name: "Mock an integration" }).click();
  await expect(page.getByText("No integrations match")).toHaveCount(0);
  await page.getByRole("button", { name: "Start with Akamai WAF SIEM" }).click();
  await expect(page.getByRole("heading", { name: "Akamai WAF SIEM" })).toBeVisible();
  await expect(page.getByText("No captured calls for this catch URL yet")).toBeVisible();
  await expect(page.getByText("No one else can open this mock yet")).toBeVisible();
  await expect(page.getByText("A plain visit is rejected")).toBeVisible();
  await page.getByRole("button", { name: "Accept the header shape for local curls" }).click();

  await page.getByRole("button", { name: "Chaos and load test" }).click();
  await expect(page.getByRole("tab", { name: "Chaos", selected: true })).toBeVisible();
  await page.getByLabel("Virtual records").fill("2000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved. The catch URL is live.");
  await expect(page.getByText(/2,000 unique records|2000 unique records/)).toBeVisible();
  await page.getByRole("button", { name: "Send a sample call" }).click();
  await expect(page.getByText("200 · 2 records")).toBeVisible();

  const tryUrl = (await page.locator("section code").nth(1).innerText()).trim();
  const firstUrl = new URL(tryUrl);
  firstUrl.searchParams.set("limit", "500");
  firstUrl.searchParams.delete("offset");
  const first = await page.request.get(firstUrl.toString(), { headers: edgeHeaders });
  expect(first.status()).toBe(200);
  const firstBody = await first.text();
  const trailer = JSON.parse(firstBody.trim().split("\n").at(-1) || "{}") as { offset?: string };
  expect(trailer.offset).toBeTruthy();
  const secondUrl = new URL(firstUrl);
  secondUrl.searchParams.set("offset", trailer.offset || "");
  const second = await page.request.get(secondUrl.toString(), { headers: edgeHeaders });
  expect(second.status()).toBe(200);
  const ids = [...eventIds(firstBody), ...eventIds(await second.text())];
  expect(ids).toHaveLength(1000);
  expect(new Set(ids).size).toBe(1000);

  const studio = page.url();
  await page.getByRole("link", { name: "Mocks" }).click();
  await page.getByRole("button", { name: /siem/ }).first().click();
  await page.getByRole("tab", { name: "Response" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Status 200");
  await page.goto(studio);

  await page.getByRole("button", { name: "Flow" }).click();
  await page.getByRole("switch", { name: "Call sequence" }).click();
  await expect(page.getByText("Upstream down")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved. The catch URL is live.");
  const healthy = await page.request.get(firstUrl.toString(), { headers: edgeHeaders });
  const down = await page.request.get(firstUrl.toString(), { headers: edgeHeaders });
  expect(healthy.status()).toBe(200);
  expect(down.status()).toBe(503);

  await page.getByRole("button", { name: "Auth" }).click();
  await page.getByLabel("What the integration must send").selectOption({ label: "Bearer token" });
  await expect(page.getByText(/Authorization: Bearer/)).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved. The catch URL is live.");
  const locked = await page.request.get(firstUrl.toString());
  expect(locked.status()).toBe(401);
  const opened = await page.request.get(firstUrl.toString(), {
    headers: { authorization: "Bearer dummy-bearer" },
  });
  expect(opened.status()).not.toBe(401);

  await page.getByRole("button", { name: "Push" }).click();
  await expect(page.getByText("No pushes yet")).toBeVisible();
  await page.getByLabel("Target URL").fill("https://127.0.0.1/hook");
  await page.getByRole("button", { name: "Push now" }).click();
  await expect(page.getByRole("alert")).toContainText("not allowed");

  await page.getByRole("navigation", { name: "On this mock" }).getByRole("button", { name: "Share" }).click();
  await page.getByLabel("Email address to share with").fill(friend);
  await page.getByRole("region", { name: "People and history" }).getByRole("button", { name: "Share" }).click();
  await expect(page.getByText(friend)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export test_data" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);

  await page.setViewportSize({ width: 390, height: 844 });
  await noSideScroll(page);
  await page.getByRole("link", { name: "Mocks" }).click();
  await noSideScroll(page);
  await page.getByRole("button", { name: "Mock an integration" }).click();
  await noSideScroll(page);
  await page.getByRole("button", { name: "Close" }).click();
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByRole("button", { name: "Mock an integration" }).click();
  await page.getByRole("tab", { name: "API spec" }).click();
  await page.getByLabel("Paste OpenAPI, WSDL, XML, or YAML").fill(openApi);
  await page.getByRole("button", { name: "Import pasted spec" }).click();
  await expect(page.getByRole("heading", { name: "Widget" })).toBeVisible();

  await page.getByRole("link", { name: "Mocks" }).click();
  await page.getByRole("button", { name: "Mock an integration" }).click();
  await page.getByRole("tab", { name: "API spec" }).click();
  await page.getByLabel("Paste OpenAPI, WSDL, XML, or YAML").fill(wsdl);
  await page.getByRole("button", { name: "Import pasted spec" }).click();
  await expect(page.getByRole("heading", { name: "Lab" })).toBeVisible();
  await expect(page.getByText(/soap/i).first()).toBeVisible();

  const friendContext = await browser.newContext();
  const friendPage = await friendContext.newPage();
  await signIn(friendPage, friend);
  await expect(friendPage.getByText("Akamai WAF SIEM").first()).toBeVisible();
  await friendContext.close();
});
