import { expect, test } from "../../../../../fixtures/projectFixture";

const TEST_SONG_CONTENT = `[Verse 1]
Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now am found
Was blind but now I see

[Verse 2]
Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed

[Chorus]
My chains are gone I've been set free
My God my Savior has ransomed me
And like a flood His mercy reigns
Unending love amazing grace`;

test.describe("Lyrics Presenter Plugin - Visual Regression", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("renders lyrics with various style combinations", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", TEST_SONG_CONTENT);

    await expect(
      page.getByText("Amazing grace how sweet the").first(),
    ).toBeVisible();
    await expect(page.getByTestId("slide-container").first()).toBeVisible();

    await page.getByTestId("slide-container").nth(0).click();

    // Open presenter view
    const presentedPage = await projectPage.present();
    await presentedPage.waitForLoadState("networkidle");
    const lyrics = presentedPage.locator(".lay--text-content").first();
    const background = presentedPage.getByTestId("lyrics-background");

    // Screenshot 1: Default style (black background, white text, centered)
    await expect(presentedPage).toHaveScreenshot("01-default-style.png", {
      maxDiffPixelRatio: 0.05,
    });

    // Navigate to next slide and change text color + top aligned
    await presentedPage.click("body");
    await presentedPage.keyboard.press("ArrowRight");
    await presentedPage.waitForTimeout(300);

    let layout = await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setTextColor(layout, "#ffff00");
    await lyricsPlugin.setVerticalAlign(layout, "top");
    await lyricsPlugin.saveStyleSettings(layout);
    await expect(lyrics).toHaveCSS("color", "rgb(255, 255, 0)");

    // Screenshot 2: Yellow text, top aligned
    await expect(presentedPage).toHaveScreenshot("02-yellow-text-top.png", {
      maxDiffPixelRatio: 0.05,
    });

    // Navigate to chorus, bottom aligned, regular weight + italic
    await presentedPage.keyboard.press("ArrowRight");
    await presentedPage.waitForTimeout(300);

    layout = await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setVerticalAlign(layout, "bottom");
    await lyricsPlugin.setFontWeight(layout, 400);
    await lyricsPlugin.setFontStyle(layout, "italic");
    await lyricsPlugin.saveStyleSettings(layout);
    await expect(lyrics).toHaveCSS("font-weight", "400");
    await expect(lyrics).toHaveCSS("font-style", "italic");
    // The italic face only downloads once something uses it
    await presentedPage.evaluate(() => document.fonts.ready);

    // Screenshot 3: Yellow text, bottom aligned, regular weight, italic
    await expect(presentedPage).toHaveScreenshot(
      "03-yellow-bottom-regular-italic.png",
      {
        maxDiffPixelRatio: 0.05,
      },
    );

    // The background is its own layer, under the text
    const blackKey = await background.getAttribute("data-active-key");
    layout = await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setBackgroundColor(layout, "#1e3a8a");
    await lyricsPlugin.saveStyleSettings(layout);
    await expect(background).not.toHaveAttribute(
      "data-active-key",
      blackKey ?? "",
    );
    // The crossfade
    await presentedPage.waitForTimeout(400);

    // Screenshot 4: Blue background, yellow regular italic text
    await expect(presentedPage).toHaveScreenshot("04-blue-background.png", {
      maxDiffPixelRatio: 0.05,
    });

    // A fixed size the text shrinks from, rather than filling the box
    layout = await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setTextColor(layout, "#ffffff");
    await lyricsPlugin.setVerticalAlign(layout, "middle");
    await lyricsPlugin.setMaxFontSize(layout, 4);
    await lyricsPlugin.saveStyleSettings(layout);
    await expect(lyrics).toHaveCSS("color", "rgb(255, 255, 255)");

    // Screenshot 5: Small fixed size, centred, blue background
    await expect(presentedPage).toHaveScreenshot("05-fixed-size.png", {
      maxDiffPixelRatio: 0.05,
    });

    // A preset swaps the text layout but keeps the background
    layout = await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.useTemplate(layout, "Bottom");
    await lyricsPlugin.saveStyleSettings(layout);

    await presentedPage.waitForTimeout(200);

    // Screenshot 6: Bottom preset over the blue background
    await expect(presentedPage).toHaveScreenshot("06-bottom.png", {
      maxDiffPixelRatio: 0.05,
    });
  });

  test("a song's own look overrides the organization's until reset", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", TEST_SONG_CONTENT);
    await page.getByTestId("slide-container").nth(0).click();

    const presentedPage = await projectPage.present();
    const text = presentedPage
      .locator(".lay--text-content")
      .filter({ hasText: "Amazing grace" });
    await expect(text).toHaveCSS("color", "rgb(255, 255, 255)");

    let layout = await lyricsPlugin.openSongLayout();
    await lyricsPlugin.setTextColor(layout, "#ff0000");
    await lyricsPlugin.saveStyleSettings(layout);
    await expect(text).toHaveCSS("color", "rgb(255, 0, 0)");

    // The organization's look no longer reaches this song
    layout = await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setTextColor(layout, "#00ff00");
    await lyricsPlugin.saveStyleSettings(layout);
    await expect(text).toHaveCSS("color", "rgb(255, 0, 0)");

    layout = await lyricsPlugin.openSongLayout();
    await layout
      .getByRole("button", { name: "Reset to default", exact: true })
      .click();
    await lyricsPlugin.saveStyleSettings(layout);
    await expect(text).toHaveCSS("color", "rgb(0, 255, 0)");
  });

  test("clicking media sets the background, which is its own layer", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
    uppyUploadFile,
  }) => {
    page.setDefaultTimeout(60000);
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", TEST_SONG_CONTENT);
    await page.getByTestId("slide-container").nth(0).click();

    const layout = await lyricsPlugin.openStyleSettings();
    // Only the text is on the canvas. The background can't be selected
    await expect(layout.locator('[data-lay-id="lyrics-body"]')).toBeVisible();
    await expect(layout.locator('[data-lay-id="background"]')).toHaveCount(0);

    // Upload through the strip, then click the item: no dragging
    const strip = layout.getByTestId("layout-media-strip");
    await strip.getByRole("button", { name: "Browse" }).click();
    const picker = page.locator('[data-testid="media-picker-dialog"]');
    await expect(picker).toBeVisible();
    await uppyUploadFile("./dummyFiles/dummyImage.jpg");
    await expect(picker).toBeHidden({ timeout: 30000 });

    // The pick is the background, marked in the library
    const item = strip.getByTestId("layout-media-item").first();
    const none = strip.getByTestId("layout-media-none");
    await expect(item).toHaveAttribute("aria-pressed", "true");
    await expect(layout.locator(".lay--editor-underlay img")).toBeVisible();

    // The first card is None, then a click on the item brings it back
    await none.click();
    await expect(none).toHaveAttribute("aria-pressed", "true");
    await expect(layout.locator(".lay--editor-underlay")).toHaveCount(0);
    await item.click();
    await expect(item).toHaveAttribute("aria-pressed", "true");
    // Still nothing new on the canvas
    await expect(layout.locator("[data-lay-id]")).toHaveCount(1);

    // Loop or play once is only offered for videos
    await expect(layout.getByTestId("lyrics-background-playback")).toHaveCount(
      0,
    );

    // The Colour card switches straight away and opens its controls
    const colour = strip.getByTestId("layout-media-colour");
    await colour.click();
    await expect(colour).toHaveAttribute("aria-pressed", "true");
    await expect(item).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("layout-media-colour-panel")).toBeVisible();
    await colour.click();
    await item.click();

    // Filters narrow the library: the upload is a picture
    await strip.getByRole("tab", { name: "Videos" }).click();
    await expect(strip.getByTestId("layout-media-item")).toHaveCount(0);
    await strip.getByRole("tab", { name: "Pictures" }).click();
    await expect(strip.getByTestId("layout-media-item")).toHaveCount(1);

    await lyricsPlugin.saveStyleSettings(layout);

    const output = await projectPage.present();
    await expect(
      output.locator(
        '[data-testid="lyrics-background"] [data-active="true"] img',
      ),
    ).toBeVisible();
  });

  test("a video background loops, or plays once", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
    e2eCommand,
  }) => {
    page.setDefaultTimeout(60000);
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", TEST_SONG_CONTENT);
    await page.getByTestId("slide-container").nth(0).click();

    // Already transcoded, so no waiting on ffmpeg. After login, which makes the org
    await e2eCommand.seedVideoMedia({
      orgSlug: "testorg",
      videoPath: "./dummyFiles/dummyVideo.mp4",
      posterPath: "./dummyFiles/dummyImage.jpg",
      duration: 6.2,
    });

    let layout = await lyricsPlugin.openStyleSettings();
    const strip = layout.getByTestId("layout-media-strip");
    await strip.getByRole("tab", { name: "Videos" }).click();
    const item = strip.getByTestId("layout-media-item").first();
    await item.click();
    await expect(item).toHaveAttribute("aria-pressed", "true");

    // Loops unless told otherwise
    const playback = layout.getByTestId("lyrics-background-playback");
    await expect(playback.locator('[data-state="on"]')).toHaveText("Loop");
    await lyricsPlugin.saveStyleSettings(layout);

    const output = await projectPage.present();
    const video = output
      .locator('[data-testid="lyrics-background"] [data-active="true"] video')
      .first();
    await expect(video).toBeVisible();
    // Muted under the service, and actually playing
    await expect(video).toHaveJSProperty("muted", true);
    await expect(video).toHaveJSProperty("loop", true);
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), {
        timeout: 30000,
      })
      .toBeGreaterThan(0);

    layout = await lyricsPlugin.openStyleSettings();
    await layout
      .getByTestId("lyrics-background-playback")
      .getByText("Play once", { exact: true })
      .click();
    await lyricsPlugin.saveStyleSettings(layout);
    await expect(video).toHaveJSProperty("loop", false);
  });

  test("renders full song view", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    // Create the plugin and add a custom song with full song display type
    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong(
      "Amazing Grace Full",
      TEST_SONG_CONTENT,
      "fullSong",
    );

    // Wait for song to be added
    await expect(page.getByText("Amazing Grace Full").first()).toBeVisible();
    await expect(page.getByTestId("slide-container").first()).toBeVisible();

    // Click on the slide to select it
    await page.getByTestId("slide-container").nth(0).click();

    // Open presenter view
    const presentedPage = await projectPage.present();
    await presentedPage.waitForLoadState("networkidle");

    // Screenshot for full song view - default style
    await expect(presentedPage).toHaveScreenshot("full-song-default.png", {
      maxDiffPixelRatio: 0.05,
    });
  });
});
