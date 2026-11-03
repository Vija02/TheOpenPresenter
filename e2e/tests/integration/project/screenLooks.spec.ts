import type { LayoutDoc } from "@repo/layout";
import {
  createLayoutDoc,
  createShapeElement,
  createTextElement,
  solidPaint,
} from "@repo/layout";

import { expect, test } from "../../../fixtures/screenFixture";
import {
  addOutput,
  expandOutput,
  openManageOutputs,
  showAdvanced,
} from "../../../helpers/outputs";
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

    // There from the start: the confidence look, ignoring Black/Clear
    await expandOutput(page, "Confidence monitor");
    await expect(
      page.getByRole("button", { name: "Look: Confidence monitor" }),
    ).toBeVisible();
    await showAdvanced(page);
    await expect(
      page.getByRole("switch", { name: "Follow black and clear" }),
    ).not.toBeChecked();
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

  test("an edited look shows live on the screen using it", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand, true);

    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openManageOutputs(page);
    await page.getByRole("button", { name: "Looks", exact: true }).click();

    // Built-in looks are copied to change them
    await page
      .getByRole("button", { name: "More for Confidence monitor" })
      .click();
    await expect(
      page.getByRole("button", { name: "Edit", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect(page.getByLabel("Name")).toHaveValue(
      "Confidence monitor copy",
    );
    await page.getByRole("button", { name: "Back to looks" }).click();
    await page.getByRole("button", { name: "Back to outputs" }).click();

    await expandOutput(page, "Confidence monitor");
    await page
      .getByRole("button", { name: "Look: Confidence monitor" })
      .click();
    await page.getByRole("radio", { name: "Confidence monitor copy" }).click();

    const monitor = await context.newPage();
    try {
      await monitor.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=2`);
      const nextLabel = monitor
        .locator(".lay--text-content")
        .filter({ hasText: /^Next$/ });
      await expect(nextLabel.first()).toBeVisible();

      // Drop the "Next" label from slides on the copy, and save it
      await page.getByRole("button", { name: "Edit look" }).click();
      await page
        .getByRole("button", {
          name: "Customize Slides on Confidence monitor copy",
        })
        .click();
      await expect(
        page.getByText("Slides on Confidence monitor copy"),
      ).toBeVisible();
      await page
        .getByRole("dialog")
        .locator('[data-lay-id="next-label"]')
        .click();
      await page.keyboard.press("Delete");
      await page.getByRole("button", { name: "Save", exact: true }).click();

      // The open monitor picks it up without a reload
      await expect(nextLabel).toHaveCount(0);

      // And back to where it started
      await page
        .getByRole("button", { name: "Reset to Presenter view" })
        .click();
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
    await addOutput(page, "custom layout");
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
      await output.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=3`);
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

  test("a second confidence monitor can show a look of its own", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand, true);

    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openManageOutputs(page);
    await page.screenshot({ path: "test-results/outputs-default.png" });
    await page.getByRole("button", { name: "Add output" }).click();
    await page.screenshot({ path: "test-results/outputs-add.png" });
    await page
      .getByRole("region", { name: "Add an output" })
      .getByText("Confidence monitor", { exact: true })
      .click();

    // Named on the way in
    const name = page.getByLabel("Name");
    await expect(name).toBeFocused();
    await name.fill("Back stage");

    // A new look, from the picker
    await page
      .getByRole("button", { name: "Look: Confidence monitor" })
      .click();
    await page.getByRole("button", { name: "Manage looks…" }).click();
    await page
      .getByRole("button", { name: "New confidence monitor look" })
      .click();
    await page.getByLabel("Name").fill("Back stage look");

    const front = await context.newPage();
    const back = await context.newPage();
    try {
      await front.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=2`);
      await back.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=3`);
      const nextLabel = (monitor: typeof front) =>
        monitor.locator(".lay--text-content").filter({ hasText: /^Next$/ });
      await expect(nextLabel(back).first()).toBeVisible();

      // Drop the "Next" label from slides on the new look
      await page
        .getByRole("button", { name: "Customize Slides on Back stage look" })
        .click();
      await expect(page.getByText("Slides on Back stage look")).toBeVisible();
      await page
        .getByRole("dialog")
        .locator('[data-lay-id="next-label"]')
        .click();
      await page.keyboard.press("Delete");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByRole("button", { name: "Back", exact: true }).click();

      // Nothing shows it yet
      await expect(nextLabel(back).first()).toBeVisible();

      await page.getByRole("button", { name: "Back to looks" }).click();
      await expect(
        page.getByRole("region", { name: "Confidence monitors" }),
      ).toBeInViewport();
      // Overlays aren't needed here
      await page
        .getByRole("button", { name: "Overlay", exact: true, pressed: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Overlay", exact: true }),
      ).toHaveAttribute("aria-pressed", "false");
      await page.getByRole("button", { name: "Back to outputs" }).click();

      await expandOutput(page, "Back stage");
      await page
        .getByRole("button", { name: "Look: Confidence monitor" })
        .click();
      await expect(page.getByRole("radio", { name: "Overlay" })).toHaveCount(0);
      await page.getByRole("radio", { name: "Back stage look" }).click();
      await expect(
        page.getByRole("button", { name: "Look: Back stage look" }),
      ).toBeVisible();

      await expect(nextLabel(back)).toHaveCount(0);
      await expect(nextLabel(front).first()).toBeVisible();
    } finally {
      await front.close();
      await back.close();
    }
  });
  test("looks show made-up content, switched without reloading", async ({
    page,
    e2eCommand,
  }) => {
    await login(e2eCommand);

    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openManageOutputs(page);
    await page.getByRole("button", { name: "Looks", exact: true }).click();

    // The plugin's sample, live on its second verse, not the project's song
    const select = page.getByLabel("Preview with");
    await select.selectOption("lyrics-presenter");
    const preview = page.locator('iframe[title="Look preview"]').first();
    const frame = preview.contentFrame();
    await expect(
      frame.getByText(/grace that taught my heart/i).first(),
    ).toBeVisible();
    await expect(frame.getByText("Live line marker")).toHaveCount(0);

    // Every plugin with a sample, though the project doesn't use it
    await frame.locator("body").evaluate(() => {
      (window as unknown as { kept: boolean }).kept = true;
    });
    await select.selectOption("timer");
    await expect(frame.getByText("25:00").first()).toBeVisible();
    await select.selectOption("slides");
    await expect(frame.getByText("Welcome").first()).toBeVisible();
    await select.selectOption("bible");
    await expect(frame.getByText(/For God so loved/).first()).toBeVisible();
    // Live content from elsewhere shows as a picture
    for (const plugin of ["screen-share", "video-player", "embed", "slido"]) {
      await select.selectOption(plugin);
      await expect(frame.locator('img[src^="data:image/svg"]')).toBeVisible();
    }

    // The same page throughout
    expect(
      await frame
        .locator("body")
        .evaluate(() => (window as unknown as { kept?: boolean }).kept),
    ).toBe(true);
  });
  test("a look picks a style for each plugin", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand, true);

    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openManageOutputs(page);
    await page.getByRole("button", { name: "Looks", exact: true }).click();

    // A new look shows each plugin's default style: slides with notes
    await page
      .getByRole("button", { name: "New confidence monitor look" })
      .click();
    await page.getByLabel("Name").fill("Stage look");
    const slidesStyle = page.getByRole("button", {
      name: /^Style of Slides on Stage look:/,
    });
    await expect(slidesStyle).toHaveAccessibleName(/Presenter view$/);

    // Shown on the confidence monitor
    await page.getByRole("button", { name: "Back to looks" }).click();
    await page.getByRole("button", { name: "Back to outputs" }).click();
    await expandOutput(page, "Confidence monitor");
    await page
      .getByRole("button", { name: "Look: Confidence monitor" })
      .click();
    await page.getByRole("radio", { name: "Stage look" }).click();

    const monitor = await context.newPage();
    try {
      await monitor.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=2`);
      const text = (label: string | RegExp) =>
        monitor.locator(".lay--text-content").filter({ hasText: label });
      await expect(text("Deck slide one").first()).toBeVisible();
      await expect(text("Notes for deck one")).toBeVisible();

      // Another style for slides alone. Every plugin shows at once
      await page.getByRole("button", { name: "Edit look" }).click();
      const plugins = page.getByRole("region", {
        name: "How each plugin shows",
      });
      await expect(plugins.getByRole("listitem")).toHaveCount(8);
      await slidesStyle.click();
      await page.getByRole("radio", { name: "Live + next" }).click();
      await expect(slidesStyle).toHaveAccessibleName(/Live \+ next$/);
      await expect(text(/^Next$/).first()).toBeVisible();
      await expect(text("Notes for deck one")).toHaveCount(0);
    } finally {
      await monitor.close();
    }
  });

  test("a look is deleted from its card, once no output shows it", async ({
    page,
    e2eCommand,
  }) => {
    await login(e2eCommand, true);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openManageOutputs(page);
    await page.getByRole("button", { name: "Looks", exact: true }).click();
    await page
      .getByRole("button", { name: "New confidence monitor look" })
      .click();
    await page.getByLabel("Name").fill("Spare look");
    await page.getByRole("button", { name: "Back to looks" }).click();

    // Built-in looks can only be turned off
    await page
      .getByRole("button", { name: "More for Confidence monitor" })
      .click();
    await expect(page.getByRole("button", { name: "Duplicate" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Delete/ })).toBeDisabled();
    await page.keyboard.press("Escape");

    // Main is always on: shown, but can't be turned off
    const main = page
      .getByRole("region", { name: "Main view" })
      .getByRole("button", { name: "Main", exact: true });
    await expect(main).toHaveAttribute("aria-disabled", "true");
    // Forced: it's aria-disabled, which Playwright won't click
    await main.click({ force: true });
    await expect(main).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "More for Main" }).click();
    await expect(page.getByRole("button", { name: "Edit" })).toBeDisabled();
    await page.keyboard.press("Escape");

    // In use: says where
    await page.getByRole("button", { name: "Back to outputs" }).click();
    await expandOutput(page, "Confidence monitor");
    await page.getByRole("button", { name: /^Look: / }).click();
    await page.getByRole("radio", { name: "Spare look" }).click();
    await page.getByRole("button", { name: "Looks", exact: true }).click();
    await page.getByRole("button", { name: "More for Spare look" }).click();
    await expect(page.getByRole("button", { name: /^Delete/ })).toBeDisabled();
    await expect(
      page.getByText("Pick another look on Confidence monitor first"),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Back to outputs" }).click();
    await page.getByRole("button", { name: /^Look: / }).click();
    await page.getByRole("radio", { name: "Confidence monitor" }).click();
    await page.getByRole("button", { name: "Looks", exact: true }).click();
    await page.getByRole("button", { name: "More for Spare look" }).click();
    await page.getByRole("button", { name: /^Delete/ }).click();
    await page.getByTestId("popconfirm-confirm").click();
    await expect(page.getByRole("button", { name: "Spare look" })).toHaveCount(
      0,
    );
  });
});
