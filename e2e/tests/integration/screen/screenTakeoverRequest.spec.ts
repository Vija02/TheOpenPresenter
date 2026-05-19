import { expect, test } from "../../../fixtures/screenFixture";
import { ScreenAdminPage } from "../../../pages/ScreenGuest/ScreenAdminPage";
import { ScreenControlPage } from "../../../pages/ScreenGuest/ScreenControlPage";
import { ScreenLoginPage } from "../../../pages/ScreenGuest/ScreenLoginPage";
import { ScreenRequestPage } from "../../../pages/ScreenGuest/ScreenRequestPage";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-takeover-${WORKER_TAG}`;
const SCREEN_SLUG = `testscreen-takeover-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Takeover ${WORKER_TAG}`;
const USERNAME = `testuser_takeover_${WORKER_TAG}`;

test.describe("Screen takeover request", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("anon guest takeover: admin approves -> previous controller redirected to /ended", async ({
    browser,
    page,
    setupOrgOwnerContext,
    setupScreen,
    loginAsAnonGuest,
    screenControlPage,
  }) => {
    const owner = await setupOrgOwnerContext({
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
      username: USERNAME,
    });
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      anonEnabled: true,
      anonOnEmpty: "allow",
      anonOnTakeover: "request",
      registeredEnabled: false,
    });

    // Guest A (default page) — empty seat + "allow" policy => auto-claims.
    await loginAsAnonGuest(ctx, "Guest A");
    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );
    await expect(screenControlPage.openProjectHeading).toBeVisible();

    // Guest B in a fresh browser context — seat occupied + "request" takeover
    // policy => stays on /request and must click "Request control".
    const guestBContext = await browser.newContext();
    const guestBPage = await guestBContext.newPage();
    try {
      const loginB = new ScreenLoginPage(guestBPage);
      const requestB = new ScreenRequestPage(guestBPage);
      const controlB = new ScreenControlPage(guestBPage);

      await loginB.goto(ctx.orgSlug, ctx.screenSlug);
      await loginB.continueAsGuest("Guest B");
      await requestB.requestControlButton.click();
      await expect(requestB.waitingForApprovalAlert).toBeVisible();

      // Owner approves the takeover from the admin page.
      const adminScreenPage = new ScreenAdminPage(owner.page);
      await adminScreenPage.goto(ctx.orgSlug, ctx.screenSlug);
      await expect(adminScreenPage.pendingPanelHeading).toBeVisible();
      await adminScreenPage.approveButton.click();

      // Guest B gets control.
      await expect(guestBPage).toHaveURL(
        new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
      );
      await expect(controlB.openProjectHeading).toBeVisible();

      // Guest A loses control and is redirected to /ended.
      await expect(page).toHaveURL(
        new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/ended`),
      );
    } finally {
      await guestBContext.close();
    }
  });
});
