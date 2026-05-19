import { expect, test } from "../../../../fixtures/screenFixture";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-cpguest-${WORKER_TAG}`;
const SCREEN_SLUG = `testscreen-cpguest-${WORKER_TAG}`;
const ORG_NAME = `TestOrg ControlGuest ${WORKER_TAG}`;
const USERNAME = `testuser_cpguest_${WORKER_TAG}`;

test.describe("Screen /control as anonymous guest", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("shows temp-project card and sign-in alert; no project picker", async ({
    page,
    setupScreen,
    loginAsAnonGuest,
    screenControlPage,
  }) => {
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
      slug: SCREEN_SLUG,
      anonEnabled: true,
      anonOnEmpty: "allow",
      registeredEnabled: false,
    });

    await loginAsAnonGuest(ctx, "Anon Control Guest");
    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );

    // !isLoggedIn branch: temp-project card + sign-in alert visible.
    await expect(screenControlPage.createTemporaryProjectButton).toBeVisible();
    await expect(screenControlPage.signInAlert).toBeVisible();

    // Project picker is gated on isLoggedIn — none of these should show.
    await expect(screenControlPage.openProjectHeading).toBeHidden();
    await expect(screenControlPage.newProjectDropdownButton).toBeHidden();
    await expect(screenControlPage.showOtherOrgsButton).toBeHidden();
  });

  test("creating a temporary project navigates to /app and shows 'Currently showing' on return", async ({
    page,
    setupScreen,
    loginAsAnonGuest,
    screenControlPage,
  }) => {
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
      slug: SCREEN_SLUG,
      anonEnabled: true,
      anonOnEmpty: "allow",
      registeredEnabled: false,
    });

    await loginAsAnonGuest(ctx, "Temp Project Guest");
    await expect(screenControlPage.createTemporaryProjectButton).toBeVisible();

    await screenControlPage.createTemporaryProjectButton.click();
    // Server-generated temp slug — just match the org segment.
    await expect(page).toHaveURL(new RegExp(`/app/${ctx.orgSlug}/[^/]+`));

    // The temporary project is now bound to the screen.
    await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
    await expect(screenControlPage.currentlyShowingLabel).toBeVisible();
    await expect(screenControlPage.clearScreenButton).toBeVisible();
    await expect(screenControlPage.openProjectButton).toBeVisible();
  });

  test("opening the 'Open project' button on the currently-showing card navigates to /app", async ({
    page,
    setupScreen,
    loginAsAnonGuest,
    screenControlPage,
  }) => {
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      orgName: ORG_NAME,
      slug: SCREEN_SLUG,
      anonEnabled: true,
      anonOnEmpty: "allow",
      registeredEnabled: false,
    });

    await loginAsAnonGuest(ctx, "Open Project Guest");
    await screenControlPage.createTemporaryProjectButton.click();
    await expect(page).toHaveURL(new RegExp(`/app/${ctx.orgSlug}/[^/]+`));

    await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
    await expect(screenControlPage.openProjectButton).toBeVisible();
    await screenControlPage.openProjectButton.click();

    await expect(page).toHaveURL(new RegExp(`/app/${ctx.orgSlug}/[^/]+`));
  });
});
