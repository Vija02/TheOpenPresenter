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

    // Screenshot 1: Default style (black background, white text, centered)
    await expect(presentedPage).toHaveScreenshot("01-default-style.png", {
      maxDiffPixelRatio: 0.05,
    });

    // Navigate to next slide and change text color + top aligned
    await presentedPage.click("body");
    await presentedPage.keyboard.press("ArrowRight");
    await presentedPage.waitForTimeout(300);

    await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setTextColor("#ffff00");
    await lyricsPlugin.setVerticalAlign("top");
    await lyricsPlugin.saveStyleSettings();

    await presentedPage.waitForTimeout(200);

    // Screenshot 2: Yellow text, top aligned
    await expect(presentedPage).toHaveScreenshot("02-yellow-text-top.png", {
      maxDiffPixelRatio: 0.05,
    });

    // Navigate to chorus, bottom aligned + bold
    await presentedPage.keyboard.press("ArrowRight");
    await presentedPage.waitForTimeout(300);

    await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setVerticalAlign("bottom");
    await lyricsPlugin.toggleBold();
    await lyricsPlugin.saveStyleSettings();

    await presentedPage.waitForTimeout(200);

    // Screenshot 3: Yellow text, bottom aligned, bold
    await expect(presentedPage).toHaveScreenshot("03-yellow-bottom-bold.png", {
      maxDiffPixelRatio: 0.05,
    });

    // Change to italic + centered + text shadow
    await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setVerticalAlign("center");
    await lyricsPlugin.toggleBold(); // toggle off bold
    await lyricsPlugin.toggleItalic();
    await lyricsPlugin.toggleTextShadow();
    await lyricsPlugin.saveStyleSettings();

    await presentedPage.waitForTimeout(200);

    // Screenshot 4: Yellow text, centered, italic, with shadow
    await expect(presentedPage).toHaveScreenshot(
      "04-yellow-centered-italic-shadow.png",
      { maxDiffPixelRatio: 0.05 },
    );

    // Add text outline + blue background
    await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.toggleTextOutline();
    await lyricsPlugin.setBackgroundColor("#1e3a8a");
    await lyricsPlugin.saveStyleSettings();

    await presentedPage.waitForTimeout(200);

    // Screenshot 5: Blue background, yellow text with shadow and outline
    await expect(presentedPage).toHaveScreenshot(
      "05-blue-bg-yellow-shadow-outline.png",
      { maxDiffPixelRatio: 0.05 },
    );

    // Manual font size + remove effects
    await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setAutoSize(false);
    await lyricsPlugin.setFontSize(24);
    await lyricsPlugin.toggleItalic(); // toggle off
    await lyricsPlugin.toggleTextShadow(); // toggle off
    await lyricsPlugin.toggleTextOutline(); // toggle off
    await lyricsPlugin.saveStyleSettings();

    await presentedPage.waitForTimeout(200);

    // Screenshot 6: Manual font size (24pt), blue background
    await expect(presentedPage).toHaveScreenshot("06-manual-font-size.png", {
      maxDiffPixelRatio: 0.05,
    });

    // Top aligned with padding
    await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setTextColor("#ffffff");
    await lyricsPlugin.setVerticalAlign("top");
    await lyricsPlugin.setFontSize(10);
    await lyricsPlugin.setPadding(10);
    await lyricsPlugin.saveStyleSettings();

    await presentedPage.waitForTimeout(200);

    // Screenshot 7: Manual font (10pt), top aligned, 10% padding
    await expect(presentedPage).toHaveScreenshot("07-manual-top-padding.png", {
      maxDiffPixelRatio: 0.05,
    });

    // Bottom aligned with individual padding
    await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setVerticalAlign("bottom");
    await lyricsPlugin.togglePaddingLink();
    await lyricsPlugin.setIndividualPadding({
      left: 5,
      top: 15,
      right: 5,
      bottom: 15,
    });
    await lyricsPlugin.saveStyleSettings();

    await presentedPage.waitForTimeout(200);

    // Screenshot 8: Manual font (10pt), bottom aligned, individual padding
    await expect(presentedPage).toHaveScreenshot(
      "08-manual-bottom-individual-padding.png",
      { maxDiffPixelRatio: 0.05 },
    );
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

    // Change to light background for variety
    await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setBackgroundColor("#f0f0f0");
    await lyricsPlugin.setTextColor("#000000");
    await lyricsPlugin.saveStyleSettings();

    await presentedPage.waitForTimeout(200);

    // Screenshot for full song view - light background
    await expect(presentedPage).toHaveScreenshot("full-song-light.png", {
      maxDiffPixelRatio: 0.05,
    });
  });
});
