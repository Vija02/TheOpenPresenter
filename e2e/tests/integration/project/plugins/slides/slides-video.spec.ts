import type { Locator, Page } from "@playwright/test";

import { expect, test } from "../../../../../fixtures/projectFixture";
import {
  LABEL_ELEMENT_ID,
  VIDEO_ELEMENT_ID,
  buildVideoSlidesScene,
  seedVideo,
} from "../../../../../helpers/videoSlidesSeed";

/**
 * Video playback for layout-backed slides.
 *
 * The subject is the activation pipeline in `@repo/layout` plus the slides
 * plugin's `slideActivation`: landing on a slide must write
 * `_layoutVideoStates` and `lastClickTimestamp` as one act, and the renderer
 * must turn that into a video that actually plays from the start. The remote's
 * scaffold fader scales it, and the editor canvas must stay silent.
 *
 * Everything here seeds the deck with NO `_layoutVideoStates`, so a video only
 * plays if an activation genuinely produced the state. A fixture that shipped
 * the state pre-built would let all of this pass with the activation deleted.
 */

/**
 * Worker-scoped fixture names.
 *
 * `clearTestOrganizations` deletes every org whose slug starts with `test`, so
 * a shared `testorg` means two parallel workers delete each other's data
 * mid-test. Tagging by worker keeps each one in its own org, and cleanup is
 * scoped to that slug rather than the global wipe.
 */
const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG = `testorg-video-${WORKER_TAG}`;
const PROJECT = "video-source-project";
const USERNAME = `testuser_video_${WORKER_TAG}`;

/** The <video> react-player mounts inside a fill. */
const fillVideo = (scope: Page | Locator) =>
  scope.locator(`[data-lay-id="${VIDEO_ELEMENT_ID}"] video`).first();

/**
 * The <video> for a given slide in the renderer.
 *
 * The renderer mounts EVERY slide at once and hides the inactive ones with
 * opacity, so `video.first()` is always slide 1's element no matter what is on
 * screen. Indexing is therefore mandatory: a test that used `.first()` after
 * moving to slide 2 would silently keep watching slide 1 and conclude the new
 * slide never played.
 */
const rendererVideo = (scope: Page | Locator, slideIndex = 0) =>
  scope.locator("video").nth(slideIndex);

const currentTime = (video: Locator) =>
  video.evaluate((el: HTMLVideoElement) => el.currentTime);

/** Waits for a video to be genuinely progressing, not merely mounted. */
const expectPlaying = async (video: Locator) => {
  // `toBeAttached`, not `toBeVisible`: a <video> is laid out by react-player
  // inside a fill layer and can report a zero-sized box while still decoding.
  // Progress of `currentTime` is the signal that actually matters here.
  await expect(video).toBeAttached();
  await expect
    .poll(() => currentTime(video), { timeout: 30000 })
    .toBeGreaterThan(0);
};

const seedDeck = async (
  e2eCommand: any,
  slides: { playback: "loop" | "once"; label: string }[],
) => {
  // Ordering: media hangs off an organization, so the org has to exist before
  // `seedVideoMedia` can attach to it — but the scene must reference a media
  // name that only exists after seeding. Log in to create the org, seed the
  // video, then write the scenes into the project that is already there.
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

  const video = await seedVideo(e2eCommand, ORG);

  await e2eCommand.seedProjectScenes({
    orgSlug: ORG,
    projectSlug: PROJECT,
    scenes: [buildVideoSlidesScene(video, slides)],
  });

  return video;
};

