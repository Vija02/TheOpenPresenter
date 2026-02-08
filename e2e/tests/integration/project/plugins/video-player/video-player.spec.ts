import { expect, test } from "../../../../../fixtures/projectFixture";

test.describe("Video Player Plugin", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("can search for a youtube video", async ({
    page,
    projectPage,
    videoPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Video Player");

    // Verify the video player plugin is loaded
    await expect(page.getByText("Search or enter URL:")).toBeVisible();

    // Enter a search query
    await videoPlayerPlugin.searchInput.fill("test video");
    await page.getByRole("button", { name: "Go" }).click();

    // Verify the YouTube search modal opens
    await expect(page.getByText("Youtube Search")).toBeVisible();

    // Wait for search results to load (skeleton should disappear and results should appear)
    await expect(page.locator(".grid img").first()).toBeVisible({
      timeout: 15 * 1000,
    });

    // Verify we have search results with video thumbnails
    const videoResults = page
      .locator(".grid > div")
      .filter({ has: page.locator("img") });
    await expect(videoResults.first()).toBeVisible();
  });
});
