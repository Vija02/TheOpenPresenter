import type { Page, Route } from "@playwright/test";

import type { E2ECommandAPI } from "../../../../../e2eCommand";
import { expect, test } from "../../../../../fixtures/googleSlidesFixture";
import type { SeedScene } from "../../../../../helpers/slidesSeed";
import {
  ORG_SLUG,
  orgUrl,
  projectUrl,
} from "../../../../../helpers/workerData";

/**
 * What a slide in the list says while it isn't ready yet:
 * "Importing..." (deck still being fetched), "Processing..." (slide count
 * known, images still being made), "Loading..." (image on its way to the
 * browser), and the can't-load icon once an image gives up.
 */

const IMAGE_HOST = "https://e2e-slide-images.test";
const IMAGE_PATH = "./dummyFiles/dummyImage.jpg";
const IMPORT_ID = "import_e2eloading";

/** One image slide whose picture is served by the test. */
const imageSlideScene = (): SeedScene => ({
  pluginName: "slides",
  name: "Slides",
  activate: true,
  pluginData: {
    imports: {
      [IMPORT_ID]: {
        importId: IMPORT_ID,
        type: "image",
        name: "E2E Image",
        fetchId: "fetch_e2eloading",
        thumbnailLinks: [`${IMAGE_HOST}/slide.jpg`],
        slideClickCounts: [0],
        slideIds: ["0"],
      },
    },
    slideOrder: [`${IMPORT_ID}:0`],
  },
  rendererPluginData: {
    currentSlideIndex: 0,
    currentClickCount: 0,
    lastClickTimestamp: null,
  },
});

const firstSlide = (page: Page) =>
  page.getByTestId("slide-container").first();

const openSeededProject = async (page: Page, e2eCommand: E2ECommandAPI) => {
  await e2eCommand.loginWithScenes({
    next: orgUrl(),
    orgs: [
      {
        name: "TestOrg",
        slug: ORG_SLUG,
        projects: [
          {
            name: "TestProject",
            slug: "testproject",
            scenes: [imageSlideScene()],
          },
        ],
      },
    ],
  });
  await page.goto(projectUrl());
};

test.describe("Slides Plugin - loading states", () => {
  test.beforeEach(async ({ e2eCommand }) => await e2eCommand.clearWorkerData());

  test("shows Loading until the slide's image arrives", async ({
    page,
    e2eCommand,
  }) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(`${IMAGE_HOST}/**`, async (route: Route) => {
      await held;
      await route.fulfill({ path: IMAGE_PATH, contentType: "image/jpeg" });
    });

    await openSeededProject(page, e2eCommand);

    const slide = firstSlide(page);
    await expect(slide.getByText("Loading...")).toBeVisible({
      timeout: 30_000,
    });

    release();

    await expect(slide.locator("img")).toBeVisible();
    await expect(slide.getByText("Loading...")).toBeHidden();
  });

  test("swaps Loading for the can't-load icon once retries run out", async ({
    page,
    e2eCommand,
  }) => {
    // Every retry fails; they take about 45s in all
    test.setTimeout(120_000);
    await page.route(`${IMAGE_HOST}/**`, (route: Route) =>
      route.fulfill({ status: 404 }),
    );

    await openSeededProject(page, e2eCommand);

    const slide = firstSlide(page);
    // Still trying, so it says Loading rather than going black or broken
    await expect(slide.getByText("Loading...")).toBeVisible({
      timeout: 30_000,
    });

    await expect(slide.getByTestId("image-fallback")).toBeVisible({
      timeout: 90_000,
    });
    await expect(slide.getByText("Loading...")).toBeHidden();
    await expect(slide.locator("img")).toHaveCount(0);
  });

  test("shows Importing while a deck is fetched", async ({
    page,
    fakeGoogle,
    requireFakeGoogle,
    loginAndGoToProject,
    projectPage,
  }) => {
    test.setTimeout(90_000);
    await requireFakeGoogle();
    await loginAndGoToProject();
    await projectPage.createPlugin("Slides");

    // The fake holds this deck's export until released
    const deckId = fakeGoogle.newHeldDeckId();

    await page.getByTestId("slides-integration-googleslides").click();
    const chooser = page
      .getByRole("dialog")
      .filter({ hasText: "Paste a public link" });
    await chooser.getByTestId("slides-public-link-option").click();
    await chooser
      .getByTestId("slides-public-link-input")
      .fill(`https://docs.google.com/presentation/d/${deckId}/edit`);
    await chooser.getByTestId("slides-public-link-submit").click();

    await expect(page.getByText("Importing...")).toBeVisible({
      timeout: 30_000,
    });

    await fakeGoogle.releaseExport(deckId);

    // Through processing and loading to the finished slides
    await expect(
      page
        .getByTestId("slide-container")
        .filter({ hasText: /^Slide 2$/ })
        .locator("img"),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Importing...")).toBeHidden();
    await expect(page.getByText("Processing...")).toHaveCount(0);
    await expect(page.getByText("Loading...")).toHaveCount(0);
  });
});