test.describe.serial("Slides video playback", () => {
  test.setTimeout(60000);

  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearOrganizationBySlug", { slug: ORG }),
        e2eCommand.serverCommand("clearUserByUsername", {
          username: USERNAME,
        }),
      ]),
  );

  test("a one-shot video only starts once its slide is activated", async ({
    page,
    e2eCommand,
  }) => {
    await seedDeck(e2eCommand, [
      { playback: "once", label: "Slide one" },
      { playback: "once", label: "Slide two" },
    ]);

    // The renderer is where playback happens; the remote only ever shows
    // posters. Opened BEFORE any activation so the negative half is real.
    const renderer = await page.context().newPage();
    try {
      await renderer.goto(`/render/${ORG}/${PROJECT}`);

      // Nothing has been activated, so `_layoutVideoStates` is absent and
      // `activeSince` is null. A `once` fill with no anchor must sit still.
      // This is the assertion that would fail if the renderer defaulted to
      // playing, which would make every later "it plays" check vacuous.
      const idle = rendererVideo(renderer);
      await expect(idle).toBeAttached();
      await renderer.waitForTimeout(2000);
      expect(await currentTime(idle)).toBe(0);

      // Activate slide 1 from the remote.
      await page.goto(`/app/${ORG}/${PROJECT}`);
      await page.getByTestId("slide-container").first().click();

      await expectPlaying(rendererVideo(renderer));
    } finally {
      await renderer.close();
    }
  });

  test("moving to another slide restarts that slide's video from zero", async ({
    page,
    e2eCommand,
  }) => {
    await seedDeck(e2eCommand, [
      { playback: "once", label: "Slide one" },
      { playback: "once", label: "Slide two" },
    ]);

    const renderer = await page.context().newPage();
    try {
      await renderer.goto(`/render/${ORG}/${PROJECT}`);
      await expect(renderer.locator("video")).toHaveCount(2);
      await page.goto(`/app/${ORG}/${PROJECT}`);

      // Slide 1, and let it get well into the clip.
      await page.getByTestId("slide-container").first().click();
      await expectPlaying(rendererVideo(renderer));
      await expect
        .poll(() => currentTime(rendererVideo(renderer)), { timeout: 30000 })
        .toBeGreaterThan(1.5);

      // Slide 2. Its video is a different PLACEMENT of the same file, so its
      // key differs and reconciliation mints a fresh uid + startedAt, while
      // slide 1's entry is dropped entirely.
      await page.getByTestId("slide-container").nth(1).click();

      // Slide 2's own element, which has never played before, so any progress
      // at all is proof the activation reached it.
      await expectPlaying(rendererVideo(renderer, 1));

      // ...and slide 1 was stood down rather than left running behind the
      // scenes. `reconcileVideoStates` rebuilds the map from scratch precisely
      // so entries for slides left behind cannot linger.
      await expect
        .poll(() =>
          rendererVideo(renderer, 0).evaluate(
            (el: HTMLVideoElement) => el.paused,
          ),
        )
        .toBe(true);
    } finally {
      await renderer.close();
    }
  });

  test("re-activating the same slide replays it from the start", async ({
    page,
    e2eCommand,
  }) => {
    await seedDeck(e2eCommand, [{ playback: "once", label: "Only slide" }]);

    const renderer = await page.context().newPage();
    try {
      await renderer.goto(`/render/${ORG}/${PROJECT}`);
      await page.goto(`/app/${ORG}/${PROJECT}`);

      const card = page.getByTestId("slide-container").first();
      await card.click();
      await expectPlaying(rendererVideo(renderer));
      await expect
        .poll(() => currentTime(rendererVideo(renderer)), { timeout: 30000 })
        .toBeGreaterThan(1.5);

      // Clicking the SAME slide again is still an activation: the reconciler
      // mints a new uid from a new `now`, which is what tells the player to
      // seek back rather than ignore an unchanged state object.
      await card.click();

      await expect
        .poll(() => currentTime(rendererVideo(renderer)), { timeout: 30000 })
        .toBeLessThan(1.0);
    } finally {
      await renderer.close();
    }
  });

  test("arrow keys activate video the same way a click does", async ({
    page,
    e2eCommand,
  }) => {
    await seedDeck(e2eCommand, [
      { playback: "once", label: "Slide one" },
      { playback: "once", label: "Slide two" },
    ]);

    const renderer = await page.context().newPage();
    try {
      await renderer.goto(`/render/${ORG}/${PROJECT}`);
      // Both slides mount up front (inactive ones are hidden with opacity), so
      // wait for the full set before indexing into it — the deck streams in
      // over the websocket and a bare `.nth(1)` can look at a one-video DOM.
      await expect(renderer.locator("video")).toHaveCount(2);

      await page.goto(`/app/${ORG}/${PROJECT}`);

      // The key-press handler runs on the SERVER against a raw Y.Map, a
      // completely separate adapter from the remote's valtio path. Both go
      // through `activateSlide`, and this is the only test that covers the
      // Yjs one — the click tests above would pass with it broken.
      //
      // Pressed on the RENDERER, which is where a presenter's remote clicker
      // actually sends its arrows; the remote listens too but only once focus
      // is off a control that would swallow the key.
      await renderer.click("body");
      await renderer.keyboard.press("ArrowRight");

      // Index 1, not 0: the handler reads `currentSlideIndex ?? 0`, so from an
      // unset position NEXT advances off slide 0 and lands on the second slide.
      await expectPlaying(rendererVideo(renderer, 1));
    } finally {
      await renderer.close();
    }
  });

  test("a looping background plays muted and needs no activation", async ({
    page,
    e2eCommand,
  }) => {
    await seedDeck(e2eCommand, [{ playback: "loop", label: "Ambient" }]);

    const renderer = await page.context().newPage();
    try {
      await renderer.goto(`/render/${ORG}/${PROJECT}`);

      // A `loop` fill is ambient decoration: LoopPlayer hardcodes its own
      // playback state, so it runs with no activation at all — the opposite of
      // the `once` case in the first test.
      const video = rendererVideo(renderer);
      await expectPlaying(video);

      // Permanently silent, by construction. This is why the deck offers no
      // fader for a loop-only deck: there would be nothing to turn down.
      await expect(video).toHaveJSProperty("muted", true);
      await expect(video).toHaveJSProperty("loop", true);
    } finally {
      await renderer.close();
    }
  });
});

