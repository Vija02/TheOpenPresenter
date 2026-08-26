import type { Locator, Page } from "@playwright/test";

import type { E2ECommandAPI } from "../../../e2eCommand";
import { expect, test } from "../../../fixtures/projectFixture";
import { ProjectPage } from "../../../pages/ProjectPage";

/**
 * Per-host insert defaults (`LayoutWorkbench`'s `insertDefaults`).
 *
 * The subject is that a host can change what the editor INSERTS without
 * changing the schema, and without changing it for every other host. So every
 * assertion here is a PAIR: the same gesture, in two hosts, must produce
 * different results.
 *
 * - Bible's "Slide Template" dialog passes no `insertDefaults`, so a freshly
 *   picked video must come out `loop` (the schema's own default).
 * - Slides' "Edit slides" dialog passes `{ fills: { video: { playback: "once" } } }`,
 *   so the same pick must come out `once`.
 *
 * Asserting only the slides half would pass just as happily if the default had
 * been changed globally in the schema — which is the exact mistake this feature
 * exists to avoid. The Bible half is the negative control, and vice versa.
 *
 * Playback is checked twice over, on purpose:
 *  1. the inspector's Playback toggle, i.e. what the document stores;
 *  2. the <video>'s own `loop` property, i.e. what the renderer does with it.
 * The toggle alone would pass if the value never reached the player, and the
 * player alone would pass if VideoFill guessed a mode rather than reading one.
 */

/**
 * Worker-scoped fixture names, as in slides-video.spec.ts.
 *
 * The shared `testorg` is unusable here: `clearTestOrganizations` deletes every
 * org whose slug starts with `test`, so running two browser projects (or any
 * other spec) in parallel means one run deletes the other's org mid-test. Own
 * org, own user, and cleanup scoped to exactly those two.
 */
const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG = `testorg-insertdefaults-${WORKER_TAG}`;
const PROJECT = "insert-defaults-project";
// `users_username_check` caps a username at 24 characters, so this cannot spell
// the spec's name out in full.
const USERNAME = `testuser_defaults_${WORKER_TAG}`;

const PICKER = '[data-testid="media-picker-dialog"]';
const VIDEO = "./dummyFiles/dummyVideo.mp4";
const POSTER = "./dummyFiles/dummyImage.jpg";
/** dummyVideo.mp4's real length. A video of unknown duration reads as stopped. */
const VIDEO_DURATION = 6.2;

/** Body text elements of each host's starter template, for fill-only picks. */
const BIBLE_BODY = '[data-lay-id="bible-body"]';
const SLIDES_BODY = '[data-lay-id="body"]';

/**
 * The element AddElementBar creates for a video.
 *
 * `freshElementId` numbers from 1 per document, and both starter templates ship
 * without a video, so the first insert is always `video-1`.
 */
const ADDED_VIDEO = '[data-lay-id="video-1"]';

/** Seeds a transcoded video into this worker's own org. */
const seedVideo = (e2eCommand: E2ECommandAPI) =>
  e2eCommand.seedVideoMedia({
    orgSlug: ORG,
    videoPath: VIDEO,
    posterPath: POSTER,
    duration: VIDEO_DURATION,
  });

/** Signs in to this worker's own org and opens its project. */
const goToProject = async (page: Page, e2eCommand: E2ECommandAPI) => {
  await e2eCommand.loginWithScenes({
    username: USERNAME,
    orgs: [
      {
        name: "Test Org",
        slug: ORG,
        owner: true,
        projects: [{ name: "Test Project", slug: PROJECT }],
      },
    ],
  });

  await page.goto(`/app/${ORG}/${PROJECT}`);
};

/** Bible's Slide Template dialog: a LayoutWorkbench with NO insertDefaults. */
const openBibleEditor = async (page: Page, projectPage: ProjectPage) => {
  await projectPage.createPlugin("Bible");
  await expect(page.getByText("No passages yet")).toBeVisible();

  await page.getByRole("button", { name: "Style" }).click();

  const dialog = page.getByRole("dialog", {
    name: "Slide Template",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".lay--editor-surface")).toBeVisible();
  return dialog;
};

/** Slides' Edit slides dialog: the same workbench, with insertDefaults set. */
const openSlidesEditor = async (page: Page, projectPage: ProjectPage) => {
  await projectPage.createPlugin("Slides");
  await page.getByTestId("slides-create-from-scratch").click();

  const dialog = page.getByRole("dialog", { name: "Edit slides" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".lay--editor-surface")).toBeVisible();
  return dialog;
};

/**
 * Picks the seeded video out of an already-open media picker.
 *
 * The disabled-class wait is not ceremony: the picker gates selectability on
 * the transcode being complete, so if a seed ever stopped reading as ready
 * these tests would hang here rather than quietly asserting nothing.
 */
