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
  const codeEl = page.locator("#dev-code");
  await expect(codeEl).toHaveText(/^\d{8}$/);
  const code = (await codeEl.innerText()).trim();
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

test("a stranger only sees the sign-in page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to PAN Parrot" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read the docs" })).toHaveCount(0);
  await expect(page.getByText("Integration catalog")).toHaveCount(0);
  await noSideScroll(page);
  const missing = await page.goto("/docs");
  expect(missing?.status()).toBe(404);
  await expect(page.getByText("Not found")).toBeVisible();
});

test("a new content developer can mock, load-test, and share", async ({ page, browser }) => {
  const stamp = Date.now().toString(36);
  const email = `ux.${stamp}@paloaltonetworks.com`;
  const friend = `ux.friend.${stamp}@paloaltonetworks.com`;

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

test("an admin can read health and send an invite", async ({ page }) => {
  await signIn(page, "ashamah@paloaltonetworks.com");
  await page.getByRole("button", { name: "Account menu for ashamah@paloaltonetworks.com" }).click();
  await page.getByRole("menuitem", { name: "Admin Panel" }).click();
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expect(page.getByText("Database").first()).toBeVisible();
  await expect(page.getByText("Last 24 hours")).toBeVisible();
  await page.screenshot({ path: "test-results/admin-health.png", fullPage: true });
  await page.getByRole("tab", { name: "Mocks" }).click();
  await expect(page.getByText("Disabling a mock blocks its catch URL")).toBeVisible();
  await page.getByRole("tab", { name: "People" }).click();
  await page.getByLabel("Search people").fill("ashamah");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("ashamah@paloaltonetworks.com", { exact: true })).toBeVisible();
  await expect(page.getByText("Always admin")).toBeVisible();
  await page.screenshot({ path: "test-results/admin-people.png", fullPage: true });
  await page.getByRole("tab", { name: "Invites" }).click();
  await expect(page.getByLabel("Require an invite for new sign-ups")).toBeVisible();
  const invitee = `e2e.invite.${Date.now().toString(36)}@paloaltonetworks.com`;
  await page.getByLabel("Email addresses").fill(invitee);
  await page.getByRole("button", { name: "Send invites" }).click();
  await expect(page.getByText(invitee)).toBeVisible();
  await page.getByLabel("Email addresses").fill("person@gmail.com");
  await expect(page.getByLabel("Email addresses")).toHaveValue("person@gmail.com");
  await page.getByRole("button", { name: "Send invites" }).click();
  await expect(page.getByText("Sign-in is limited to verified @paloaltonetworks.com email addresses.")).toBeVisible();
  await page.screenshot({ path: "test-results/admin-invites.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await noSideScroll(page);
  await page.screenshot({ path: "test-results/admin-invites-mobile.png", fullPage: true });
});

test("an invite link signs in through the public page", async ({ page, browser }) => {
  await signIn(page, "ashamah@paloaltonetworks.com");
  const invitee = `e2e.gate.${Date.now().toString(36)}@paloaltonetworks.com`;
  const sent = await page.request.post("/api/admin/invites", { data: { emails: [invitee] } });
  expect(sent.ok()).toBeTruthy();
  const payload = await sent.json();
  const link = new URL(payload.devLinks[0].url);
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto("/login?invite=not-a-real-invite");
  await expect(guestPage.getByRole("heading", { name: "Sign in to PAN Parrot" })).toBeVisible();
  await expect(guestPage.getByText("Integration catalog")).toHaveCount(0);
  await guestPage.getByRole("button", { name: "Confirm and continue" }).click();
  await expect(guestPage.getByRole("alert")).toHaveText("Invalid or expired code");
  await expect(guestPage.getByRole("heading", { name: "Mocks" })).toHaveCount(0);
  await guestPage.goto(`${link.pathname}${link.search}`);
  await expect(guestPage.getByText("Integration catalog")).toHaveCount(0);
  await guestPage.getByRole("button", { name: "Confirm and continue" }).click();
  await expect(guestPage.getByRole("heading", { name: "Mocks" })).toBeVisible();
  await guest.close();
});

test("dark mode follows the system and the request log can be searched", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const email = `theme.${Date.now().toString(36)}@paloaltonetworks.com`;
  await signIn(page, email);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: /Color theme/ }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Mocks" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.getByRole("button", { name: "Mock an integration" }).click();
  await page.getByRole("button", { name: "Start with Akamai WAF SIEM" }).click();
  await page.getByRole("button", { name: "Accept the header shape for local curls" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved. The catch URL is live.");
  await page.getByRole("button", { name: "Send a sample call" }).click();
  await expect(page.getByText(/200 ·/)).toBeVisible();
  await page.getByRole("link", { name: "Mocks" }).click();
  await page.getByLabel("Search captured requests").fill("this-will-not-match");
  await expect(page.getByText("No requests match your filters.")).toBeVisible();
  await page.getByLabel("Search captured requests").fill("");
  await page.getByLabel("Filter by path").fill("siem");
  const captured = page.getByRole("button", { name: /^GET / });
  await expect(captured).toBeVisible();
  await page.getByLabel("Filter by status").fill("599");
  await expect(page.getByText("No requests match your filters.")).toBeVisible();
  await page.getByLabel("Filter by status").fill("200");
  await expect(captured).toBeVisible();
  await page.getByRole("heading", { name: "Mocks" }).click();
  await page.keyboard.press("?");
  await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
});

test("the match tab shows the richer body path", async ({ page }) => {
  await signIn(page, `match.${Date.now().toString(36)}@paloaltonetworks.com`);
  const created = await page.request.post("/api/endpoints", {
    data: {
      name: "Match rows",
      customPath: `match${Date.now().toString(36)}`,
      mockSpec: {
        version: 1,
        source: { kind: "manual", name: "Match" },
        operations: [
          {
            id: "rows",
            method: "POST",
            pathTemplate: "/rows",
            status: 200,
            contentType: "application/json",
            list: false,
            envelope: { type: "object" },
            record: { name: "row", kind: "object", children: [] },
          },
        ],
        chaos: { enabled: false },
        totalRecords: 1,
      },
    },
  });
  expect(created.ok()).toBeTruthy();
  const endpoint = await created.json();
  await page.goto(`/mock/${endpoint.id}`);
  await page.getByRole("tab", { name: "Match" }).click();
  await expect(page.getByLabel("Body path")).toBeVisible();
  await page.getByLabel("Body path").fill('$.items[?(@.status=="closed")].id');
  await expect(page.getByLabel("Body path")).toHaveValue('$.items[?(@.status=="closed")].id');
});

test("the version list shows what revert would change", async ({ page }) => {
  await signIn(page, `diff.${Date.now().toString(36)}@paloaltonetworks.com`);
  const spec = (value: string) => ({
    version: 1,
    source: { kind: "manual", name: "Diff" },
    operations: [
      {
        id: "rows",
        method: "GET",
        pathTemplate: "/rows",
        status: 200,
        contentType: "application/json",
        list: true,
        envelope: { type: "array" },
        record: { name: "row", kind: "object", children: [{ name: "id", kind: "const", constValue: value }] },
      },
    ],
    chaos: { enabled: false },
    totalRecords: 1,
  });
  const created = await page.request.post("/api/endpoints", {
    data: { name: "Diff rows", customPath: `diff${Date.now().toString(36)}`, mockSpec: spec("one") },
  });
  expect(created.ok()).toBeTruthy();
  const endpoint = await created.json();
  const saved = await page.request.put(`/api/endpoints/${endpoint.id}/spec`, { data: { mockSpec: spec("two") } });
  expect(saved.ok()).toBeTruthy();
  await page.goto(`/mock/${endpoint.id}`);
  const toggle = page.getByRole("switch", { name: "Email me on the first call" });
  await expect(toggle).toBeVisible();
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.getByText(/Revert would change/)).toBeVisible();
  await expect(page.getByText("TOP-SECRET")).toHaveCount(0);
  await page.getByRole("button", { name: "Revert" }).click();
  await expect(page.getByRole("heading", { name: "Mocks" })).toHaveCount(0);
});

test("XSIAM samples show Okta fields from the content schema", async ({ page }) => {
  await signIn(page, `xsiam.${Date.now().toString(36)}@paloaltonetworks.com`);
  await page.getByRole("link", { name: "XSIAM" }).click();
  await expect(page.getByRole("heading", { name: "XSIAM dataset samples" })).toBeVisible();
  await page.getByRole("button", { name: /Okta/ }).first().click();
  await expect(page.getByRole("heading", { name: "okta_okta_raw" })).toBeVisible();
  await expect(page.getByText("group.user_membership.remove")).toBeVisible();
  await expect(page.getByText("Packs/Okta/ModelingRules")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Correlation rules" })).toBeVisible();
  await expect(page.getByText("datamodel dataset = microsoft_365_defender_raw")).toBeVisible();
});
