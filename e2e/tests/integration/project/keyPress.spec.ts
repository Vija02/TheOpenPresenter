import { expect, test } from "../../../fixtures/projectFixture";

test.describe("Key Press Navigation", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("can navigate using keyboard arrows", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addSong("Shout to the Lord");
    await lyricsPlugin.addSong("One Way");

    // Present it & open
    await page.getByTestId("slide-container").nth(1).click();
    const presentedPage = await projectPage.present();
    await presentedPage.waitForLoadState("networkidle");

    await expect(
      presentedPage.getByText("Shout to the Lord all the earth let us sing", {
        exact: true,
      }),
    ).toBeVisible();

    await presentedPage.click("body");

    // Now, test the key presses
    await presentedPage.keyboard.press("ArrowLeft");
    await expect(
      presentedPage.getByText(
        "My Jesus, My Savior, Lord there is none like you",
        {
          exact: true,
        },
      ),
    ).toBeVisible();

    // Go to next song
    await presentedPage.keyboard.press("ArrowRight");
    await presentedPage.keyboard.press("ArrowRight");
    await expect(
      presentedPage.getByText("I lay my life down at Your feet", {
        exact: true,
      }),
    ).toBeVisible();

    // Now try to keyboard press in remote
    await page.click(".rt--top-bar"); // Click on an empty spot to focus
    await page.keyboard.press("ArrowRight");
    await expect(
      presentedPage.getByText("One way, Jesus", {
        exact: true,
      }),
    ).toBeVisible();
  });

  test("keyboard navigation does not work when input is focused", async ({
    page,
    projectPage,
    lyricsPlugin,
    videoPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addSong("Shout to the Lord");

    await page.getByTestId("slide-container").nth(0).click();

    // Now let's type in an input field. If we can do these operations, means that keypress is skipped
    await projectPage.createPlugin("Video Player");
    await videoPlayerPlugin.searchInput.fill("Test");
    await page.keyboard.press("ArrowLeft");
    await videoPlayerPlugin.searchInput.pressSequentially("val");

    await expect(videoPlayerPlugin.searchInput).toHaveValue("Tesvalt");
  });
});