const pickSeededVideo = async (page: Page) => {
  const card = page
    .locator(PICKER)
    .locator(".bp--media-card")
    .filter({ hasText: "dummyVideo.mp4" });

  await expect(card).toBeVisible();
  await expect(card).not.toHaveClass(/bp--media-card--disabled/);

  await card.click();
  await expect(page.locator(PICKER)).toBeHidden();
};

/** Adds a video ELEMENT through the toolbar, i.e. the addElement.ts path. */
const addVideoElement = async (page: Page, dialog: Locator) => {
  await dialog.getByRole("button", { name: "Add video" }).click();
  await expect(page.locator(PICKER)).toBeVisible();
  await pickSeededVideo(page);
};

/** Gives an existing element a video FILL, i.e. the FillSection path. */
const setVideoFill = async (
  page: Page,
  dialog: Locator,
  elementSelector: string,
) => {
  await dialog.locator(elementSelector).click();
  await dialog.getByLabel("Video", { exact: true }).click();
  await expect(page.locator(PICKER)).toBeVisible();
  await pickSeededVideo(page);
};

/**
 * The Playback toggle's current value, read off the pressed radio.
 *
 * ToggleGroup is type="single", so Radix renders items as role="radio" and
 * marks the active one with data-state="on". Reading the state is what makes
 * this a real assertion — locating the radio proves only that it is rendered.
 */
const playbackMode = async (dialog: Locator): Promise<string> => {
  const options = ["Loop", "Play once"];
  for (const label of options) {
    const radio = dialog.getByRole("radio", { name: label });
    if ((await radio.getAttribute("data-state")) === "on") return label;
  }
  throw new Error("no playback option is selected");
};

/**
 * Whether the mounted player is looping.
 *
 * `loop` is set from `forceLoop`, which only LoopPlayer passes — so this is the
 * renderer's own read of the stored mode, not a re-read of the inspector.
 */
const videoLoops = async (scope: Locator): Promise<boolean> => {
  const video = scope.locator("video").first();
  await expect(video).toBeAttached();
  return video.evaluate((el: HTMLVideoElement) => el.loop);
};

test.describe.serial("Layout insert defaults", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearOrganizationBySlug", { slug: ORG }),
        e2eCommand.serverCommand("clearUserByUsername", {
          username: USERNAME,
        }),
      ]),
  );

  test("a host with no overrides inserts the schema default, loop", async ({
    page,
    projectPage,
    e2eCommand,
  }) => {
    page.setDefaultTimeout(60000);
    await goToProject(page, e2eCommand);
    const dialog = await openBibleEditor(page, projectPage);
    await seedVideo(e2eCommand);

    // --- the fill path ------------------------------------------------------
    // Before the toolbar path, because an inserted video element is centred on
    // the stage and would sit on top of the element we need to click.
    await setVideoFill(page, dialog, BIBLE_BODY);
    expect(await playbackMode(dialog)).toBe("Loop");
    expect(await videoLoops(dialog.locator(BIBLE_BODY))).toBe(true);

    // --- the toolbar path ---------------------------------------------------
    // A separate call site from the fill path, and only one of the two was
    // wired up at first, so both are asserted.
    await addVideoElement(page, dialog);
    const added = dialog.locator(ADDED_VIDEO);
    await expect(added).toBeVisible();

    expect(await playbackMode(dialog)).toBe("Loop");
    expect(await videoLoops(added)).toBe(true);
  });

  test("the slides editor overrides the default to play once", async ({
    page,
    projectPage,
    e2eCommand,
  }) => {
    page.setDefaultTimeout(60000);
    await goToProject(page, e2eCommand);
    const dialog = await openSlidesEditor(page, projectPage);
    await seedVideo(e2eCommand);

    // --- the fill path ------------------------------------------------------
    // The starter deck's body text, given a video background from the
    // inspector. First, for the same overlap reason as the Bible test.
    await setVideoFill(page, dialog, SLIDES_BODY);
    expect(await playbackMode(dialog)).toBe("Play once");
    expect(await videoLoops(dialog.locator(SLIDES_BODY))).toBe(false);

    // --- the toolbar path ---------------------------------------------------
    await addVideoElement(page, dialog);
    const added = dialog.locator(ADDED_VIDEO);
    await expect(added).toBeVisible();

    expect(await playbackMode(dialog)).toBe("Play once");
    // The override is only worth anything if it changes behaviour: a one-shot
    // video must NOT loop, which is the property the presenter actually feels.
    expect(await videoLoops(added)).toBe(false);
  });
});
