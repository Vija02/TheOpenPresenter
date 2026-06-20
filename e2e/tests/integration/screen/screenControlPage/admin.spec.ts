import { expect, test } from "../../../../fixtures/screenFixture";
import { RendererScreenPage } from "../../../../pages/Renderer/RendererScreenPage";
import { ScreenControlPage } from "../../../../pages/ScreenGuest/ScreenControlPage";
import { ScreenLoginPage } from "../../../../pages/ScreenGuest/ScreenLoginPage";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-cpadm-${WORKER_TAG}`;
const SECONDARY_ORG_SLUG = `testorg-cpadm2-${WORKER_TAG}`;
const SCREEN_SLUG = `testscreen-cpadm-${WORKER_TAG}`;
const ORG_NAME = `TestOrg ControlAdmin ${WORKER_TAG}`;
const SECONDARY_ORG_NAME = `TestOrg ControlAdmin Other ${WORKER_TAG}`;
const USERNAME = `testuser_cpadm_${WORKER_TAG}`;

// Minimal lyrics-presenter scene payload for the login backdoor. `_imported: true`
// skips the importer; `currentIndex: 0` activates the first slide so the
// renderer paints the marker text immediately.
const lyricsScene = (songTitle: string, marker: string) => {
  const songId = `song_${Math.random().toString(36).slice(2, 14)}`;
  return {
    pluginName: "lyrics-presenter",
    pluginData: {
      songs: [
        {
          id: songId,
          title: songTitle,
          content: `[Verse 1]\n${marker}`,
          setting: { displayType: "sections" as const },
          _imported: true,
        },
      ],
      videoBackgrounds: [],
    },
    rendererPluginData: { songId, currentIndex: 0 },
    activate: true,
  };
};

test.describe("Screen /control as org member", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: SECONDARY_ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("reaches /control with no active guest controller", async ({
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
      anonEnabled: false,
      registeredEnabled: false,
    });

    await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);

    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
    );
    await expect(screenControlPage.openProjectHeading).toBeVisible();
  });

  test("reaches /control even while an anon guest holds control", async ({
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
      await expect(guestControl.createTemporaryProjectButton).toBeVisible();

      await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
      await expect(page).toHaveURL(
        new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/control`),
      );
      await expect(screenControlPage.openProjectHeading).toBeVisible();
    } finally {
      await guestContext.close();
    }
  });

  test("sees existing projects on /control and can navigate to /admin", async ({
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
    await expect(screenControlPage.openProjectHeading).toBeVisible();

    await expect(
      page.getByText("Admin Project Alpha", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Admin Project Beta", { exact: true }).first(),
    ).toBeVisible();
    // Screen's org is the member's primary org — its heading is suppressed.
    await expect(screenControlPage.orgHeading(ORG_NAME)).toBeHidden();

    await expect(screenControlPage.adminPanelButton).toBeVisible();
    await screenControlPage.adminPanelButton.click();
    await expect(page).toHaveURL(
      new RegExp(`/o/${ctx.orgSlug}/screens/${ctx.screenSlug}/admin`),
    );
  });

  test("selecting a project assigns it and the 'Showing now' badge appears in the picker", async ({
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
            { name: "Showing Now Alpha", slug: "showing-now-alpha" },
            { name: "Showing Now Beta", slug: "showing-now-beta" },
          ],
        },
      ],
    });
    const ctx = await setupScreen({ orgSlug: ORG_SLUG, slug: SCREEN_SLUG });

    // Clicking a project card assigns it and navigates to /app/...
    await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
    await expect(screenControlPage.openProjectHeading).toBeVisible();
    await page.getByText("Showing Now Alpha", { exact: true }).first().click();
    await expect(page).toHaveURL(
      new RegExp(`/app/${ctx.orgSlug}/showing-now-alpha`),
    );

    // Back on /control: card + badge present, badge appears exactly once.
    await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
    await expect(screenControlPage.currentlyShowingLabel).toBeVisible();
    await expect(screenControlPage.showingNowBadge).toBeVisible();
    await expect(screenControlPage.showingNowBadge).toHaveCount(1);
  });

  test("Clear screen removes the current project assignment", async ({
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
          projects: [{ name: "Clear Project", slug: "clear-project" }],
        },
      ],
    });
    const ctx = await setupScreen({ orgSlug: ORG_SLUG, slug: SCREEN_SLUG });

    // Assign first so there's something to clear.
    await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
    await page.getByText("Clear Project", { exact: true }).first().click();
    await expect(page).toHaveURL(
      new RegExp(`/app/${ctx.orgSlug}/clear-project`),
    );

    await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
    await expect(screenControlPage.currentlyShowingLabel).toBeVisible();
    await expect(screenControlPage.showingNowBadge).toBeVisible();

    await screenControlPage.clearScreenButton.click();

    await expect(screenControlPage.currentlyShowingLabel).toBeHidden();
    await expect(screenControlPage.showingNowBadge).toHaveCount(0);
  });

  test("multi-org member: primary org heading hidden, toggle reveals other orgs", async ({
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
            { name: "Primary Org Project", slug: "primary-org-project" },
          ],
        },
        {
          name: SECONDARY_ORG_NAME,
          slug: SECONDARY_ORG_SLUG,
          owner: true,
          projects: [
            { name: "Secondary Org Project", slug: "secondary-org-project" },
          ],
        },
      ],
    });
    const ctx = await setupScreen({ orgSlug: ORG_SLUG, slug: SCREEN_SLUG });

    await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
    await expect(screenControlPage.openProjectHeading).toBeVisible();

    // Screen's org is the primary group for members — projects visible,
    // OrgHeading suppressed.
    await expect(
      page.getByText("Primary Org Project", { exact: true }).first(),
    ).toBeVisible();
    await expect(screenControlPage.orgHeading(ORG_NAME)).toBeHidden();

    // Other orgs collapsed behind the toggle.
    await expect(screenControlPage.orgHeading(SECONDARY_ORG_NAME)).toBeHidden();
    await expect(
      page.getByText("Secondary Org Project", { exact: true }),
    ).toBeHidden();
    await expect(screenControlPage.showOtherOrgsButton).toBeVisible();

    await screenControlPage.showOtherOrgsButton.click();

    await expect(
      screenControlPage.orgHeading(SECONDARY_ORG_NAME),
    ).toBeVisible();
    await expect(
      page.getByText("Secondary Org Project", { exact: true }).first(),
    ).toBeVisible();
    await expect(screenControlPage.showOtherOrgsButton).toBeHidden();
  });

  test("clicking a project on /control shows that project on the renderer", async ({
    page,
    context,
    e2eCommand,
    setupScreen,
    screenControlPage,
  }) => {
    const projectName = "Renderer Pick Project";
    const projectSlug = "renderer-pick-project";
    const marker = "Renderer pick marker delta";

    await e2eCommand.login({
      username: USERNAME,
      orgs: [
        {
          name: ORG_NAME,
          slug: ORG_SLUG,
          owner: true,
          projects: [
            {
              name: projectName,
              slug: projectSlug,
              scenes: [lyricsScene("Renderer Pick Song", marker)],
            },
          ],
        },
      ],
    });
    const ctx = await setupScreen({ orgSlug: ORG_SLUG, slug: SCREEN_SLUG });

    const rendererPage = await context.newPage();
    try {
      const renderer = new RendererScreenPage(rendererPage);
      await renderer.goto(ctx.orgSlug, ctx.screenSlug);
      await expect(renderer.idleMessage).toBeVisible();

      await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
      await expect(screenControlPage.openProjectHeading).toBeVisible();
      await page.getByText(projectName, { exact: true }).first().click();
      await expect(page).toHaveURL(
        new RegExp(`/app/${ctx.orgSlug}/${projectSlug}`),
      );

      // Renderer flips from idle to the project's active scene.
      await expect(renderer.idleMessage).toBeHidden();
      await expect(renderer.currentScene).toBeVisible({ timeout: 100000 });
      await expect(renderer.lyricsContainer.first()).toBeVisible();
      await expect(rendererPage.getByText(marker).first()).toBeVisible();
    } finally {
      await rendererPage.close();
    }
  });

  test("creating a new project from /control assigns it to the screen and opens it", async ({
    page,
    e2eCommand,
    setupScreen,
    screenControlPage,
  }) => {
    await e2eCommand.login({
      username: USERNAME,
      orgs: [{ name: ORG_NAME, slug: ORG_SLUG, owner: true }],
    });
    const ctx = await setupScreen({ orgSlug: ORG_SLUG, slug: SCREEN_SLUG });

    await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
    await expect(screenControlPage.openProjectHeading).toBeVisible();
    await expect(screenControlPage.newProjectDropdownButton).toBeVisible();

    await screenControlPage.newProjectDropdownButton.click();
    await page
      .getByRole("button")
      .filter({ hasText: "Create a new project" })
      .click();

    // CreateProjectModal opens.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "New Project" }),
    ).toBeVisible();

    await dialog.getByLabel("Name").fill("Brand New Screen Project");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(new RegExp(`/app/${ctx.orgSlug}/[^/]+`));

    // Returning to /control confirms the new project is what's showing.
    await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
    await expect(screenControlPage.currentlyShowingLabel).toBeVisible();
    await expect(
      page.getByText("Brand New Screen Project", { exact: true }).first(),
    ).toBeVisible();
    await expect(screenControlPage.showingNowBadge).toBeVisible();
  });
});
