import { expect, test } from "../../../fixtures/screenFixture";
import { ScreenAdminPage } from "../../../pages/ScreenGuest/ScreenAdminPage";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-session-${WORKER_TAG}`;
const SCREEN_SLUG = `testscreen-session-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Session ${WORKER_TAG}`;
const USERNAME = `testuser_session_${WORKER_TAG}`;

test.describe("Screen session", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("admin ends guest session -> guest redirected to /ended", async ({
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
      registeredEnabled: false,
    });

    await loginAsAnonGuest(ctx, "Session Anon");
    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );
    await expect(screenControlPage.openProjectHeading).toBeVisible();

    const adminScreenPage = new ScreenAdminPage(owner.page);
    await adminScreenPage.goto(ctx.orgSlug, ctx.screenSlug);
    await expect(adminScreenPage.endGuestSessionButton).toBeVisible();
    await adminScreenPage.endGuestSessionButton.click();

    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/ended`),
    );
  });

  test("guest ends their own session -> redirected to /login", async ({
    page,
    setupScreen,
    loginAsAnonGuest,
    screenControlPage,
    screenLoginPage,
  }) => {
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      anonEnabled: true,
      anonOnEmpty: "allow",
      registeredEnabled: false,
    });

    await loginAsAnonGuest(ctx, "Self End Anon");
    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );
    await expect(screenControlPage.openProjectHeading).toBeVisible();

    await screenControlPage.endSessionButton.click();

    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/login`),
    );
    await expect(screenLoginPage.heading).toBeVisible();
  });
});