test.describe.serial("Slides video volume", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearOrganizationBySlug", { slug: ORG }),
        e2eCommand.serverCommand("clearUserByUsername", {
          username: USERNAME,
        }),
      ]),
  );

  /** The scaffold's automatic fader. */
  const fader = (page: Page) => page.locator(".ui--volume-bar");

  test("the fader appears only once an activation has seeded video state", async ({
    page,
    e2eCommand,
  }) => {
    await seedDeck(e2eCommand, [{ playback: "once", label: "Only slide" }]);
    await page.goto(`/app/${ORG}/${PROJECT}`);

    // PluginScaffold renders the fader off the presence of
    // `_layoutVideoStates`, which nothing has written yet. A control that
    // adjusts nothing is worse than no control.
    await expect(page.getByTestId("slide-container").first()).toBeVisible();
    await expect(fader(page)).toHaveCount(0);

    // Activating writes the state, and the fader follows automatically — no
    // plugin code asked for it.
    await page.getByTestId("slide-container").first().click();
    await expect(fader(page)).toHaveCount(1);
  });

  test("a loop-only deck never shows the fader", async ({
    page,
    e2eCommand,
  }) => {
    await seedDeck(e2eCommand, [{ playback: "loop", label: "Ambient" }]);
    await page.goto(`/app/${ORG}/${PROJECT}`);

    // Activate, which for a loop-only slide reconciles to an EMPTY state map.
    await page.getByTestId("slide-container").first().click();

    // Still no fader: looping backgrounds are muted by design, so the deck has
    // nothing audible to scale. Guards the `audibleVideoElements` filter.
    await expect(page.getByTestId("slide-container").first()).toBeVisible();
    await expect(fader(page)).toHaveCount(0);
  });

  test("dragging the fader to zero silences the renderer", async ({
    page,
    e2eCommand,
  }) => {
    await seedDeck(e2eCommand, [{ playback: "once", label: "Only slide" }]);

    const renderer = await page.context().newPage();
    try {
      await renderer.goto(`/render/${ORG}/${PROJECT}`);
      await page.goto(`/app/${ORG}/${PROJECT}`);
      await page.getByTestId("slide-container").first().click();

      const video = rendererVideo(renderer);
      await expectPlaying(video);

      // Full output to begin with. The clip's own volume is 1 and the fader
      // defaults to 1, so the product reaching the element is 1.
      await expect(video).toHaveJSProperty("volume", 1);

      // The bar is a vertical slider; keyboard is far more reliable than
      // computing a drop position inside it.
      const slider = page.locator(".ui--volume-bar-thumb");
      await expect(slider).toBeVisible();
      await slider.click();
      await page.keyboard.press("Home");

      // The volume key scales every fill in the scene, so the element's own
      // volume follows it down. `muted` flips too, because VideoFill treats a
      // zero product as muted — which is what actually stops audio under
      // browser autoplay rules.
      await expect(video).toHaveJSProperty("volume", 0);
      await expect(video).toHaveJSProperty("muted", true);

      // ...and it is still playing. Silencing must not pause the clip, or the
      // slide's timing would drift from everyone else's.
      await expect
        .poll(() => currentTime(video), { timeout: 30000 })
        .toBeGreaterThan(0);
    } finally {
      await renderer.close();
    }
  });

  test("the chosen level survives moving to another slide", async ({
    page,
    e2eCommand,
  }) => {
    await seedDeck(e2eCommand, [
      { playback: "once", label: "Slide one" },
      { playback: "once", label: "Slide two" },
    ]);

    await page.goto(`/app/${ORG}/${PROJECT}`);
    await page.getByTestId("slide-container").first().click();
    await expect(fader(page)).toHaveCount(1);

    const slider = page.locator(".ui--volume-bar-thumb");
    await slider.click();
    await page.keyboard.press("Home");
    // Radix puts the value on the THUMB, not the slider root.
    await expect(slider).toHaveAttribute("aria-valuenow", "0");

    // Moving on reconciles the video state from scratch. The LEVEL must not be
    // part of that reset: it lives under its own key precisely so it is the
    // operator's setting for the scene, not per-clip state.
    await page.getByTestId("slide-container").nth(1).click();

    await expect(fader(page)).toHaveCount(1);
    await expect(page.locator(".ui--volume-bar-thumb")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });
});

