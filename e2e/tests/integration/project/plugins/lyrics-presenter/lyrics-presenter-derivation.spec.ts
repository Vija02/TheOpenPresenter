import type { Locator, Page } from "@playwright/test";

import { expect, test } from "../../../../../fixtures/screenFixture";

/**
 * Lyrics on a confidence monitor: a live content element showing the lyrics
 * scene, with the plugin's own derivation controls in the layout inspector.
 *
 * Asserts on the element's preview frame, which draws the stored layout the
 * same way the screen does.
 */

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-lyderiv-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Lyrics Deriv ${WORKER_TAG}`;
const USERNAME = `testuser_lyderiv_${WORKER_TAG}`;
const PROJECT_NAME = "Lyrics Deriv Project";
const PROJECT_SLUG = "lyrics-deriv-project";
const SCENE_NAME = "Lyrics";

const SONG = `[Verse 1]
[D]All the saints and [E]angels
They b[D]ow before Your [E]throne

[Chorus]
You are worthy of it [A]all`;

/** The live slide's colour, where the template doesn't style it */
const LIVE_COLOR = "rgb(250, 204, 21)";

const lyricsScene = (currentIndex: number) => {
  const songId = `song_${Math.random().toString(36).slice(2, 14)}`;
  return {
    pluginName: "lyrics-presenter",
    name: SCENE_NAME,
    pluginData: {
      songs: [
        {
          id: songId,
          title: "All the Saints",
          content: SONG,
          setting: { displayType: "sections" as const, sectionOrder: null },
          looks: {},
          _imported: true,
        },
      ],
      looks: {},
    },
    rendererPluginData: { songId, currentIndex },
    activate: true,
  };
};

const login = (e2eCommand: any, currentIndex = 0) =>
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
            scenes: [lyricsScene(currentIndex)],
          },
        ],
      },
    ],
  });

/**
 * Opens screen 1's layout editor with the lyrics scene placed on it. Returns
 * the drawn text in its preview, leaving out the text measurer's hidden copy
 */
const placeLyrics = async (page: Page): Promise<Locator> => {
  await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
  await page.getByRole("button", { name: "Manage Renderers" }).click();
  await expect(page.getByText("Manage Renderers")).toBeVisible();
  await page.getByRole("checkbox", { name: "Use custom layout" }).check();
  await page.getByRole("button", { name: "Configure" }).click();
  await expect(page.getByText(/Layout Settings/)).toBeVisible();

  await page.getByRole("button", { name: "Add live content" }).click();
  await page.getByRole("button", { name: SCENE_NAME, exact: true }).click();
  await expect(page.locator("[data-lay-host]").first()).toBeVisible();

  return page
    .frameLocator("iframe[title='Live content preview']")
    .locator(".lay--text-content");
};

const derivationCheckbox = (page: Page, label: string) =>
  page.getByRole("checkbox", { name: label, exact: true });

/** The select in a labelled inspector row */
const derivationSelect = (page: Page, label: string) =>
  page
    .locator("div.grid")
    .filter({ has: page.locator(`span:text-is("${label}")`) })
    .locator("select")
    .first();

test.describe.serial("Lyrics Presenter - Confidence monitor", () => {
  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("shows the plugin's controls, at their defaults", async ({
    page,
    e2eCommand,
  }) => {
    await login(e2eCommand);
    await placeLyrics(page);

    await expect(derivationCheckbox(page, "Show background")).toBeChecked();
    await expect(derivationCheckbox(page, "Show chords")).not.toBeChecked();
    await expect(derivationSelect(page, "Look")).toHaveValue("");
    await expect(
      derivationCheckbox(page, "Highlight the live slide"),
    ).not.toBeChecked();
  });

  test("shows chords over the lyrics when asked", async ({
    page,
    e2eCommand,
  }) => {
    await login(e2eCommand);
    const preview = await placeLyrics(page);

    // Without chords, a chord inside a word leaves it whole
    await expect(
      preview.getByText("They bow before Your throne").first(),
    ).toBeVisible();
    await expect(preview.getByText("D", { exact: true })).toHaveCount(0);

    await derivationCheckbox(page, "Show chords").check();

    const chord = preview.getByText("D", { exact: true }).first();
    await expect(chord).toBeVisible();
    await expect(preview.getByText("E", { exact: true }).first()).toBeVisible();

    // Above its words, and starting where they do. The words' box takes in
    // the font's ascent, so it can reach a little into the chord's line
    const words = preview.getByText("All the saints and", { exact: true });
    await expect(words.first()).toBeVisible();
    const chordBox = (await chord.boundingBox())!;
    const wordsBox = (await words.first().boundingBox())!;
    expect(chordBox.y + chordBox.height / 2).toBeLessThan(wordsBox.y);
    expect(Math.abs(chordBox.x - wordsBox.x)).toBeLessThan(2);

    // And off again
    await derivationCheckbox(page, "Show chords").uncheck();
    await expect(preview.getByText("D", { exact: true })).toHaveCount(0);
  });

  test("shows the whole song in the Full song look", async ({
    page,
    e2eCommand,
  }) => {
    await login(e2eCommand);
    const preview = await placeLyrics(page);

    // The song shows in sections, so one slide at a time
    await expect(
      preview.getByText("All the saints and angels").first(),
    ).toBeVisible();
    await expect(preview.getByText("You are worthy of it all")).toHaveCount(0);

    await derivationSelect(page, "Look").selectOption({ label: "Full song" });

    await expect(preview.getByText("Verse 1", { exact: true })).toBeVisible();
    await expect(preview.getByText("Chorus", { exact: true })).toBeVisible();
    await expect(
      preview.getByText("You are worthy of it all").first(),
    ).toBeVisible();
  });

  test("picks out the live slide in the full song, chords and heading too", async ({
    page,
    e2eCommand,
  }) => {
    // The chorus is live
    await login(e2eCommand, 1);
    const preview = await placeLyrics(page);

    await derivationSelect(page, "Look").selectOption({ label: "Full song" });
    await derivationCheckbox(page, "Show chords").check();

    const liveWords = preview.getByText("You are worthy of it", {
      exact: true,
    });
    const liveChord = preview.getByText("A", { exact: true });
    const liveHeading = preview.getByText("Chorus", { exact: true });
    const otherWords = preview.getByText("All the saints and", { exact: true });
    const otherChord = preview.getByText("D", { exact: true }).first();
    const otherHeading = preview.getByText("Verse 1", { exact: true });

    await expect(liveWords).toBeVisible();
    await expect(liveWords).not.toHaveCSS("color", LIVE_COLOR);

    await derivationCheckbox(page, "Highlight the live slide").check();

    await expect(liveWords).toHaveCSS("color", LIVE_COLOR);
    await expect(liveChord).toHaveCSS("color", LIVE_COLOR);
    await expect(liveHeading).toHaveCSS("color", LIVE_COLOR);

    await expect(otherWords).not.toHaveCSS("color", LIVE_COLOR);
    await expect(otherChord).not.toHaveCSS("color", LIVE_COLOR);
    await expect(otherHeading).not.toHaveCSS("color", LIVE_COLOR);
  });
});
