import type { Locator } from "@playwright/test";

import { expect, test } from "../../../../../fixtures/projectFixture";

/**
 * The musician view: the full song with chords, following the live slide,
 * with each viewer free to look ahead at another song.
 */

const CHORDED_SONG = `[Verse 1]
[D]All the saints and [E]angels
They b[D]ow before Your [E]throne
-
[D]All the elders [E]cast
their c[A]rowns before the [D]Lamb

[Chorus]
You are worthy of it a[A]ll`;

/** Too long for one column on a laptop screen, short enough for two */
const LONG_SONG = Array.from(
  { length: 4 },
  (_, i) => `[Verse ${i + 1}]
[G]Line one of verse ${i + 1} [C]goes here
[G]Line two of verse ${i + 1} [D]goes here
-
[Em]Line three of verse ${i + 1} [C]goes here
[G]Line four of verse ${i + 1} [D]goes here`,
).join("\n\n");

/** Chords on dot lines above the lyrics, positioned by column */
const OPENSONG_SONG = `[Verse 1]
.G                 C
Amazing grace how sweet the sound
.G                   D
That saved a wretch like me`;

const PLAIN_SONG = `[Verse 1]
Amazing grace how sweet the sound
That saved a wretch like me`;

test.describe("Lyrics Presenter - Musician view", () => {
  test.beforeEach(async ({ e2eCommand }) => await e2eCommand.clearWorkerData());

  test("follows the live slide, and looks ahead without changing the screen", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    page.setDefaultTimeout(60000);
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("All the Saints", CHORDED_SONG);
    await lyricsPlugin.addCustomSong("Amazing Grace", PLAIN_SONG);

    // The first song's first slide goes live
    await page.getByTestId("slide-container").nth(0).click();
    // Before the view covers the project's Present button
    const output = await projectPage.present();

    const view = await lyricsPlugin.openMusicianView();
    await expect(lyricsPlugin.musicianSong(view)).toHaveText(/All the Saints/);

    // Chords over the lyrics, the live slide picked out
    await expect(view.getByTestId("ly-musician-chord").first()).toHaveText("D");
    const live = lyricsPlugin.musicianLiveSlide(view);
    await expect(live).toHaveCount(1);
    await expect(live).toContainText("All the saints and");
    await expect(
      view.locator('[data-testid="ly-musician-heading"][data-live="true"]'),
    ).toHaveText("Verse 1");

    // The operator moves on, from the output
    await output.click("body");
    await output.keyboard.press("ArrowRight");
    await expect(live).toContainText("All the elders");

    // Looking ahead only changes this view
    await view
      .getByTestId("ly-musician-song")
      .selectOption({ label: "Amazing Grace" });
    await expect(lyricsPlugin.musicianSong(view)).toHaveText("Amazing Grace");
    await expect(view.getByTestId("ly-musician-follow")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(live).toHaveCount(0);
    // A song without chords has none to show or hide
    await expect(view.getByTestId("ly-musician-chord")).toHaveCount(0);
    await expect(view.getByTestId("ly-musician-key")).toBeDisabled();
    const settings = await lyricsPlugin.openMusicianSettings(view);
    await expect(settings.getByTestId("ly-musician-chords")).toBeDisabled();
    // Escape closes the panel, not the view
    await page.keyboard.press("Escape");
    await expect(settings).toBeHidden();
    await expect(view).toBeVisible();
    // The screen still shows the first song
    await expect(output.locator(".lay--text-content").first()).toContainText(
      "All the elders",
    );

    // Back to what's live
    await view.getByTestId("ly-musician-follow").click();
    await expect(lyricsPlugin.musicianSong(view)).toHaveText(/All the Saints/);
    await expect(live).toContainText("All the elders");
    await expect(view.getByTestId("ly-musician-follow")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Pressed again, it stops following but stays on the song
    await view.getByTestId("ly-musician-follow").click();
    await expect(view.getByTestId("ly-musician-follow")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(lyricsPlugin.musicianSong(view)).toHaveText(/All the Saints/);

    await page.keyboard.press("Escape");
    await expect(view).toBeHidden();
  });

  test("hides chords on request, and remembers it on this device", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("All the Saints", CHORDED_SONG);
    await page.getByTestId("slide-container").nth(0).click();

    let view = await lyricsPlugin.openMusicianView();
    await expect(view.getByTestId("ly-musician-chord").first()).toBeVisible();

    let settings = await lyricsPlugin.openMusicianSettings(view);
    await settings.getByTestId("ly-musician-chords").click();
    await page.keyboard.press("Escape");
    await expect(view.getByTestId("ly-musician-chord")).toHaveCount(0);
    // The lyrics stay whole where a chord split a word
    await expect(lyricsPlugin.musicianLiveSlide(view)).toContainText(
      "They bow before Your throne",
    );

    await view.getByRole("button", { name: "Close musician view" }).click();
    view = await lyricsPlugin.openMusicianView();
    await expect(view.getByTestId("ly-musician-chord")).toHaveCount(0);
    settings = await lyricsPlugin.openMusicianSettings(view);
    await expect(settings.getByTestId("ly-musician-chords")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("transposes on this device only", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("All the Saints", CHORDED_SONG);
    await page.getByTestId("slide-container").nth(0).click();

    let view = await lyricsPlugin.openMusicianView();
    const chords = view.getByTestId("ly-musician-chord");
    const key = (v: typeof view) =>
      v.getByTestId("ly-musician-key").locator("option:checked");
    await expect(key(view)).toHaveText("D (original)");
    await expect(chords.first()).toHaveText("D");

    await view.getByTestId("ly-musician-key").selectOption("2");
    await expect(key(view)).toHaveText("E (+2)");
    await expect(chords.first()).toHaveText("E");
    await expect(chords.nth(1)).toHaveText("F#");

    // Remembered on this device
    await view.getByRole("button", { name: "Close musician view" }).click();
    view = await lyricsPlugin.openMusicianView();
    await expect(key(view)).toHaveText("E (+2)");

    // Back to as written
    await view.getByTestId("ly-musician-key").selectOption("0");
    await expect(key(view)).toHaveText("D (original)");
    await expect(view.getByTestId("ly-musician-chord").first()).toHaveText("D");
  });

  test("spreads a long song over columns only when it then fits", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await page.setViewportSize({ width: 1400, height: 800 });

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("All the Saints", CHORDED_SONG);
    await lyricsPlugin.addCustomSong("Long Song", LONG_SONG);
    await page.getByTestId("slide-container").nth(0).click();

    const view = await lyricsPlugin.openMusicianView();
    await lyricsPlugin.setMusicianFit(view, false);
    const columns = view.getByTestId("ly-musician-columns");
    // Larger by default away from a phone
    await expect(columns).toHaveCSS("font-size", "22px");

    // Fits as it is
    await expect(columns).toHaveAttribute("data-columns", "1");

    await view
      .getByTestId("ly-musician-song")
      .selectOption({ label: "Long Song" });
    await expect(columns).not.toHaveAttribute("data-columns", "1");
    // The whole song is on screen
    const chart = view.getByTestId("ly-musician-chart");
    expect(
      await chart.evaluate((el) => el.scrollHeight <= el.clientHeight),
    ).toBe(true);

    // No room for a second column on a phone
    await page.setViewportSize({ width: 500, height: 800 });
    await expect(columns).toHaveAttribute("data-columns", "1");
  });

  test("moves through the songs from the bottom, showing what's next", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("All the Saints", CHORDED_SONG);
    await lyricsPlugin.addCustomSong("Long Song", LONG_SONG);
    await page.getByTestId("slide-container").nth(0).click();
    await page.setViewportSize({ width: 390, height: 844 });

    const view = await lyricsPlugin.openMusicianView();
    // A phone scrolls by default, at a smaller size
    await expect(view.getByTestId("ly-musician-chart")).toHaveAttribute(
      "data-fit",
      "false",
    );
    await expect(view.getByTestId("ly-musician-columns")).toHaveCSS(
      "font-size",
      "16px",
    );

    const preview = view.getByTestId("ly-musician-next-preview");
    await expect(preview).toContainText("Long Song");
    await expect(view.getByTestId("ly-musician-next-key")).toHaveText("Key G");
    await expect(view.getByTestId("ly-musician-previous")).toBeHidden();

    await view.getByTestId("ly-musician-next").click();
    await expect(lyricsPlugin.musicianSong(view)).toHaveText("Long Song");
    await expect(view.getByTestId("ly-musician-follow")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(preview).toHaveText("");
    await expect(view.getByTestId("ly-musician-last-song")).toBeVisible();
    await expect(view.getByTestId("ly-musician-next")).toBeDisabled();

    // Back to the live song, which follows it again
    await view.getByTestId("ly-musician-previous").click();
    await expect(lyricsPlugin.musicianSong(view)).toHaveText(/All the Saints/);
    await expect(view.getByTestId("ly-musician-follow")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("fits the whole song on screen, as large as it goes", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await page.setViewportSize({ width: 1400, height: 800 });

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Long Song", LONG_SONG);
    await page.getByTestId("slide-container").nth(0).click();

    const view = await lyricsPlugin.openMusicianView();
    // On by default, with size and scrolling hidden
    const settings = await lyricsPlugin.openMusicianSettings(view);
    await expect(settings.getByTestId("ly-musician-autofit")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(settings.getByTestId("ly-musician-font-size")).toBeHidden();
    await expect(settings.getByTestId("ly-musician-autoscroll")).toBeHidden();
    await page.keyboard.press("Escape");

    const chart = view.getByTestId("ly-musician-chart");
    const columns = view.getByTestId("ly-musician-columns");
    await expect(chart).toHaveAttribute("data-fit", "true");
    const fits = () =>
      chart.evaluate(
        (el) =>
          el.scrollHeight <= el.clientHeight &&
          el.scrollWidth <= el.clientWidth,
      );

    // Spread out, larger than the 22px it would scroll at
    await expect.poll(fits).toBe(true);
    await expect
      .poll(async () => Number(await columns.getAttribute("data-columns")))
      .toBeGreaterThan(1);
    expect(
      Number(await columns.getAttribute("data-font-size")),
    ).toBeGreaterThan(22);
    // Still follows the live slide
    await expect(lyricsPlugin.musicianLiveSlide(view)).toContainText(
      "Line one of verse 1",
    );

    // Refits to a new screen
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect.poll(fits).toBe(true);
  });

  test("gives one song its own style", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("All the Saints", CHORDED_SONG);
    await lyricsPlugin.addCustomSong("Long Song", LONG_SONG);
    await page.getByTestId("slide-container").nth(0).click();

    const view = await lyricsPlugin.openMusicianView();
    const chart = view.getByTestId("ly-musician-chart");
    const scope = (panel: Locator) =>
      panel.getByTestId("ly-musician-style-scope");

    // All the Saints scrolls at 30px, on its own
    let settings = await lyricsPlugin.openMusicianSettings(view);
    await expect(
      scope(settings).getByRole("radio", { name: "All songs" }),
    ).toHaveAttribute("data-state", "on");
    await scope(settings).getByRole("radio", { name: "This song" }).click();
    await settings.getByTestId("ly-musician-autofit").click();
    for (let i = 0; i < 4; i++) {
      await settings.getByRole("button", { name: "Larger text" }).click();
    }
    await expect(settings.getByTestId("ly-musician-font-size")).toHaveText(
      "30",
    );
    await page.keyboard.press("Escape");
    await expect(chart).toHaveAttribute("data-fit", "false");

    // Every other song still fits
    await view.getByTestId("ly-musician-next").click();
    await expect(chart).toHaveAttribute("data-fit", "true");
    settings = await lyricsPlugin.openMusicianSettings(view);
    await expect(
      scope(settings).getByRole("radio", { name: "All songs" }),
    ).toHaveAttribute("data-state", "on");
    await page.keyboard.press("Escape");

    // Still its own; then back to the all-songs style
    await view.getByTestId("ly-musician-previous").click();
    await expect(chart).toHaveAttribute("data-fit", "false");
    await expect(view.getByTestId("ly-musician-columns")).toHaveCSS(
      "font-size",
      "30px",
    );
    settings = await lyricsPlugin.openMusicianSettings(view);
    await scope(settings).getByRole("radio", { name: "All songs" }).click();
    await page.keyboard.press("Escape");
    await expect(chart).toHaveAttribute("data-fit", "true");
  });

  test("follows again when the song gone ahead to goes live", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("All the Saints", CHORDED_SONG);
    await lyricsPlugin.addCustomSong("Amazing Grace", PLAIN_SONG);
    const slides = page.getByTestId("slide-container");
    await slides.nth(0).click();

    const view = await lyricsPlugin.openMusicianView();
    const follow = view.getByTestId("ly-musician-follow");
    // The operator, on the page under the view: dispatched, as it's covered
    const goLive = (slide: number) => slides.nth(slide).dispatchEvent("click");

    // Ahead to the next song, before the operator
    await view.getByTestId("ly-musician-next").click();
    await expect(follow).toHaveAttribute("aria-pressed", "false");

    // All the Saints has 3 slides, so Amazing Grace starts at the 4th
    await goLive(3);
    await expect(follow).toHaveAttribute("aria-pressed", "true");
    await expect(lyricsPlugin.musicianLiveSlide(view)).toContainText(
      "Amazing grace",
    );

    // Off, it stays where it is
    const settings = await lyricsPlugin.openMusicianSettings(view);
    await settings.getByTestId("ly-musician-autofollow").click();
    await page.keyboard.press("Escape");
    await view.getByTestId("ly-musician-previous").click();
    await expect(follow).toHaveAttribute("aria-pressed", "false");
    await goLive(0);
    await expect(lyricsPlugin.musicianLiveSlide(view)).toContainText(
      "All the saints and",
    );
    await expect(follow).toHaveAttribute("aria-pressed", "false");
  });

  test("shows OpenSong chords too", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", OPENSONG_SONG);
    await page.getByTestId("slide-container").nth(0).click();

    const view = await lyricsPlugin.openMusicianView();
    const chords = view.getByTestId("ly-musician-chord");
    await expect(chords).toHaveText(["G", "C", "G", "D"]);
    await expect(lyricsPlugin.musicianLiveSlide(view)).toContainText(
      // The chords sit between the words in the text
      "Amazing grace how",
    );
  });

  test("without follow visual, it's a songbook the musician moves through", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("All the Saints", CHORDED_SONG);
    await lyricsPlugin.addCustomSong("Amazing Grace", PLAIN_SONG);
    const slides = page.getByTestId("slide-container");
    await slides.nth(0).click();

    const view = await lyricsPlugin.openMusicianView();
    await expect(lyricsPlugin.musicianLiveSlide(view)).toHaveCount(1);

    const settings = await lyricsPlugin.openMusicianSettings(view);
    await expect(settings.getByTestId("ly-musician-autofollow")).toBeVisible();
    await settings.getByTestId("ly-musician-follow-visual").click();
    // Refollowing has nothing to do without following
    await expect(settings.getByTestId("ly-musician-autofollow")).toBeHidden();
    await page.keyboard.press("Escape");

    // Nothing picked out, and no Follow
    await expect(lyricsPlugin.musicianLiveSlide(view)).toHaveCount(0);
    await expect(
      view.locator('[data-testid="ly-musician-heading"][data-live="true"]'),
    ).toHaveCount(0);
    await expect(view.getByTestId("ly-musician-follow")).toBeHidden();

    // The operator moves on; the view stays where it is
    await slides.nth(3).dispatchEvent("click");
    // Live now, as the song list shows
    await expect(
      view.getByTestId("ly-musician-song").locator("option", {
        hasText: "● Amazing Grace",
      }),
    ).toHaveCount(1);
    await expect(lyricsPlugin.musicianSong(view)).toHaveText("All the Saints");
  });

  test("starts another song at its top", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Long Song", LONG_SONG);
    await lyricsPlugin.addCustomSong("Another Long Song", LONG_SONG);
    await page.getByTestId("slide-container").nth(0).click();
    // A phone, which scrolls
    await page.setViewportSize({ width: 390, height: 844 });

    const view = await lyricsPlugin.openMusicianView();
    const chart = view.getByTestId("ly-musician-chart");
    await expect(chart).toHaveAttribute("data-fit", "false");
    const scrollTop = () => chart.evaluate((el) => el.scrollTop);

    await chart.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect.poll(scrollTop).toBeGreaterThan(0);

    await view.getByTestId("ly-musician-next").click();
    await expect(lyricsPlugin.musicianSong(view)).toHaveText(
      "Another Long Song",
    );
    await expect.poll(scrollTop).toBe(0);
  });
});
