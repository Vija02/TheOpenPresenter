import { expect, test } from "../../../fixtures/screenFixture";
import { ProjectPage } from "../../../pages/ProjectPage";
import { RendererScreenPage } from "../../../pages/Renderer/RendererScreenPage";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-layout-${WORKER_TAG}`;
const SCREEN_SLUG = `testscreen-layout-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Layout ${WORKER_TAG}`;
const SCREEN_NAME = `Layout Test Screen ${WORKER_TAG}`;
const USERNAME = `testuser_layout_${WORKER_TAG}`;
const PROJECT_NAME = "Layout Source Project";
const PROJECT_SLUG = "layout-source-project";

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

const login = (e2eCommand: any, marker: string) =>
  e2eCommand.login({
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
            scenes: [lyricsScene("Layout Song", marker)],
          },
        ],
      },
    ],
  });

// The screen layout editor lives behind the sidebar's renderer management, and
// every test here needs a layout switched on for screen 1.
const openLayoutEditor = async (page: any) => {
  await page.getByRole("button", { name: "Manage Renderers" }).click();
  await expect(page.getByText("Manage Renderers")).toBeVisible();

  // Each renderer card has its own scene checkboxes too, so match the label.
  await page.getByRole("checkbox", { name: "Use custom layout" }).check();
  await page.getByRole("button", { name: "Configure" }).click();
  await expect(page.getByText(/Layout Settings/)).toBeVisible();
};

// The source list opens in a popover; entries are plain buttons named after
// the scene or screen they point at.
const addLiveContent = async (page: any) => {
  await page.getByRole("button", { name: "Add live content" }).click();
  await page.getByRole("button", { name: "Unnamed scene" }).click();
};

test.describe.serial("Screen layouts", () => {
  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("adds a live content element and renders it on the screen", async ({
    page,
    context,
    e2eCommand,
    setupScreen,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");
    const marker = "Layout marker alpha";

    await login(e2eCommand, marker);
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      name: SCREEN_NAME,
    });

    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openLayoutEditor(page);

    // Place a host element pointing at the scene playing on this project.
    await addLiveContent(page);

    // It lands on the canvas as a real element, selected and inspectable.
    const canvasItem = page.locator("[data-lay-host]").first();
    await expect(canvasItem).toBeVisible();
    await expect(page.getByText("Live content")).toBeVisible();

    // Back returns to the renderer list, which still covers the project page.
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Close" }).first().click();
    await expect(page.getByRole("dialog")).toBeHidden();

    // The output draws the layout, with the scene inside the host element.
    const rendererPage = await context.newPage();
    try {
      const renderer = new RendererScreenPage(rendererPage);
      await renderer.goto(ctx.orgSlug, ctx.screenSlug);

      const projectPage = new ProjectPage(page, context);
      await projectPage.openPresentMenu();
      await projectPage.presentScreenOption(SCREEN_NAME).click();

      await expect(rendererPage.getByText(marker).first()).toBeVisible();
    } finally {
      await rendererPage.close();
    }
  });

  test("renders a single host element on its own for the editor preview", async ({
    page,
    context,
    e2eCommand,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");
    const marker = "Layout marker preview";

    await login(e2eCommand, marker);

    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openLayoutEditor(page);

    await addLiveContent(page);

    // The canvas frames the renderer rather than mounting plugin components,
    // because only the renderer app is served plugin bundles.
    const frame = page.frameLocator("iframe[title='Live content preview']");
    await expect(frame.getByText(marker).first()).toBeVisible();

    // preview=1 keeps the frame out of screen-session tracking, and
    // hostElement= is what makes the renderer draw one element full-frame.
    const src = await page
      .locator("iframe[title='Live content preview']")
      .getAttribute("src");
    expect(src).toMatch(/preview=1/);
    expect(src).toMatch(/hostElement=/);
  });

  test("keeps an existing layout working after the editor reopens", async ({
    page,
    context,
    e2eCommand,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");
    const marker = "Layout marker persist";

    await login(e2eCommand, marker);

    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openLayoutEditor(page);

    await addLiveContent(page);
    await expect(page.locator("[data-lay-host]").first()).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();

    // Reopening reads the stored document back rather than starting empty.
    await page.getByRole("button", { name: "Configure" }).click();
    await expect(page.getByText(/Layout Settings/)).toBeVisible();
    await expect(page.locator("[data-lay-host]").first()).toBeVisible();
  });
});
