import { expect, test } from "../../../../fixtures/screenFixture";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const SCREEN_ORG_SLUG = `testorg-cpgli-scr-${WORKER_TAG}`;
const SCREEN_ORG_NAME = `TestOrg ControlGuestLoggedIn Screen ${WORKER_TAG}`;
const USER_ORG_SLUG = `testorg-cpgli-user-${WORKER_TAG}`;
const USER_ORG_NAME = `TestOrg ControlGuestLoggedIn User ${WORKER_TAG}`;
const USER_ORG_SLUG_2 = `testorg-cpgli-user2-${WORKER_TAG}`;
const USER_ORG_NAME_2 = `TestOrg ControlGuestLoggedIn User Other ${WORKER_TAG}`;
const SCREEN_SLUG = `testscreen-cpgli-${WORKER_TAG}`;
const USERNAME = `testuser_cpgli_${WORKER_TAG}`;

test.describe("Screen /control as logged-in guest (non-member of screen org)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: SCREEN_ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: USER_ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: USER_ORG_SLUG_2,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("single own org: picker shows the user's projects with the OrgHeading and no toggle", async ({
    page,
    e2eCommand,
    setupScreen,
    loginAsAnonGuest,
    screenControlPage,
  }) => {
    // User belongs to their own org. The screen lives in a different org
    // that setupScreen auto-creates — the user is not a member there.
    await e2eCommand.login({
      username: USERNAME,
      orgs: [
        {
          name: USER_ORG_NAME,
          slug: USER_ORG_SLUG,
          owner: true,
          projects: [
            { name: "User Project Alpha", slug: "user-project-alpha" },
          ],
        },
      ],
    });
    const ctx = await setupScreen({
      orgSlug: SCREEN_ORG_SLUG,
      orgName: SCREEN_ORG_NAME,
      slug: SCREEN_SLUG,
      anonEnabled: true,
      anonOnEmpty: "allow",
      registeredEnabled: false,
    });

    // Logged-in user goes through the guest flow on the foreign-org screen.
    await loginAsAnonGuest(ctx, "Logged-in Guest");
    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );

    // The picker is rendered (currentUser is present), and the user's org
    // heading is shown (hidePrimaryHeading is false for non-members).
    await expect(screenControlPage.openProjectHeading).toBeVisible();
    await expect(screenControlPage.orgHeading(USER_ORG_NAME)).toBeVisible();
    await expect(
      page.getByText("User Project Alpha", { exact: true }).first(),
    ).toBeVisible();

    // Only one org — no "Show projects from other organizations" toggle.
    await expect(screenControlPage.showOtherOrgsButton).toBeHidden();
  });

  test("multi own orgs: primary org shown first; toggle reveals the others", async ({
    page,
    e2eCommand,
    setupScreen,
    loginAsAnonGuest,
    screenControlPage,
  }) => {
    await e2eCommand.login({
      username: USERNAME,
      orgs: [
        {
          name: USER_ORG_NAME,
          slug: USER_ORG_SLUG,
          owner: true,
          projects: [
            { name: "User Org Project One", slug: "user-org-project-one" },
          ],
        },
        {
          name: USER_ORG_NAME_2,
          slug: USER_ORG_SLUG_2,
          owner: true,
          projects: [
            { name: "User Org Project Two", slug: "user-org-project-two" },
          ],
        },
      ],
    });
    const ctx = await setupScreen({
      orgSlug: SCREEN_ORG_SLUG,
      orgName: SCREEN_ORG_NAME,
      slug: SCREEN_SLUG,
      anonEnabled: true,
      anonOnEmpty: "allow",
      registeredEnabled: false,
    });

    await loginAsAnonGuest(ctx, "Multi Org Guest");
    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );

    await expect(screenControlPage.openProjectHeading).toBeVisible();

    const orgOneVisible = await screenControlPage
      .orgHeading(USER_ORG_NAME)
      .isVisible();
    const orgTwoVisible = await screenControlPage
      .orgHeading(USER_ORG_NAME_2)
      .isVisible();
    expect(orgOneVisible !== orgTwoVisible).toBe(true);

    await expect(screenControlPage.showOtherOrgsButton).toBeVisible();
    await screenControlPage.showOtherOrgsButton.click();

    // After toggling: both orgs visible, toggle disappears.
    await expect(screenControlPage.orgHeading(USER_ORG_NAME)).toBeVisible();
    await expect(screenControlPage.orgHeading(USER_ORG_NAME_2)).toBeVisible();
    await expect(
      page.getByText("User Org Project One", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("User Org Project Two", { exact: true }).first(),
    ).toBeVisible();
    await expect(screenControlPage.showOtherOrgsButton).toBeHidden();
  });

  test("selecting a project from the picker assigns it and navigates to /app", async ({
    page,
    e2eCommand,
    setupScreen,
    loginAsAnonGuest,
    screenControlPage,
  }) => {
    await e2eCommand.login({
      username: USERNAME,
      orgs: [
        {
          name: USER_ORG_NAME,
          slug: USER_ORG_SLUG,
          owner: true,
          projects: [
            { name: "Pickable Project", slug: "pickable-project" },
          ],
        },
      ],
    });
    const ctx = await setupScreen({
      orgSlug: SCREEN_ORG_SLUG,
      orgName: SCREEN_ORG_NAME,
      slug: SCREEN_SLUG,
      anonEnabled: true,
      anonOnEmpty: "allow",
      registeredEnabled: false,
    });

    await loginAsAnonGuest(ctx, "Picker Guest");
    await expect(screenControlPage.openProjectHeading).toBeVisible();

    await page.getByText("Pickable Project", { exact: true }).first().click();

    // Project lives in the user's own org, so /app routes through that slug.
    await expect(page).toHaveURL(
      new RegExp(`/app/${USER_ORG_SLUG}/pickable-project`),
    );

    // Return to /control to confirm assignment stuck.
    await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
    await expect(screenControlPage.currentlyShowingLabel).toBeVisible();
    await expect(screenControlPage.showingNowBadge).toBeVisible();
  });

  test("creating a new project from /control creates it in the user's own org and assigns it to the screen", async ({
    page,
    e2eCommand,
    setupScreen,
    loginAsAnonGuest,
    screenControlPage,
  }) => {
    await e2eCommand.login({
      username: USERNAME,
      orgs: [
        {
          name: USER_ORG_NAME,
          slug: USER_ORG_SLUG,
          owner: true,
          // No pre-seeded projects — we'll create one through the modal.
        },
      ],
    });
    const ctx = await setupScreen({
      orgSlug: SCREEN_ORG_SLUG,
      orgName: SCREEN_ORG_NAME,
      slug: SCREEN_SLUG,
      anonEnabled: true,
      anonOnEmpty: "allow",
      registeredEnabled: false,
    });

    await loginAsAnonGuest(ctx, "Creating Guest");
    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );
    // Picker renders because currentUser is present; the "New" dropdown is
    // keyed on the user's own org (newProjectOrg falls back to the first
    // membership when lastSelectedOrganizationId is unset).
    await expect(screenControlPage.openProjectHeading).toBeVisible();
    await expect(screenControlPage.newProjectDropdownButton).toBeVisible();

    await screenControlPage.newProjectDropdownButton.click();
    await page
      .getByRole("button")
      .filter({ hasText: "Create a new project" })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "New Project" }),
    ).toBeVisible();

    await dialog.getByLabel("Name").fill("Guest Created Project");
    await dialog.getByRole("button", { name: "Save" }).click();

    // The new project is created in the user's OWN org (not the screen's
    // foreign org), and CreateProjectModal navigates to that project after
    // onCreated assigns it to the screen.
    await expect(page).toHaveURL(
      new RegExp(`/app/${USER_ORG_SLUG}/[^/]+`),
    );

    // Returning to the foreign-org screen's /control confirms the cross-org
    // assignment landed.
    await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
    await expect(screenControlPage.currentlyShowingLabel).toBeVisible();
    await expect(
      page.getByText("Guest Created Project", { exact: true }).first(),
    ).toBeVisible();
    await expect(screenControlPage.showingNowBadge).toBeVisible();
  });
});
