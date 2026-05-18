import { expect, test } from "../../../fixtures/screenFixture";
import { QrScreenSelectPage } from "../../../pages/QrScreenSelectPage";
import { ScreenControlPage } from "../../../pages/ScreenGuest/ScreenControlPage";
import { SetupScreenDevicePage } from "../../../pages/SetupScreenDevicePage";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-setup-${WORKER_TAG}`;
const SCREEN_SLUG = `testscreen-setup-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Setup ${WORKER_TAG}`;
const SCREEN_NAME = `Setup Test Screen ${WORKER_TAG}`;
const USERNAME = `testuser_setup_${WORKER_TAG}`;

function toRelative(url: string): string {
  const parsed = new URL(url);
  return parsed.pathname + parsed.search;
}

test.describe("Setup screen QR flow", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("scanning the QR redirects display to /render and phone to /control", async ({
    page,
    setupOrgOwnerContext,
    setupScreen,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");
    const owner = await setupOrgOwnerContext({
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
      username: USERNAME,
    });
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      name: SCREEN_NAME,
    });

    const setupPage = new SetupScreenDevicePage(page);
    await setupPage.goto();
    const authUrl = await setupPage.getAuthUrl();

    // Phone scans the QR and lands on the screen picker.
    const phonePage = owner.page;
    const phonePicker = new QrScreenSelectPage(phonePage);
    await phonePage.goto(toRelative(authUrl));
    await expect(phonePage).toHaveURL(/\/qr\/screen-select\?id=/);
    await expect(phonePicker.heading).toBeVisible();

    // Pick the screen we just created.
    await phonePicker.screenOption(SCREEN_NAME).click();

    // Phone is redirected to the screen's control page.
    const phoneControl = new ScreenControlPage(phonePage);
    await expect(phonePage).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );
    await expect(phoneControl.pickProjectHeading).toBeVisible();

    // Display device's SSE receives the login token and ends up on the
    // renderer. /qr-auth/login is a transient hop along the way.
    await expect(page).toHaveURL(
      new RegExp(`/render/s/${ctx.orgSlug}/${ctx.screenSlug}`),
    );
  });

  test("unauthenticated phone bounces through /login, then completes the QR flow", async ({
    browser,
    page,
    setupOrgOwnerContext,
    setupScreen,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");
    await setupOrgOwnerContext({
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
      username: USERNAME,
    });
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      name: SCREEN_NAME,
    });

    const setupPage = new SetupScreenDevicePage(page);
    await setupPage.goto();
    const authPath = toRelative(await setupPage.getAuthUrl());

    // Fresh phone context with no session.
    const phoneContext = await browser.newContext();
    const phonePage = await phoneContext.newPage();
    try {
      await phonePage.goto(authPath);

      await expect(phonePage).toHaveURL(/\/login\?next=/);

      // Log in with the seeded credentials.
      await phonePage.getByTestId("loginpage-input-username").fill(USERNAME);
      await phonePage
        .getByTestId("loginpage-input-password")
        .fill("TestUserPassword");
      await phonePage
        .locator("form")
        .getByRole("button", { name: "Sign in" })
        .click();

      await expect(phonePage).toHaveURL(/\/qr\/screen-select\?id=/);

      const phonePicker = new QrScreenSelectPage(phonePage);
      await expect(phonePicker.heading).toBeVisible();
      await phonePicker.screenOption(SCREEN_NAME).click();

      const phoneControl = new ScreenControlPage(phonePage);
      await expect(phonePage).toHaveURL(
        new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
      );
      await expect(phoneControl.pickProjectHeading).toBeVisible();

      // Display device's SSE eventually fires and the renderer takes over.
      await expect(page).toHaveURL(
        new RegExp(`/render/s/${ctx.orgSlug}/${ctx.screenSlug}`),
      );
    } finally {
      await phoneContext.close();
    }
  });
});
