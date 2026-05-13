import { expect, test } from "../../../fixtures/screenFixture";
import { ScreenControlPage } from "../../../pages/ScreenGuest/ScreenControlPage";
import { ScreenLoginPage } from "../../../pages/ScreenGuest/ScreenLoginPage";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-admincontrol-${WORKER_TAG}`;
const SCREEN_SLUG = `testscreen-admincontrol-${WORKER_TAG}`;
const ORG_NAME = `TestOrg AdminControl ${WORKER_TAG}`;
const USERNAME = `testuser_admctl_${WORKER_TAG}`;

test.describe("Screen admin on /control", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("org member reaches /control with no active guest controller", async ({
    page,
    e2eCommand,
    setupScreen,
    screenControlPage,
  }) => {
    // Admin login first — `create_organization` must run before setupScreen
    // finds-or-creates the org.
    await e2eCommand.login({
      username: USERNAME,
      orgs: [{ name: ORG_NAME, slug: ORG_SLUG, owner: true }],
    });
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      anonEnabled: false,
      registeredEnabled: false,
    });

    await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);

    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );
    await expect(screenControlPage.pickProjectHeading).toBeVisible();
  });

  test("org member reaches /control even while an anon guest holds control", async ({
    browser,
    page,
    e2eCommand,
    setupScreen,
    screenControlPage,
  }) => {
    await e2eCommand.login({
      username: USERNAME,
      orgs: [{ name: ORG_NAME, slug: ORG_SLUG, owner: true }],
    });
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      anonEnabled: true,
      anonOnEmpty: "allow",
      registeredEnabled: false,
    });

    // Anon guest in a fresh context — empty seat + "allow" => auto-claims.
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    try {
      const guestLogin = new ScreenLoginPage(guestPage);
      const guestControl = new ScreenControlPage(guestPage);
      await guestLogin.goto(ctx.orgSlug, ctx.screenSlug);
      await guestLogin.continueAsGuest("Holding Guest");
      await expect(guestPage).toHaveURL(
        new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
      );
      await expect(guestControl.pickProjectHeading).toBeVisible();

      await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
      await expect(page).toHaveURL(
        new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
      );
      await expect(screenControlPage.pickProjectHeading).toBeVisible();
    } finally {
      await guestContext.close();
    }
  });

  test("org member sees existing projects on /control and can navigate to /admin", async ({
    page,
    e2eCommand,
    setupScreen,
    screenControlPage,
  }) => {
    await e2eCommand.login({
      username: USERNAME,
      orgs: [
        {
          name: ORG_NAME,
          slug: ORG_SLUG,
          owner: true,
          projects: [
            { name: "Admin Project Alpha", slug: "admin-project-alpha" },
            { name: "Admin Project Beta", slug: "admin-project-beta" },
          ],
        },
      ],
    });
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
    });

    await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
    await expect(screenControlPage.pickProjectHeading).toBeVisible();

    await expect(
      page.getByText("Admin Project Alpha", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Admin Project Beta", { exact: true }).first(),
    ).toBeVisible();

    await expect(screenControlPage.adminPanelButton).toBeVisible();
    await screenControlPage.adminPanelButton.click();
    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/admin`),
    );
  });
});
