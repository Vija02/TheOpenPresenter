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

    await expect(page.getByText("Amazing grace how sweet the")).toBeVisible();
    await expect(page.getByTestId("slide-container").first()).toBeVisible();

    await page.getByTestId("slide-container").nth(0).click();

    // Open presenter view
    const presentedPage = await projectPage.present();
    await presentedPage.waitForLoadState("networkidle");

    // Screenshot 1: Default style (dark mode, centered, auto-size)
    await expect(presentedPage).toHaveScreenshot(
      "01-default-dark-centered.png",
    );

    // Navigate to next slide and change styles - Light mode + Top aligned
    await presentedPage.click("body");
    await presentedPage.keyboard.press("ArrowRight");
    await presentedPage.waitForTimeout(300);

    await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setTheme("Light");
    await lyricsPlugin.setVerticalAlign("top");
    await lyricsPlugin.saveStyleSettings();

    await presentedPage.waitForTimeout(200);

    // Screenshot 2: Second verse, light mode, top aligned
    await expect(presentedPage).toHaveScreenshot(
      "02-verse-2-light-top-aligned.png",
    );

    // Navigate to chorus and change to bottom aligned + bold
    await presentedPage.keyboard.press("ArrowRight");
    await presentedPage.waitForTimeout(300);

    await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setVerticalAlign("bottom");
    await lyricsPlugin.toggleBold();
    await lyricsPlugin.saveStyleSettings();

    await presentedPage.waitForTimeout(200);

    // Screenshot 3: Chorus section, light mode, bottom aligned, bold
    await expect(presentedPage).toHaveScreenshot(
      "03-chorus-light-bottom-bold.png",
    );

    // Change to dark mode + italic + centered
    await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setTheme("Dark");
    await lyricsPlugin.setVerticalAlign("center");
    await lyricsPlugin.toggleBold(); // toggle off bold
    await lyricsPlugin.toggleItalic();
    await lyricsPlugin.saveStyleSettings();

    await presentedPage.waitForTimeout(200);

    // Screenshot 4: Dark mode, centered, italic
    await expect(presentedPage).toHaveScreenshot("04-dark-centered-italic.png");

    // Change to manual font size
    await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setAutoSize(false);
    await lyricsPlugin.setFontSize(24);
    await lyricsPlugin.toggleItalic(); // toggle off italic
    await lyricsPlugin.saveStyleSettings();

    await presentedPage.waitForTimeout(200);

    // Screenshot 5: Manual font size (24pt)
    await expect(presentedPage).toHaveScreenshot("05-manual-font-size.png");

    // Manual font size with top alignment and linked padding
    await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setVerticalAlign("top");
    await lyricsPlugin.setFontSize(10);
    await lyricsPlugin.setPadding(10);
    await lyricsPlugin.saveStyleSettings();

    await presentedPage.waitForTimeout(200);

    // Screenshot 6: Manual font size (10pt), top aligned, 10% padding
    await expect(presentedPage).toHaveScreenshot(
      "06-manual-top-aligned-padding.png",
    );

    // Manual font size with bottom alignment and individual padding
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

    // Screenshot 7: Manual font size (10pt), bottom aligned, individual padding
    await expect(presentedPage).toHaveScreenshot(
      "07-manual-bottom-aligned-individual-padding.png",
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
    await expect(page.getByText("Amazing Grace Full")).toBeVisible();
    await expect(page.getByTestId("slide-container").first()).toBeVisible();

    // Click on the slide to select it
    await page.getByTestId("slide-container").nth(1).click();

    // Open presenter view
    const presentedPage = await projectPage.present();
    await presentedPage.waitForLoadState("networkidle");

    // DOM snapshot for full song view - default style
    await expect(presentedPage.locator("body")).toMatchAriaSnapshot();

    // Change to light mode for variety
    await lyricsPlugin.openStyleSettings();
    await lyricsPlugin.setTheme("Light");
    await lyricsPlugin.saveStyleSettings();

    await presentedPage.waitForTimeout(200);

    // DOM snapshot for full song view - light mode
    await expect(presentedPage.locator("body")).toMatchAriaSnapshot();
  });
});
