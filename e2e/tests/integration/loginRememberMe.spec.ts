import { Browser, expect, test } from "@playwright/test";

import { E2ECommandAPI } from "../../e2eCommand";

const USERNAME = "testuser";
const PASSWORD = "TestUserPassword";
const SESSION_COOKIE_NAME = "connect.sid";

const DAY_SECONDS = 24 * 60 * 60;

test.describe("Login remember-me cookie expiry", () => {
  test.beforeEach(async ({ page, request }) => {
    const e2eCommand = new E2ECommandAPI(page, request);
    await Promise.all([
      e2eCommand.serverCommand("clearTestUsers"),
      e2eCommand.serverCommand("clearTestOrganizations"),
    ]);
    await e2eCommand.serverCommand("createUser", {
      username: USERNAME,
      password: PASSWORD,
      verified: true,
    });
  });

  test("Remember me checked → ~400 day cookie", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("loginpage-input-username").fill(USERNAME);
    await page.getByTestId("loginpage-input-password").fill(PASSWORD);
    await page.getByTestId("loginpage-input-rememberme").click();

    const loginResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes("/graphql") &&
        resp.request().method() === "POST" &&
        resp.status() === 200,
    );
    await page.locator("form").getByRole("button", { name: "Sign in" }).click();
    await loginResponse;

    const session = (await page.context().cookies()).find(
      (c) => c.name === SESSION_COOKIE_NAME,
    );
    expect(session, "session cookie should be set").toBeDefined();

    const ttlSeconds = session!.expires - Math.floor(Date.now() / 1000);
    // Server sets 400 days (RFC 6265bis browser max)
    expect(ttlSeconds).toBeGreaterThan(350 * DAY_SECONDS);
  });

  test("Remember me unchecked → ~3 day cookie", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("loginpage-input-username").fill(USERNAME);
    await page.getByTestId("loginpage-input-password").fill(PASSWORD);

    const loginResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes("/graphql") &&
        resp.request().method() === "POST" &&
        resp.status() === 200,
    );
    await page.locator("form").getByRole("button", { name: "Sign in" }).click();
    await loginResponse;

    const session = (await page.context().cookies()).find(
      (c) => c.name === SESSION_COOKIE_NAME,
    );
    expect(session, "session cookie should be set").toBeDefined();

    const ttlSeconds = session!.expires - Math.floor(Date.now() / 1000);
    // Server default is 3 days. Require <= 7 days (catches the bug where the
    // 400-day persistent maxAge accidentally bleeds in) and > 1 hour (catches
    // a missing/short cookie regression).
    expect(ttlSeconds).toBeLessThan(7 * DAY_SECONDS);
    expect(ttlSeconds).toBeGreaterThan(60 * 60);
  });

  test("QR login with Remember me → ~400 day cookie", async ({
    browser,
    page,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");
    await runQrLoginUiFlow({ browser, page, rememberMe: true });

    const session = (await page.context().cookies()).find(
      (c) => c.name === SESSION_COOKIE_NAME,
    );
    expect(session, "session cookie should be set").toBeDefined();

    const ttlSeconds = session!.expires - Math.floor(Date.now() / 1000);
    expect(ttlSeconds).toBeGreaterThan(350 * DAY_SECONDS);
  });

  test("QR login without Remember me → ~3 day cookie", async ({
    browser,
    page,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");
    await runQrLoginUiFlow({ browser, page, rememberMe: false });

    const session = (await page.context().cookies()).find(
      (c) => c.name === SESSION_COOKIE_NAME,
    );
    expect(session, "session cookie should be set").toBeDefined();

    const ttlSeconds = session!.expires - Math.floor(Date.now() / 1000);
    expect(ttlSeconds).toBeLessThan(7 * DAY_SECONDS);
    expect(ttlSeconds).toBeGreaterThan(60 * 60);
  });
});

async function runQrLoginUiFlow({
  browser,
  page,
  rememberMe,
}: {
  browser: Browser;
  page: import("@playwright/test").Page;
  rememberMe: boolean;
}) {
  await page.goto("/login");
  if (rememberMe) {
    await page.getByTestId("loginpage-input-rememberme").click();
  }
  await page.getByTestId("loginpage-qr-button").click();

  const authUrlLocator = page.getByTestId("qrlogin-auth-url");
  await expect(authUrlLocator).toHaveCount(1);
  const authUrl = (await authUrlLocator.textContent())?.trim();
  expect(authUrl, "QR auth URL should be exposed").toBeTruthy();

  // Mobile device
  const mobileContext = await browser.newContext();
  try {
    const mobilePage = await mobileContext.newPage();
    const mobileApi = new E2ECommandAPI(mobilePage, mobileContext.request);
    await mobileApi.login({ username: USERNAME });
    await mobilePage.goto(authUrl!);

    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  } finally {
    await mobileContext.close();
  }
}