test.describe.serial("Slides video in the editor", () => {
  test.setTimeout(60000);

  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearOrganizationBySlug", { slug: ORG }),
        e2eCommand.serverCommand("clearUserByUsername", {
          username: USERNAME,
        }),
      ]),
  );

  const openEditor = async (page: Page) => {
    await page.goto(`/app/${ORG}/${PROJECT}`);
    // Hover reveals the per-slide edit affordance on a custom slide.
    const card = page.getByTestId("slide-container").first();
    await card.hover();
    await card.getByRole("button", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog", { name: "Edit slides" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".lay--editor-surface")).toBeVisible();
    return dialog;
  };

  test("the canvas plays the video but starts muted", async ({
    page,
    e2eCommand,
  }) => {
    await seedDeck(e2eCommand, [{ playback: "once", label: "Only slide" }]);
    const dialog = await openEditor(page);

    // The canvas plays so you can frame the shot — LayoutDocEditor stamps its
    // own `activeSince`, independent of any activation.
    const video = fillVideo(dialog);
    await expectPlaying(video);

    // ...but silently. Mirrors the preview window, which mutes its renderer at
    // the host level. An editor that blares audio on open is never wanted.
    await expect(video).toHaveJSProperty("muted", true);
    await expect(video).toHaveJSProperty("volume", 0);
  });

  test("the canvas mute toggle turns audio on and back off", async ({
    page,
    e2eCommand,
  }) => {
    await seedDeck(e2eCommand, [{ playback: "once", label: "Only slide" }]);
    const dialog = await openEditor(page);

    const video = fillVideo(dialog);
    await expectPlaying(video);

    // Offered because the slide has an audible (`once`) fill.
    const toggle = dialog.getByRole("button", { name: "Unmute preview" });
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(video).toHaveJSProperty("volume", 1);
    await expect(video).toHaveJSProperty("muted", false);

    // The label flips with the state, so the control says what it will do next.
    const muteAgain = dialog.getByRole("button", { name: "Mute preview" });
    await expect(muteAgain).toBeVisible();

    await muteAgain.click();
    await expect(video).toHaveJSProperty("volume", 0);
    await expect(video).toHaveJSProperty("muted", true);
  });

  test("no mute toggle is offered for a silent looping fill", async ({
    page,
    e2eCommand,
  }) => {
    await seedDeck(e2eCommand, [{ playback: "loop", label: "Ambient" }]);
    const dialog = await openEditor(page);

    // Prove the editor really opened on a slide WITH video, so the absence
    // below is evidence of the gate rather than of an empty canvas.
    await expect(fillVideo(dialog)).toBeAttached();

    // LoopPlayer is permanently muted, so a toggle would be a dead control.
    await expect(
      dialog.getByRole("button", { name: /(Unmute|Mute) preview/ }),
    ).toHaveCount(0);
  });

  test("switching a fill to one-shot brings the toggle in", async ({
    page,
    e2eCommand,
  }) => {
    await seedDeck(e2eCommand, [{ playback: "loop", label: "Ambient" }]);
    const dialog = await openEditor(page);

    await expect(
      dialog.getByRole("button", { name: /(Unmute|Mute) preview/ }),
    ).toHaveCount(0);

    // Wait for the fill to actually mount before hunting for its wrapper: the
    // canvas paints the slide asynchronously and a click on a zero-sized
    // wrapper retries until the test times out.
    await expect(fillVideo(dialog)).toBeAttached();

    // Select the video element and flip Playback in the inspector. Clicked
    // near the top-left corner: the video is full-bleed and the caption sits
    // over its middle, so a centre click would select the text instead.
    await dialog
      .locator(`[data-lay-id="${VIDEO_ELEMENT_ID}"]`)
      .click({ position: { x: 8, y: 8 } });
    // Playback is a ToggleGroup, not a select. Its items render as radios
    // (type="single"), so match the option's label the way the layout editor
    // spec does rather than assuming a <select>.
    await dialog.getByLabel("Play once", { exact: true }).click();

    // The gate is derived from the doc, so editing the doc updates it live —
    // no reopen needed.
    await expect(
      dialog.getByRole("button", { name: "Unmute preview" }),
    ).toBeVisible();
  });

  test("the label element is still editable over a video fill", async ({
    page,
    e2eCommand,
  }) => {
    await seedDeck(e2eCommand, [{ playback: "once", label: "Only slide" }]);
    const dialog = await openEditor(page);

    // Regression guard for the mute button's `stopPropagation`: the canvas
    // clears the selection on any pointer-down outside `.lay--editor`, and the
    // toggle sits inside the canvas. Clicking it must not fight selection.
    const label = dialog.locator(`[data-lay-id="${LABEL_ELEMENT_ID}"]`);
    await label.click();
    await expect(label).toHaveClass(/lay--editor-item--selected/);

    await dialog.getByRole("button", { name: "Unmute preview" }).click();

    // Still selected: the toggle swallowed its own pointer-down.
    await expect(label).toHaveClass(/lay--editor-item--selected/);
  });
});
