import type { LayoutDoc } from "@repo/layout";
import {
  createLayoutDoc,
  createShapeElement,
  createTextElement,
  solidPaint,
} from "@repo/layout";

import { expect, test } from "../../../fixtures/screenFixture";
import { openManageOutputs } from "../../../helpers/outputs";
import { WORKER_TAG } from "../../../helpers/workerData";

/**
 * A screen set to a look shows each plugin's version of it. Here, lyrics on
 * a confidence monitor that follows the main screen: the live slide and the
 * next one, without building a layout by hand.
 */

const ORG_SLUG = `testorg-looks-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Looks ${WORKER_TAG}`;
const USERNAME = `testuser_looks_${WORKER_TAG}`;
const PROJECT_NAME = "Looks Project";
const PROJECT_SLUG = "looks-project";

const SONG = `[Verse 1]
Live line marker

[Chorus]
Next line marker`;

const deckDoc = (label: string, background: string): LayoutDoc =>
  createLayoutDoc({
    elements: [
      createShapeElement({
        id: "bg",
        rect: { x: 0, y: 0, w: 100, h: 100 },
        fill: solidPaint(background),
        locked: true,
      }),
      createTextElement({
        id: "title",
        content: label,
        rect: { x: 10, y: 30, w: 80, h: 40 },
        style: { fontSize: 10, align: "center", valign: "center" },
      }),
    ],
  });

const IMPORT_ID = "import_e2elooks";
const slidesScene = {
  pluginName: "slides",
  name: "Slides",
  activate: true,
  pluginData: {
    imports: {
      [IMPORT_ID]: {
        importId: IMPORT_ID,
        type: "custom",
        name: "E2E Looks",
        fetchId: `fetch_${IMPORT_ID}`,
        thumbnailLinks: [],
        slideClickCounts: [0, 0, 0],
        slideIds: [0, 1, 2].map((i) => `${IMPORT_ID}-slide-${i}`),
        speakerNotes: ["Notes for deck one", "Notes for deck two", ""],
        docs: [
          deckDoc("Deck slide one", "#1d4ed8"),
          deckDoc("Deck slide two", "#047857"),
          deckDoc("Deck slide three", "#b91c1c"),
        ],
        _isFetching: false,
      },
    },
    slideOrder: [0, 1, 2].map((i) => `${IMPORT_ID}:${i}`),
  },
  rendererPluginData: {
    currentSlideIndex: 0,
    currentClickCount: 0,
    lastClickTimestamp: null,
  },
};

const login = (e2eCommand: any, withSlides = false) => {
  const songId = `song_${Math.random().toString(36).slice(2, 14)}`;
  return e2eCommand.login({
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
            scenes: [
              ...(withSlides ? [slidesScene] : []),
              {
                pluginName: "lyrics-presenter",
                name: "Lyrics",
                pluginData: {
                  songs: [
                    {
                      id: songId,
                      title: "Looks Song",
                      content: SONG,
                      setting: {
                        displayType: "sections" as const,
                        sectionOrder: null,
                      },
                      looks: {},
                      _imported: true,
                    },
                  ],
                  looks: {},
                },
                rendererPluginData: { songId, currentIndex: 0 },
                activate: !withSlides,
              },
            ],
          },
        ],
      },
    ],
  });
};

