import { expect, test } from "../../../fixtures/screenFixture";
import { ProjectPage } from "../../../pages/ProjectPage";
import { RendererScreenPage } from "../../../pages/Renderer/RendererScreenPage";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-present-${WORKER_TAG}`;
const SCREEN_SLUG = `testscreen-present-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Present ${WORKER_TAG}`;
const SCREEN_NAME = `Present Test Screen ${WORKER_TAG}`;
const USERNAME = `testuser_present_${WORKER_TAG}`;
const PROJECT_NAME = "Present Source Project";
const PROJECT_SLUG = "present-source-project";

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

test.describe("Present to a screen from the remote", () => {
  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("presents the project to a screen and unassigns it", async ({
    page,
    context,
    e2eCommand,
    setupScreen,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");
    const marker = "Present marker alpha";

    await e2eCommand.login({
      username: USERNAME,
      orgs: [
        {
          name: ORG_NAME,
          slug: ORG_SLUG,
          owner: true,
          projects: [
            {
              name: PROJECT_NAME,
              slug: PROJECT_SLUG,
              scenes: [lyricsScene("Present Song", marker)],
            },
          ],
        },
      ],
    });
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      name: SCREEN_NAME,
    });

    // The screen's renderer starts idle.
    const rendererPage = await context.newPage();
    try {
      const renderer = new RendererScreenPage(rendererPage);
      await renderer.goto(ctx.orgSlug, ctx.screenSlug);
      await expect(renderer.idleMessage).toBeVisible();

      // Open the remote and present this project to the screen.
      const projectPage = new ProjectPage(page, context);
      await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
      await projectPage.openPresentMenu();
      await expect(projectPage.presentScreenOption(SCREEN_NAME)).toBeVisible();
      await projectPage.presentScreenOption(SCREEN_NAME).click();

      // The row reports it's presenting, and the renderer flips to the scene.
      await expect(projectPage.presentingHereIndicator).toBeVisible();
      await expect(renderer.idleMessage).toBeHidden();
      await expect(renderer.currentScene).toBeVisible();
      await expect(rendererPage.getByText(marker).first()).toBeVisible();

      // Unassigning clears the screen back to idle.
      await projectPage.stopPresentingButton.click();
      await expect(projectPage.presentingHereIndicator).toBeHidden();
      await expect(renderer.idleMessage).toBeVisible();
    } finally {
      await rendererPage.close();
    }
  });

  test("shows an empty state with a link when the org has no screens", async ({
    page,
    context,
    e2eCommand,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await e2eCommand.login({
      username: USERNAME,
      orgs: [
        {
          name: ORG_NAME,
          slug: ORG_SLUG,
          owner: true,
          projects: [{ name: PROJECT_NAME, slug: PROJECT_SLUG }],
        },
      ],
    });

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await projectPage.openPresentMenu();

    await expect(page.getByText("No screens set up yet.")).toBeVisible();
    await expect(projectPage.noScreensSetUpLink).toBeVisible();
  });

  test("'Open in new tab' links to the renderer URL", async ({
    page,
    context,
    e2eCommand,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await e2eCommand.login({
      username: USERNAME,
      orgs: [
        {
          name: ORG_NAME,
          slug: ORG_SLUG,
          owner: true,
          projects: [{ name: PROJECT_NAME, slug: PROJECT_SLUG }],
        },
      ],
    });

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await projectPage.openPresentMenu();

    await expect(projectPage.openInNewTabLink).toHaveAttribute(
      "href",
      new RegExp(`/render/${ORG_SLUG}/${PROJECT_SLUG}`),
    );
  });
});
