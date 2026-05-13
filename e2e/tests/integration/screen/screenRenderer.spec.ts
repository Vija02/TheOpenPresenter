import { expect, test } from "../../../fixtures/screenFixture";
import { LyricsPlugin } from "../../../pages/LyricsPlugin";
import { ProjectPage } from "../../../pages/ProjectPage";
import { RendererScreenPage } from "../../../pages/Renderer/RendererScreenPage";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-renderer-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Renderer ${WORKER_TAG}`;
const SCREEN_SLUG = `testscreen-renderer-${WORKER_TAG}`;
const USERNAME = `testuser_render_${WORKER_TAG}`;

const PROJECT_ONE_SLUG = "renderer-project-one";
const PROJECT_ONE_NAME = "Renderer Project One";
const PROJECT_TWO_SLUG = "renderer-project-two";
const PROJECT_TWO_NAME = "Renderer Project Two";

const PROJECT_ONE_MARKER = "Renderer marker one alpha";
const PROJECT_TWO_MARKER = "Renderer marker two beta";
const TEMP_MARKER = "Renderer marker temp gamma";

const lyricsContent = (marker: string) => `[Verse 1]
${marker}`;

// Minimal lyrics scene payload for the login backdoor. `_imported: true`
// skips the MyWorshipList importer; `currentIndex: 0` selects the first slide
// so the renderer paints the marker without any UI clicks.
const lyricsScene = (songTitle: string, marker: string) => {
  const songId = `song_${Math.random().toString(36).slice(2, 14)}`;
  return {
    pluginName: "lyrics-presenter",
    pluginData: {
      songs: [
        {
          id: songId,
          title: songTitle,
          content: lyricsContent(marker),
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

test.describe("Screen renderer reflects project selection", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("switching projects updates the renderer", async ({
    page,
    context,
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
            {
              name: PROJECT_ONE_NAME,
              slug: PROJECT_ONE_SLUG,
              scenes: [lyricsScene("Renderer Song One", PROJECT_ONE_MARKER)],
            },
            {
              name: PROJECT_TWO_NAME,
              slug: PROJECT_TWO_SLUG,
              scenes: [lyricsScene("Renderer Song Two", PROJECT_TWO_MARKER)],
            },
          ],
        },
      ],
    });
    const ctx = await setupScreen({ orgSlug: ORG_SLUG, slug: SCREEN_SLUG });

    // Renderer in a second tab — same context shares the org-owner session,
    // so the renderer's GraphQL/YJS access is authorized.
    const rendererPage = await context.newPage();
    try {
      const renderer = new RendererScreenPage(rendererPage);
      await renderer.goto(ctx.orgSlug, ctx.screenSlug);
      await expect(renderer.idleMessage).toBeVisible();

      // Assign project 1 via /control. Admin tab redirects to /app/...
      await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
      await expect(screenControlPage.pickProjectHeading).toBeVisible();
      await page.getByText(PROJECT_ONE_NAME, { exact: true }).first().click();
      await expect(page).toHaveURL(
        new RegExp(`/app/${ORG_SLUG}/${PROJECT_ONE_SLUG}`),
      );

      await expect(renderer.currentScene).toBeVisible();
      await expect(renderer.lyricsContainer.first()).toBeVisible();
      // The lyrics SVG renders the line in both a shadow layer and the main
      // text layer, so .first() picks the visible main tspan.
      await expect(
        rendererPage.getByText(PROJECT_ONE_MARKER).first(),
      ).toBeVisible();

      // Switch to project 2 via /control.
      await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
      await expect(screenControlPage.pickProjectHeading).toBeVisible();
      await page.getByText(PROJECT_TWO_NAME, { exact: true }).first().click();
      await expect(page).toHaveURL(
        new RegExp(`/app/${ORG_SLUG}/${PROJECT_TWO_SLUG}`),
      );

      await expect(
        rendererPage.getByText(PROJECT_TWO_MARKER).first(),
      ).toBeVisible();
      await expect(rendererPage.getByText(PROJECT_ONE_MARKER)).toHaveCount(0);
    } finally {
      await rendererPage.close();
    }
  });

  test("renderer renders a newly created temporary project", async ({
    page,
    context,
    e2eCommand,
    setupScreen,
    screenControlPage,
  }) => {
    const projectPage = new ProjectPage(page, context);
    const lyricsPlugin = new LyricsPlugin(page);

    await e2eCommand.login({
      username: USERNAME,
      orgs: [{ name: ORG_NAME, slug: ORG_SLUG, owner: true }],
    });
    const ctx = await setupScreen({ orgSlug: ORG_SLUG, slug: SCREEN_SLUG });

    const rendererPage = await context.newPage();
    try {
      const renderer = new RendererScreenPage(rendererPage);
      await renderer.goto(ctx.orgSlug, ctx.screenSlug);
      await expect(renderer.idleMessage).toBeVisible();

      await screenControlPage.goto(ctx.orgSlug, ctx.screenSlug);
      await expect(screenControlPage.pickProjectHeading).toBeVisible();
      await screenControlPage.createTemporaryProjectButton.click();

      // createTemporaryProject sets current_project_id and redirects
      // to /app/<orgSlug>/temp-<uuid>.
      await expect(page).toHaveURL(new RegExp(`/app/${ORG_SLUG}/temp-`));

      await projectPage.createPlugin("Lyrics Presenter");
      await lyricsPlugin.addCustomSong(
        "Renderer Temp Song",
        lyricsContent(TEMP_MARKER),
      );
      await expect(page.getByTestId("slide-container").first()).toBeVisible();
      await page.getByTestId("slide-container").nth(0).click();

      await expect(renderer.currentScene).toBeVisible();
      await expect(renderer.lyricsContainer.first()).toBeVisible();
      await expect(rendererPage.getByText(TEMP_MARKER).first()).toBeVisible();
    } finally {
      await rendererPage.close();
    }
  });
});