test.describe("Screen looks", () => {
  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("a confidence monitor shows the live and the next lyrics", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand);

    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openManageOutputs(page);
    await page.getByRole("button", { name: "Add confidence monitor" }).click();

    // Set up already: the confidence look, ignoring Black/Clear
    await expect(page.getByLabel("Look").nth(1)).toHaveValue("confidence");
    await expect(
      page.getByRole("checkbox", { name: "Follow Black/Clear" }).nth(1),
    ).not.toBeChecked();
    // Scene picking is gone from the cards
    await expect(page.getByRole("checkbox", { name: "Lyrics" })).toHaveCount(0);
    await page.screenshot({ path: "test-results/screen-looks-manage.png" });

    const monitor = await context.newPage();
    const main = await context.newPage();
    try {
      await monitor.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=2`);
      const monitorText = monitor.locator(".lay--text-content");
      await expect(
        monitorText.filter({ hasText: "Live line marker" }).first(),
      ).toBeVisible();
      await expect(
        monitorText.filter({ hasText: "Next line marker" }).first(),
      ).toBeVisible();

      // The main screen is untouched: only the live slide
      await main.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=1`);
      const mainText = main.locator(".lay--text-content");
      await expect(
        mainText.filter({ hasText: "Live line marker" }).first(),
      ).toBeVisible();
      await expect(
        mainText.filter({ hasText: "Next line marker" }),
      ).toHaveCount(0);

      await monitor.screenshot({
        path: "test-results/screen-looks-confidence.png",
      });
    } finally {
      await monitor.close();
      await main.close();
    }
  });

  test("switches with the scene: slides, then lyrics", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand, true);

    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openManageOutputs(page);
    await page.getByRole("button", { name: "Add confidence monitor" }).click();
    await page.getByRole("button", { name: "Close" }).first().click();

    const monitor = await context.newPage();
    try {
      await monitor.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=2`);
      const text = monitor.locator(".lay--text-content");

      // Slides: live, next, the notes and where we are
      for (const expected of [
        "Deck slide one",
        "Deck slide two",
        "Notes for deck one",
        "Slide 1 of 3",
      ]) {
        await expect(text.filter({ hasText: expected }).first()).toBeVisible();
      }
      await monitor.screenshot({
        path: "test-results/screen-looks-slides.png",
      });

      // Lyrics go live on the main screen; the monitor follows
      await page
        .getByText("Lyrics", { exact: true })
        .filter({ visible: true })
        .first()
        .click();
      await page.getByTestId("slide-container").nth(0).click();

      await expect(
        text.filter({ hasText: "Next line marker" }).first(),
      ).toBeVisible();
      // The slides stay mounted underneath, faded out, like on any screen
      const live = monitor.getByTestId("current-scene");
      await expect(
        live
          .locator(".lay--text-content", { hasText: "Live line marker" })
          .first(),
      ).toBeVisible();
      await expect(
        live.locator(".lay--text-content", { hasText: "Notes for deck one" }),
      ).toHaveCount(0);
      // Past the crossfade between the scenes
      await monitor.waitForTimeout(1500);
      await monitor.screenshot({
        path: "test-results/screen-looks-switched.png",
      });
    } finally {
      await monitor.close();
    }
  });

  test("an edited look shows on every confidence monitor", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand, true);

    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openManageOutputs(page);
    await page.getByRole("button", { name: "Add confidence monitor" }).click();

    const monitor = await context.newPage();
    try {
      await monitor.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=2`);
      const nextLabel = monitor
        .locator(".lay--text-content")
        .filter({ hasText: /^Next$/ });
      await expect(nextLabel.first()).toBeVisible();

      // Drop the "Next" label from slides' confidence look, and save it
      await page.getByRole("button", { name: "Slides" }).click();
      await expect(
        page.getByText("Confidence monitor look - Slides"),
      ).toBeVisible();
      await page
        .getByRole("dialog")
        .locator('[data-lay-id="next-label"]')
        .click();
      await page.keyboard.press("Delete");
      await page.getByRole("button", { name: "Save", exact: true }).click();

      // The open monitor picks it up without a reload
      await expect(nextLabel).toHaveCount(0);

      // And back to the built-in one
      await page.getByRole("button", { name: "Reset to built-in" }).click();
      await expect(nextLabel.first()).toBeVisible();
    } finally {
      await monitor.close();
    }
  });

  test("Black covers the main output, not the confidence monitor", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand);

    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openManageOutputs(page);
    await page.getByRole("button", { name: "Add confidence monitor" }).click();
    await page.getByRole("button", { name: "Close" }).first().click();

    const monitor = await context.newPage();
    const main = await context.newPage();
    try {
      await monitor.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=2`);
      await main.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=1`);
      await expect(
        main
          .locator(".lay--text-content", { hasText: "Live line marker" })
          .first(),
      ).toBeVisible();

      await page.getByRole("button", { name: "Black", exact: true }).click();

      await expect(main.locator(".bg-black.z-\\[999\\]")).toBeVisible();
      await expect(monitor.locator(".bg-black.z-\\[999\\]")).toHaveCount(0);
      await expect(
        monitor
          .locator(".lay--text-content", { hasText: "Next line marker" })
          .first(),
      ).toBeVisible();
    } finally {
      await monitor.close();
      await main.close();
    }
  });

  test("a custom output shows what's live in a look, beside its own text", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand);

    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openManageOutputs(page);
    await page.getByRole("button", { name: "Add custom layout" }).click();
    await expect(page.getByText(/Layout Settings - Custom/)).toBeVisible();

    // The live box it starts with, switched to the confidence look
    await page.getByRole("dialog").locator('[data-lay-id="program"]').click();
    await page
      .locator("div.grid")
      .filter({ has: page.locator('span:text-is("Look")') })
      .locator("select")
      .first()
      .selectOption("confidence");

    // And something of its own, that stays whatever is live
    await page.getByRole("button", { name: "Add text" }).click();

    const output = await context.newPage();
    try {
      await output.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=2`);
      const text = output.locator(".lay--text-content");
      for (const expected of [
        "Live line marker",
        "Next line marker",
        "Your text here",
      ]) {
        await expect(text.filter({ hasText: expected }).first()).toBeVisible();
      }
      // Past the lyrics' fade in
      await output.waitForTimeout(1500);
      await output.screenshot({
        path: "test-results/screen-looks-custom.png",
      });
    } finally {
      await output.close();
    }
  });
});
